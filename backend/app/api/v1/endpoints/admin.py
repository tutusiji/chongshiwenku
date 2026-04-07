from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_admin_user
from app.core.security import hash_password
from app.db.session import get_db
from app.models.acl_entry import ACLEntry
from app.models.ai_provider_config import AIProviderConfig
from app.models.coin_ledger import CoinLedger
from app.models.document import Document
from app.models.document_coin_record import DocumentCoinRecord
from app.models.document_like import DocumentLike
from app.models.enums import ACLSubjectType, ResourceStatus, ResourceVisibility, UserStatus
from app.models.group import Group
from app.models.group_member import GroupMember
from app.models.user import User
from app.models.user_checkin import UserCheckin
from app.models.user_coin_account import UserCoinAccount
from app.schemas.admin import (
    AdminAIProviderCreateRequest,
    AdminAIProviderListResponse,
    AdminAIProviderSummaryResponse,
    AdminAIProviderUpdateRequest,
    AdminDocumentListResponse,
    AdminDocumentSummaryResponse,
    AdminDocumentUpdateRequest,
    AdminOverviewResponse,
    AdminUserListResponse,
    AdminUserSummaryResponse,
    AdminUserUpdateRequest,
)
from app.services.ai import ensure_default_ai_provider, list_ai_provider_configs, mask_api_key, set_default_ai_provider
from app.services.documents import (
    delete_document,
    ensure_document_exists,
    get_document_page_count,
    sync_document_password_access,
    sync_document_specific_users,
)
from app.services.groups import delete_group, ensure_group_exists

router = APIRouter()


def parse_user_status(value: str) -> UserStatus:
    try:
        return UserStatus(value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的用户状态") from exc


def parse_resource_status(value: str) -> ResourceStatus:
    try:
        return ResourceStatus(value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的资源状态") from exc


def parse_visibility_mode(value: str) -> ResourceVisibility:
    try:
        return ResourceVisibility(value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的可见性配置") from exc


def build_admin_user_summary(user: User) -> AdminUserSummaryResponse:
    related_group_ids = {group.id for group in user.owned_groups}
    related_group_ids.update(item.group_id for item in user.group_memberships)
    return AdminUserSummaryResponse(
        id=user.id,
        username=user.username,
        nickname=user.nickname,
        email=user.email,
        phone=user.phone,
        status=user.status.value,
        is_admin=user.is_admin,
        document_count=len(user.uploaded_documents),
        group_count=len(related_group_ids),
        coin_balance=user.coin_account.balance if user.coin_account is not None else 0,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def build_admin_document_summary(document: Document) -> AdminDocumentSummaryResponse:
    latest_version = max(document.versions, key=lambda item: item.version_number)
    return AdminDocumentSummaryResponse(
        id=document.id,
        title=document.title,
        summary=document.summary,
        category=document.category,
        owner_username=document.owner.username,
        group_name=document.group.name if document.group is not None else None,
        file_name=latest_version.file_name,
        file_extension=document.file_extension,
        file_size=document.file_size,
        page_count=get_document_page_count(document),
        visibility_mode=document.visibility_mode.value,
        status=document.status.value,
        preview_status=document.preview_status.value,
        allow_download=document.allow_download,
        read_count=document.read_count,
        like_count=document.like_count,
        coin_count=document.coin_count,
        download_count=document.download_count,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def build_admin_ai_provider_summary(provider: AIProviderConfig) -> AdminAIProviderSummaryResponse:
    return AdminAIProviderSummaryResponse(
        id=provider.id,
        name=provider.name,
        provider_code=provider.provider_code,
        provider_type=provider.provider_type,
        base_url=provider.base_url,
        wire_api=provider.wire_api,
        model_name=provider.model_name,
        reasoning_effort=provider.reasoning_effort,
        api_key_masked=mask_api_key(provider.api_key),
        is_enabled=provider.is_enabled,
        is_default=provider.is_default,
        usage_count=provider.usage_count,
        last_used_at=provider.last_used_at,
        last_error=provider.last_error,
        notes=provider.notes,
        extra_metadata=provider.extra_metadata or {},
        created_at=provider.created_at,
        updated_at=provider.updated_at,
    )


def get_admin_user_query():
    return (
        select(User)
        .options(
            selectinload(User.coin_account),
            selectinload(User.uploaded_documents),
            selectinload(User.owned_groups),
            selectinload(User.group_memberships),
        )
        .order_by(User.created_at.desc())
    )


def get_admin_document_query():
    return (
        select(Document)
        .options(
            selectinload(Document.owner),
            selectinload(Document.group),
            selectinload(Document.versions),
            selectinload(Document.assets),
        )
        .order_by(Document.created_at.desc())
    )


def delete_user_account(db: Session, *, user: User, current_admin: User) -> None:
    if user.id == current_admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能删除当前登录的管理员账号")
    if user.username == "tutusiji":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="内置管理员账号不允许删除")

    documents = list(
        db.scalars(
            get_admin_document_query().where(Document.owner_id == user.id)
        )
    )
    for document in documents:
        delete_document(db, document)

    groups = list(
        db.scalars(
            select(Group)
            .where(Group.owner_id == user.id)
            .options(selectinload(Group.owner), selectinload(Group.members).selectinload(GroupMember.user))
        )
    )
    for group in groups:
        delete_group(db, group)

    db.execute(delete(GroupMember).where(GroupMember.user_id == user.id))
    db.execute(delete(DocumentLike).where(DocumentLike.user_id == user.id))
    db.execute(
        delete(DocumentCoinRecord).where(
            (DocumentCoinRecord.sender_user_id == user.id) | (DocumentCoinRecord.receiver_user_id == user.id)
        )
    )
    db.execute(delete(UserCheckin).where(UserCheckin.user_id == user.id))
    db.execute(delete(UserCoinAccount).where(UserCoinAccount.user_id == user.id))
    db.execute(
        delete(ACLEntry).where(
            ACLEntry.subject_type == ACLSubjectType.USER,
            ACLEntry.subject_id == user.id,
        )
    )
    db.execute(update(CoinLedger).where(CoinLedger.related_user_id == user.id).values(related_user_id=None))
    db.execute(delete(CoinLedger).where(CoinLedger.user_id == user.id))

    db.delete(user)
    db.flush()


@router.get("/overview", response_model=AdminOverviewResponse)
def read_admin_overview(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> AdminOverviewResponse:
    del current_admin

    return AdminOverviewResponse(
        users_count=db.scalar(select(func.count(User.id))) or 0,
        documents_count=db.scalar(select(func.count(Document.id))) or 0,
        groups_count=db.scalar(select(func.count(Group.id))) or 0,
        public_documents_count=db.scalar(
            select(func.count(Document.id)).where(Document.visibility_mode == ResourceVisibility.PUBLIC)
        )
        or 0,
        ai_provider_count=db.scalar(select(func.count(AIProviderConfig.id))) or 0,
        enabled_ai_provider_count=db.scalar(
            select(func.count(AIProviderConfig.id)).where(AIProviderConfig.is_enabled.is_(True))
        )
        or 0,
    )


@router.get("/users", response_model=AdminUserListResponse)
def read_admin_users(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> AdminUserListResponse:
    del current_admin

    users = list(db.scalars(get_admin_user_query()))
    return AdminUserListResponse(items=[build_admin_user_summary(user) for user in users])


@router.patch("/users/{user_id}", response_model=AdminUserSummaryResponse)
def patch_admin_user(
    user_id: UUID,
    payload: AdminUserUpdateRequest,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> AdminUserSummaryResponse:
    user = db.scalar(get_admin_user_query().where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    if payload.username is not None and payload.username != user.username:
        duplicated_user = db.scalar(select(User).where(User.username == payload.username))
        if duplicated_user is not None and duplicated_user.id != user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已存在")
        user.username = payload.username

    if "nickname" in payload.model_fields_set:
        user.nickname = payload.nickname or user.username

    if "email" in payload.model_fields_set:
        if payload.email:
            duplicated_email_user = db.scalar(select(User).where(User.email == payload.email))
            if duplicated_email_user is not None and duplicated_email_user.id != user.id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邮箱已存在")
            user.email = payload.email
        else:
            user.email = None

    if "phone" in payload.model_fields_set:
        if payload.phone:
            duplicated_phone_user = db.scalar(select(User).where(User.phone == payload.phone))
            if duplicated_phone_user is not None and duplicated_phone_user.id != user.id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="手机号已存在")
            user.phone = payload.phone
        else:
            user.phone = None

    if payload.status is not None:
        user.status = parse_user_status(payload.status)

    if payload.is_admin is not None:
        if user.id == current_admin.id and payload.is_admin is False:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能取消当前登录管理员自己的后台权限")
        user.is_admin = payload.is_admin

    if payload.password:
        user.password_hash = hash_password(payload.password)

    db.commit()
    refreshed_user = db.scalar(get_admin_user_query().where(User.id == user_id))
    if refreshed_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return build_admin_user_summary(refreshed_user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_admin_user(
    user_id: UUID,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> Response:
    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    delete_user_account(db, user=user, current_admin=current_admin)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/documents", response_model=AdminDocumentListResponse)
def read_admin_documents(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> AdminDocumentListResponse:
    del current_admin

    documents = list(db.scalars(get_admin_document_query()))
    return AdminDocumentListResponse(items=[build_admin_document_summary(document) for document in documents])


@router.patch("/documents/{document_id}", response_model=AdminDocumentSummaryResponse)
def patch_admin_document(
    document_id: UUID,
    payload: AdminDocumentUpdateRequest,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> AdminDocumentSummaryResponse:
    del current_admin

    document = ensure_document_exists(db, document_id)
    provided_fields = payload.model_fields_set

    if payload.title is not None:
        document.title = payload.title.strip()
    if "summary" in provided_fields:
        document.summary = payload.summary.strip() if payload.summary else None
    if "category" in provided_fields:
        document.category = payload.category.strip() if payload.category else None
    if payload.allow_download is not None:
        document.allow_download = payload.allow_download
    if payload.status is not None:
        document.status = parse_resource_status(payload.status)
    if "group_id" in provided_fields:
        if payload.group_id is not None:
            ensure_group_exists(db, payload.group_id)
        document.group_id = payload.group_id

    if payload.visibility_mode is not None:
        document.visibility_mode = parse_visibility_mode(payload.visibility_mode)

    effective_visibility = document.visibility_mode
    if effective_visibility == ResourceVisibility.GROUP_MEMBERS and document.group_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="组内可见的文档必须绑定资料组")

    if (
        payload.visibility_mode is not None
        or "password" in provided_fields
        or "password_hint" in provided_fields
    ):
        sync_document_password_access(
            db,
            document_id=document.id,
            visibility_mode=effective_visibility,
            password=payload.password,
            password_hint=payload.password_hint,
            password_provided="password" in provided_fields,
            password_hint_provided="password_hint" in provided_fields,
        )

    if payload.visibility_mode is not None or "specific_usernames" in provided_fields:
        sync_document_specific_users(
            db,
            document_id=document.id,
            visibility_mode=effective_visibility,
            usernames=payload.specific_usernames,
            usernames_provided="specific_usernames" in provided_fields,
        )

    db.commit()
    refreshed_document = db.scalar(get_admin_document_query().where(Document.id == document_id))
    if refreshed_document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文档不存在")
    return build_admin_document_summary(refreshed_document)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_admin_document(
    document_id: UUID,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> Response:
    del current_admin

    document = ensure_document_exists(db, document_id)
    delete_document(db, document)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/ai-providers", response_model=AdminAIProviderListResponse)
def read_ai_providers(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> AdminAIProviderListResponse:
    del current_admin

    providers = list_ai_provider_configs(db)
    return AdminAIProviderListResponse(items=[build_admin_ai_provider_summary(item) for item in providers])


@router.post("/ai-providers", response_model=AdminAIProviderSummaryResponse, status_code=status.HTTP_201_CREATED)
def create_ai_provider(
    payload: AdminAIProviderCreateRequest,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> AdminAIProviderSummaryResponse:
    del current_admin

    existing_provider = db.scalar(select(AIProviderConfig).where(AIProviderConfig.provider_code == payload.provider_code))
    if existing_provider is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="AI 提供方编码已存在")

    provider = AIProviderConfig(
        name=payload.name,
        provider_code=payload.provider_code,
        provider_type=payload.provider_type,
        base_url=payload.base_url,
        api_key=payload.api_key,
        wire_api=payload.wire_api,
        model_name=payload.model_name,
        reasoning_effort=payload.reasoning_effort,
        is_enabled=payload.is_enabled,
        is_default=payload.is_default,
        notes=payload.notes,
        extra_metadata=payload.extra_metadata or {},
    )
    db.add(provider)
    db.flush()

    if provider.is_default:
        set_default_ai_provider(db, provider)
    else:
        ensure_default_ai_provider(db)

    db.commit()
    db.refresh(provider)
    return build_admin_ai_provider_summary(provider)


@router.patch("/ai-providers/{provider_id}", response_model=AdminAIProviderSummaryResponse)
def patch_ai_provider(
    provider_id: UUID,
    payload: AdminAIProviderUpdateRequest,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> AdminAIProviderSummaryResponse:
    del current_admin

    provider = db.scalar(select(AIProviderConfig).where(AIProviderConfig.id == provider_id))
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI 提供方不存在")

    if payload.provider_code is not None and payload.provider_code != provider.provider_code:
        duplicated_provider = db.scalar(select(AIProviderConfig).where(AIProviderConfig.provider_code == payload.provider_code))
        if duplicated_provider is not None and duplicated_provider.id != provider.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="AI 提供方编码已存在")
        provider.provider_code = payload.provider_code

    if payload.name is not None:
        provider.name = payload.name
    if payload.provider_type is not None:
        provider.provider_type = payload.provider_type
    if payload.base_url is not None:
        provider.base_url = payload.base_url
    if payload.api_key is not None:
        provider.api_key = payload.api_key
    if payload.wire_api is not None:
        provider.wire_api = payload.wire_api
    if payload.model_name is not None:
        provider.model_name = payload.model_name
    if "reasoning_effort" in payload.model_fields_set:
        provider.reasoning_effort = payload.reasoning_effort
    if payload.is_enabled is not None:
        provider.is_enabled = payload.is_enabled
    if "notes" in payload.model_fields_set:
        provider.notes = payload.notes
    if "extra_metadata" in payload.model_fields_set:
        provider.extra_metadata = payload.extra_metadata or {}

    if payload.is_default is True:
        set_default_ai_provider(db, provider)
    else:
        if payload.is_default is False:
            provider.is_default = False
        ensure_default_ai_provider(db)

    db.commit()
    db.refresh(provider)
    return build_admin_ai_provider_summary(provider)


@router.delete("/ai-providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_ai_provider(
    provider_id: UUID,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
) -> Response:
    del current_admin

    provider = db.scalar(select(AIProviderConfig).where(AIProviderConfig.id == provider_id))
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI 提供方不存在")

    db.delete(provider)
    db.flush()
    ensure_default_ai_provider(db)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
