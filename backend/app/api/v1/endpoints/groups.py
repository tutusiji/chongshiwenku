from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.access_passcode import AccessPasscode
from app.models.enums import GroupRole, ResourceVisibility
from app.models.group import Group
from app.models.group_member import GroupMember
from app.models.user import User
from app.schemas.groups import (
    GroupCreateRequest,
    GroupDetailResponse,
    GroupListResponse,
    GroupMemberCreateRequest,
    GroupMemberResponse,
    GroupMemberUserResponse,
    GroupOwnerResponse,
    GroupResponse,
    GroupUpdateRequest,
)
from app.services.groups import (
    add_group_member,
    create_group,
    delete_group,
    ensure_can_manage_group,
    ensure_can_view_group,
    ensure_group_exists,
    list_group_specific_users,
    list_my_groups,
    remove_group_member,
    update_group,
)

router = APIRouter()


def parse_visibility_mode(value: str) -> ResourceVisibility:
    try:
        return ResourceVisibility(value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的资料组可见性类型") from exc


def parse_group_role(value: str) -> GroupRole:
    try:
        return GroupRole(value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的组成员角色") from exc


def build_member_response(member: GroupMember) -> GroupMemberResponse:
    return GroupMemberResponse(
        role=member.role.value,
        joined_at=member.joined_at,
        user=GroupMemberUserResponse.model_validate(member.user),
    )


def build_group_response(db: Session, group: Group, current_user: User) -> GroupResponse:
    passcode = db.scalar(
        select(AccessPasscode).where(
            AccessPasscode.resource_type == "group",
            AccessPasscode.resource_id == group.id,
            AccessPasscode.is_enabled.is_(True),
        )
    )

    my_role = None
    if group.owner_id == current_user.id:
        my_role = GroupRole.OWNER.value
    else:
        membership = next((member for member in group.members if member.user_id == current_user.id), None)
        if membership is not None:
            my_role = membership.role.value

    return GroupResponse(
        id=group.id,
        name=group.name,
        slug=group.slug,
        description=group.description,
        cover_url=group.cover_url,
        visibility_mode=group.visibility_mode.value,
        status=group.status.value,
        allow_member_invite=group.allow_member_invite,
        member_count=len(group.members),
        my_role=my_role,
        password_enabled=passcode is not None,
        owner=GroupOwnerResponse.model_validate(group.owner),
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


def build_group_detail_response(db: Session, group: Group, current_user: User) -> GroupDetailResponse:
    base = build_group_response(db, group, current_user)
    specific_users = [GroupMemberUserResponse.model_validate(user) for user in list_group_specific_users(db, group.id)]
    return GroupDetailResponse(
        **base.model_dump(),
        members=[build_member_response(member) for member in group.members],
        specific_users=specific_users,
    )


@router.post("", response_model=GroupDetailResponse, status_code=status.HTTP_201_CREATED)
def create_new_group(
    payload: GroupCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GroupDetailResponse:
    group = create_group(
        db,
        current_user=current_user,
        name=payload.name,
        description=payload.description,
        visibility_mode=parse_visibility_mode(payload.visibility_mode),
        allow_member_invite=payload.allow_member_invite,
        password=payload.password,
        password_hint=payload.password_hint,
        specific_usernames=payload.specific_usernames,
    )
    db.commit()
    return build_group_detail_response(db, group, current_user)


@router.get("", response_model=GroupListResponse)
def read_groups(
    scope: str = Query(default="my"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GroupListResponse:
    if scope != "my":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前仅支持查询我的资料组")

    groups = list_my_groups(db, current_user)
    return GroupListResponse(items=[build_group_response(db, group, current_user) for group in groups])


@router.get("/{group_id}", response_model=GroupDetailResponse)
def read_group_detail(
    group_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GroupDetailResponse:
    group = ensure_group_exists(db, group_id)
    ensure_can_view_group(db, group, current_user)
    return build_group_detail_response(db, group, current_user)


@router.patch("/{group_id}", response_model=GroupDetailResponse)
def patch_group(
    group_id: UUID,
    payload: GroupUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GroupDetailResponse:
    group = ensure_group_exists(db, group_id)
    ensure_can_manage_group(db, group, current_user)
    provided_fields = payload.model_fields_set
    updated_group = update_group(
        db,
        group=group,
        name=payload.name,
        description=payload.description,
        visibility_mode=parse_visibility_mode(payload.visibility_mode) if payload.visibility_mode else None,
        allow_member_invite=payload.allow_member_invite,
        password=payload.password,
        password_hint=payload.password_hint,
        specific_usernames=payload.specific_usernames,
        password_provided="password" in provided_fields,
        password_hint_provided="password_hint" in provided_fields,
        specific_usernames_provided="specific_usernames" in provided_fields,
    )
    db.commit()
    return build_group_detail_response(db, updated_group, current_user)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_group(
    group_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    group = ensure_group_exists(db, group_id)
    ensure_can_manage_group(db, group, current_user)
    delete_group(db, group)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{group_id}/members", response_model=list[GroupMemberResponse])
def read_group_members(
    group_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GroupMemberResponse]:
    group = ensure_group_exists(db, group_id)
    ensure_can_view_group(db, group, current_user)
    return [build_member_response(member) for member in group.members]


@router.post("/{group_id}/members", response_model=GroupMemberResponse, status_code=status.HTTP_201_CREATED)
def create_group_member(
    group_id: UUID,
    payload: GroupMemberCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GroupMemberResponse:
    group = ensure_group_exists(db, group_id)
    member = add_group_member(
        db,
        group=group,
        current_user=current_user,
        username=payload.username,
        role=parse_group_role(payload.role),
    )
    db.commit()
    group = ensure_group_exists(db, group_id)
    created_member = next((item for item in group.members if item.user_id == member.user_id), None)
    if created_member is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="成员创建后加载失败")
    return build_member_response(created_member)


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group_member(
    group_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    group = ensure_group_exists(db, group_id)
    remove_group_member(db, group=group, current_user=current_user, target_user_id=user_id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
