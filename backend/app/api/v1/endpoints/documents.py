from __future__ import annotations

from pathlib import Path
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_optional_current_user
from app.db.session import get_db
from app.models.document import Document
from app.models.enums import ResourceVisibility
from app.models.user import User
from app.schemas.documents import (
    DocumentCoinRequest,
    DocumentCoinResponse,
    DocumentDetailResponse,
    DocumentLikeResponse,
    DocumentListResponse,
    DocumentOwnerResponse,
    DocumentResponse,
)
from app.services.documents import (
    add_document_like,
    count_document_likes_for_user,
    count_document_password_enabled,
    create_document,
    donate_document_coins,
    build_preview_strategy,
    ensure_can_view_document,
    ensure_document_exists,
    get_document_file_path,
    get_document_preview_text_path,
    get_latest_version,
    has_document_preview_text,
    list_public_documents,
    list_document_specific_users,
    list_my_documents,
    mark_document_download,
    mark_document_read,
    parse_specific_usernames,
    remove_document_like,
    resolve_document_media_type,
    supports_inline_preview,
)

router = APIRouter()


def parse_visibility_mode(value: str) -> ResourceVisibility:
    try:
        return ResourceVisibility(value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的文档可见性类型") from exc


def build_inline_content_disposition(file_name: str) -> str:
    normalized_name = Path(file_name).name
    ascii_fallback = normalized_name.encode("ascii", "ignore").decode("ascii").strip()
    if not ascii_fallback:
        ascii_fallback = f"document{Path(normalized_name).suffix or '.bin'}"

    safe_fallback = ascii_fallback.replace("\\", "_").replace('"', "_")
    encoded_name = quote(normalized_name, safe="")
    return f"inline; filename=\"{safe_fallback}\"; filename*=UTF-8''{encoded_name}"


def build_document_response(db: Session, document: Document, current_user: User | None) -> DocumentResponse:
    latest_version = get_latest_version(document)
    resolved_mime_type = resolve_document_media_type(latest_version.file_name, document.mime_type)
    return DocumentResponse(
        id=document.id,
        group_id=document.group_id,
        title=document.title,
        summary=document.summary,
        category=document.category,
        file_name=latest_version.file_name,
        file_type=document.file_type,
        mime_type=resolved_mime_type,
        file_extension=document.file_extension,
        file_size=document.file_size,
        visibility_mode=document.visibility_mode.value,
        status=document.status.value,
        preview_status=document.preview_status.value,
        allow_download=document.allow_download,
        read_count=document.read_count,
        like_count=document.like_count,
        coin_count=document.coin_count,
        download_count=document.download_count,
        password_enabled=count_document_password_enabled(db, document.id),
        my_liked=count_document_likes_for_user(document, current_user.id if current_user else None),
        owner=DocumentOwnerResponse.model_validate(document.owner),
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def build_document_detail_response(db: Session, document: Document, current_user: User | None) -> DocumentDetailResponse:
    latest_version = get_latest_version(document)
    base = build_document_response(db, document, current_user)
    return DocumentDetailResponse(
        **base.model_dump(),
        specific_usernames=list_document_specific_users(db, document.id),
        latest_storage_key=latest_version.storage_key,
        inline_preview_supported=supports_inline_preview(document.file_extension, base.mime_type),
        preview_text_available=has_document_preview_text(document),
        preview_strategy=build_preview_strategy(document),
    )


@router.post("", response_model=DocumentDetailResponse, status_code=status.HTTP_201_CREATED)
def create_new_document(
    title: str = Form(...),
    summary: str | None = Form(default=None),
    category: str | None = Form(default=None),
    group_id: UUID | None = Form(default=None),
    visibility_mode: str = Form(default="public"),
    allow_download: bool = Form(default=True),
    password: str | None = Form(default=None),
    password_hint: str | None = Form(default=None),
    specific_usernames: str | None = Form(default=None),
    upload_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentDetailResponse:
    document = create_document(
        db,
        current_user=current_user,
        title=title.strip(),
        summary=summary.strip() if summary else None,
        category=category.strip() if category else None,
        group_id=group_id,
        visibility_mode=parse_visibility_mode(visibility_mode),
        allow_download=allow_download,
        password=password.strip() if password else None,
        password_hint=password_hint.strip() if password_hint else None,
        specific_usernames=parse_specific_usernames(specific_usernames),
        upload_file=upload_file,
    )
    db.commit()
    return build_document_detail_response(db, document, current_user)


@router.get("", response_model=DocumentListResponse)
def read_documents(
    scope: str = Query(default="my"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentListResponse:
    if scope != "my":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前仅支持查询我的文档")

    documents = list_my_documents(db, current_user)
    return DocumentListResponse(items=[build_document_response(db, item, current_user) for item in documents])


@router.get("/discover", response_model=DocumentListResponse)
def discover_documents(
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    limit: int = Query(default=24, ge=1, le=60),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> DocumentListResponse:
    documents = list_public_documents(db, q=q, category=category, limit=limit)
    return DocumentListResponse(items=[build_document_response(db, item, current_user) for item in documents])


@router.get("/{document_id}", response_model=DocumentDetailResponse)
def read_document_detail(
    document_id: UUID,
    access_password: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> DocumentDetailResponse:
    document = ensure_document_exists(db, document_id)
    ensure_can_view_document(db, document, current_user, access_password=access_password)
    return build_document_detail_response(db, document, current_user)


@router.get("/{document_id}/file")
def download_document_file(
    document_id: UUID,
    inline: bool = Query(default=False),
    access_password: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    document = ensure_document_exists(db, document_id)
    if inline:
        document = mark_document_read(db, document=document, current_user=current_user, access_password=access_password)
    else:
        document = mark_document_download(
            db,
            document=document,
            current_user=current_user,
            access_password=access_password,
        )
    db.commit()

    latest_version = get_latest_version(document)
    file_path = get_document_file_path(document)
    response = FileResponse(
        path=file_path,
        media_type=resolve_document_media_type(latest_version.file_name, document.mime_type),
        filename=latest_version.file_name,
    )
    if inline:
        response.headers["Content-Disposition"] = build_inline_content_disposition(latest_version.file_name)
    return response


@router.get("/{document_id}/preview-text")
def read_document_preview_text(
    document_id: UUID,
    access_password: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> PlainTextResponse:
    document = ensure_document_exists(db, document_id)
    document = mark_document_read(db, document=document, current_user=current_user, access_password=access_password)
    db.commit()
    preview_text_path = get_document_preview_text_path(document)
    return PlainTextResponse(preview_text_path.read_text(encoding="utf-8", errors="ignore"))


@router.post("/{document_id}/likes", response_model=DocumentLikeResponse)
def like_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentLikeResponse:
    document = ensure_document_exists(db, document_id)
    liked_document = add_document_like(db, document, current_user)
    db.commit()
    return DocumentLikeResponse(liked=True, like_count=liked_document.like_count)


@router.delete("/{document_id}/likes", response_model=DocumentLikeResponse)
def unlike_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentLikeResponse:
    document = ensure_document_exists(db, document_id)
    liked_document = remove_document_like(db, document, current_user)
    db.commit()
    return DocumentLikeResponse(liked=False, like_count=liked_document.like_count)


@router.post("/{document_id}/coins", response_model=DocumentCoinResponse)
def coin_document(
    document_id: UUID,
    payload: DocumentCoinRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentCoinResponse:
    document = ensure_document_exists(db, document_id)
    updated_document, sender_account, receiver_account = donate_document_coins(
        db,
        document=document,
        current_user=current_user,
        coin_amount=payload.coin_amount,
    )
    db.commit()
    return DocumentCoinResponse(
        coin_amount=payload.coin_amount,
        my_balance=sender_account.balance,
        document_coin_count=updated_document.coin_count,
        owner_balance=receiver_account.balance,
        message="投币成功",
    )
