from __future__ import annotations

import re
import secrets
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.security import hash_password
from app.models.access_passcode import AccessPasscode
from app.models.acl_entry import ACLEntry
from app.models.enums import ACLPermissionType, ACLSubjectType, GroupRole, ResourceVisibility
from app.models.group import Group
from app.models.group_member import GroupMember
from app.models.user import User


def generate_group_slug(name: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", name.strip().lower()).strip("-")
    base = normalized or "group"
    return f"{base}-{secrets.token_hex(3)}"


def get_group_by_id(db: Session, group_id: UUID) -> Group | None:
    stmt = (
        select(Group)
        .where(Group.id == group_id)
        .options(
            selectinload(Group.owner),
            selectinload(Group.members).selectinload(GroupMember.user),
        )
    )
    return db.scalar(stmt)


def get_group_member(db: Session, group_id: UUID, user_id: UUID) -> GroupMember | None:
    return db.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )


def ensure_group_exists(db: Session, group_id: UUID) -> Group:
    group = get_group_by_id(db, group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="资料组不存在")
    return group


def ensure_can_manage_group(db: Session, group: Group, current_user: User) -> GroupRole:
    if group.owner_id == current_user.id:
        return GroupRole.OWNER

    membership = get_group_member(db, group.id, current_user.id)
    if membership and membership.role in {GroupRole.ADMIN, GroupRole.OWNER}:
        return membership.role

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有管理该资料组的权限")


def ensure_can_view_group(db: Session, group: Group, current_user: User) -> None:
    if group.owner_id == current_user.id:
        return

    membership = get_group_member(db, group.id, current_user.id)
    if membership is not None:
        return

    if group.visibility_mode == ResourceVisibility.PUBLIC:
        return

    if group.visibility_mode == ResourceVisibility.SPECIFIC_USERS:
        acl_entry = db.scalar(
            select(ACLEntry).where(
                ACLEntry.resource_type == "group",
                ACLEntry.resource_id == group.id,
                ACLEntry.subject_type == ACLSubjectType.USER,
                ACLEntry.subject_id == current_user.id,
                ACLEntry.permission_type == ACLPermissionType.VIEW,
            )
        )
        if acl_entry is not None:
            return

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有查看该资料组的权限")


def resolve_users_by_usernames(db: Session, usernames: list[str]) -> list[User]:
    if not usernames:
        return []

    stmt = select(User).where(User.username.in_(usernames))
    users = list(db.scalars(stmt))
    found = {user.username for user in users}
    missing = [username for username in usernames if username not in found]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"以下用户不存在：{', '.join(missing)}",
        )
    return users


def sync_group_password_access(
    db: Session,
    *,
    group_id: UUID,
    visibility_mode: ResourceVisibility,
    password: str | None,
    password_hint: str | None,
    password_provided: bool = True,
    password_hint_provided: bool = True,
) -> None:
    stmt = select(AccessPasscode).where(
        AccessPasscode.resource_type == "group",
        AccessPasscode.resource_id == group_id,
    )
    passcode = db.scalar(stmt)

    if visibility_mode != ResourceVisibility.PASSWORD:
        if passcode is not None:
            db.delete(passcode)
            db.flush()
        return

    if passcode is None:
        if not password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="密码访问模式下必须提供访问密码")
        passcode = AccessPasscode(
            resource_type="group",
            resource_id=group_id,
            password_hash=hash_password(password),
            hint=password_hint,
            is_enabled=True,
        )
        db.add(passcode)
    else:
        if password_provided:
            if not password:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="密码访问模式下必须提供访问密码")
            passcode.password_hash = hash_password(password)
        if password_hint_provided:
            passcode.hint = password_hint
        passcode.is_enabled = True
    db.flush()


def sync_group_specific_users(
    db: Session,
    *,
    group_id: UUID,
    visibility_mode: ResourceVisibility,
    usernames: list[str] | None,
    usernames_provided: bool = True,
) -> None:
    delete_stmt = delete(ACLEntry).where(
        ACLEntry.resource_type == "group",
        ACLEntry.resource_id == group_id,
        ACLEntry.subject_type == ACLSubjectType.USER,
        ACLEntry.permission_type == ACLPermissionType.VIEW,
    )

    if visibility_mode != ResourceVisibility.SPECIFIC_USERS:
        db.execute(delete_stmt)
        db.flush()
        return

    if not usernames_provided:
        acl_count = db.scalar(
            select(func.count(ACLEntry.id)).where(
                ACLEntry.resource_type == "group",
                ACLEntry.resource_id == group_id,
                ACLEntry.subject_type == ACLSubjectType.USER,
                ACLEntry.permission_type == ACLPermissionType.VIEW,
            )
        )
        if acl_count:
            return
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="指定用户可见模式下至少需要一个用户")

    users = resolve_users_by_usernames(db, usernames or [])
    if not users:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="指定用户可见模式下至少需要一个用户")

    db.execute(delete_stmt)
    for user in users:
        db.add(
            ACLEntry(
                resource_type="group",
                resource_id=group_id,
                subject_type=ACLSubjectType.USER,
                subject_id=user.id,
                subject_key=None,
                permission_type=ACLPermissionType.VIEW,
            )
        )
    db.flush()


def create_group(
    db: Session,
    *,
    current_user: User,
    name: str,
    description: str | None,
    visibility_mode: ResourceVisibility,
    allow_member_invite: bool,
    password: str | None,
    password_hint: str | None,
    specific_usernames: list[str],
) -> Group:
    group = Group(
        owner_id=current_user.id,
        name=name,
        slug=generate_group_slug(name),
        description=description,
        visibility_mode=visibility_mode,
        allow_member_invite=allow_member_invite,
    )
    db.add(group)
    db.flush()

    db.add(
        GroupMember(
            group_id=group.id,
            user_id=current_user.id,
            role=GroupRole.OWNER,
        )
    )
    db.flush()

    sync_group_password_access(
        db,
        group_id=group.id,
        visibility_mode=visibility_mode,
        password=password,
        password_hint=password_hint,
    )
    sync_group_specific_users(
        db,
        group_id=group.id,
        visibility_mode=visibility_mode,
        usernames=specific_usernames,
    )

    return ensure_group_exists(db, group.id)


def update_group(
    db: Session,
    *,
    group: Group,
    name: str | None,
    description: str | None,
    visibility_mode: ResourceVisibility | None,
    allow_member_invite: bool | None,
    password: str | None,
    password_hint: str | None,
    specific_usernames: list[str] | None,
    password_provided: bool = False,
    password_hint_provided: bool = False,
    specific_usernames_provided: bool = False,
) -> Group:
    if name is not None:
        group.name = name
    if description is not None:
        group.description = description
    if allow_member_invite is not None:
        group.allow_member_invite = allow_member_invite
    if visibility_mode is not None:
        group.visibility_mode = visibility_mode

    effective_visibility = visibility_mode or group.visibility_mode

    sync_group_password_access(
        db,
        group_id=group.id,
        visibility_mode=effective_visibility,
        password=password,
        password_hint=password_hint,
        password_provided=password_provided,
        password_hint_provided=password_hint_provided,
    )
    sync_group_specific_users(
        db,
        group_id=group.id,
        visibility_mode=effective_visibility,
        usernames=specific_usernames,
        usernames_provided=specific_usernames_provided,
    )
    db.flush()
    return ensure_group_exists(db, group.id)


def delete_group(db: Session, group: Group) -> None:
    db.execute(
        delete(ACLEntry).where(
            ACLEntry.resource_type == "group",
            ACLEntry.resource_id == group.id,
        )
    )
    db.execute(
        delete(AccessPasscode).where(
            AccessPasscode.resource_type == "group",
            AccessPasscode.resource_id == group.id,
        )
    )
    db.delete(group)
    db.flush()


def list_my_groups(db: Session, current_user: User) -> list[Group]:
    stmt = (
        select(Group)
        .outerjoin(GroupMember, Group.id == GroupMember.group_id)
        .where(
            or_(
                Group.owner_id == current_user.id,
                GroupMember.user_id == current_user.id,
            )
        )
        .options(
            selectinload(Group.owner),
            selectinload(Group.members).selectinload(GroupMember.user),
        )
        .order_by(Group.created_at.desc())
        .distinct()
    )
    return list(db.scalars(stmt))


def list_group_specific_users(db: Session, group_id: UUID) -> list[User]:
    stmt = (
        select(User)
        .join(ACLEntry, ACLEntry.subject_id == User.id)
        .where(
            ACLEntry.resource_type == "group",
            ACLEntry.resource_id == group_id,
            ACLEntry.subject_type == ACLSubjectType.USER,
            ACLEntry.permission_type == ACLPermissionType.VIEW,
        )
    )
    return list(db.scalars(stmt))


def add_group_member(
    db: Session,
    *,
    group: Group,
    current_user: User,
    username: str,
    role: GroupRole,
) -> GroupMember:
    manage_role = ensure_can_manage_group(db, group, current_user)
    if not group.allow_member_invite and manage_role != GroupRole.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前资料组不允许管理员邀请成员")

    target_user = db.scalar(select(User).where(User.username == username))
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="目标用户不存在")

    if target_user.id == group.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="资料组拥有者已默认在组内")

    existing_member = get_group_member(db, group.id, target_user.id)
    if existing_member is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该用户已经在组内")

    if role == GroupRole.OWNER:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能通过邀请接口创建第二个拥有者")

    member = GroupMember(group_id=group.id, user_id=target_user.id, role=role)
    db.add(member)
    db.flush()
    db.refresh(member)
    return member


def remove_group_member(
    db: Session,
    *,
    group: Group,
    current_user: User,
    target_user_id: UUID,
) -> None:
    ensure_can_manage_group(db, group, current_user)
    if target_user_id == group.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能移除资料组拥有者")

    member = get_group_member(db, group.id, target_user_id)
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="该成员不存在")

    db.delete(member)
    db.flush()
