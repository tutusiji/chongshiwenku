from __future__ import annotations

import json
import mimetypes
import os
import re
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.business_rules import UPLOAD_REWARD_COINS
from app.core.security import hash_password, verify_password
from app.models.access_passcode import AccessPasscode
from app.models.acl_entry import ACLEntry
from app.models.coin_ledger import CoinLedger
from app.models.document import Document
from app.models.document_asset import DocumentAsset
from app.models.document_coin_record import DocumentCoinRecord
from app.models.document_like import DocumentLike
from app.models.document_version import DocumentVersion
from app.models.enums import ACLPermissionType, ACLSubjectType, CoinLedgerSource, DocumentAssetKind, DocumentPreviewStatus, ResourceVisibility
from app.models.group import Group
from app.models.group_member import GroupMember
from app.models.user import User
from app.services.coins import get_or_create_coin_account
from app.services.groups import ensure_group_exists, resolve_users_by_usernames

if TYPE_CHECKING:
    from app.models.user_coin_account import UserCoinAccount


BACKEND_ROOT = Path(__file__).resolve().parents[2]
DOCUMENT_STORAGE_ROOT = BACKEND_ROOT / "storage" / "documents"
INLINE_PREVIEW_EXTENSIONS = {
    "pdf",
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
}
TEXT_PREVIEW_EXTENSIONS = {"txt", "md", "csv", "json", "log"}


def sanitize_file_name(file_name: str) -> str:
    cleaned = re.sub(r"[^\w.\-()\u4e00-\u9fff]+", "_", file_name).strip("._")
    return cleaned or "document"


def classify_file_type(file_extension: str) -> str:
    extension = file_extension.lower()
    if extension == "pdf":
        return "pdf"
    if extension in {"doc", "docx", "txt", "md", "rtf"}:
        return "document"
    if extension in {"xls", "xlsx", "csv"}:
        return "spreadsheet"
    if extension in {"ppt", "pptx"}:
        return "presentation"
    if extension in {"png", "jpg", "jpeg", "gif", "webp"}:
        return "image"
    return "file"


def resolve_document_media_type(file_name: str, stored_mime_type: str | None = None) -> str:
    normalized_mime_type = (stored_mime_type or "").strip().lower()
    if normalized_mime_type and normalized_mime_type != "application/octet-stream":
        return normalized_mime_type

    guessed_mime_type = mimetypes.guess_type(file_name)[0]
    return guessed_mime_type or normalized_mime_type or "application/octet-stream"


def supports_inline_preview(file_extension: str, mime_type: str) -> bool:
    return file_extension.lower() in INLINE_PREVIEW_EXTENSIONS


def supports_text_preview(file_extension: str, mime_type: str) -> bool:
    return file_extension.lower() in TEXT_PREVIEW_EXTENSIONS or mime_type.startswith("text/")


def parse_specific_usernames(raw_value: str | None) -> list[str]:
    if raw_value is None or not raw_value.strip():
        return []

    value = raw_value.strip()
    if value.startswith("["):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="指定用户参数格式不正确") from exc
        if not isinstance(parsed, list):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="指定用户参数格式不正确")
        return [str(item).strip() for item in parsed if str(item).strip()]

    return [item.strip() for item in re.split(r"[\n,]+", value) if item.strip()]


def get_document_by_id(db: Session, document_id: UUID) -> Document | None:
    stmt = (
        select(Document)
        .where(Document.id == document_id)
        .options(
            selectinload(Document.owner),
            selectinload(Document.group),
            selectinload(Document.versions),
            selectinload(Document.assets),
            selectinload(Document.likes),
        )
    )
    return db.scalar(stmt)


def ensure_document_exists(db: Session, document_id: UUID) -> Document:
    document = get_document_by_id(db, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文档不存在")
    return document


def get_latest_version(document: Document) -> DocumentVersion:
    if not document.versions:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="文档缺少版本信息")
    return max(document.versions, key=lambda item: item.version_number)


def get_preview_text_asset(document: Document) -> DocumentAsset | None:
    candidates = [asset for asset in document.assets if asset.asset_kind == DocumentAssetKind.EXTRACTED_TEXT]
    if not candidates:
        return None
    return max(candidates, key=lambda item: (item.asset_order or 0, item.created_at))


def normalize_preview_text(raw_text: str) -> str:
    normalized = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    normalized = normalized.strip()
    return normalized[:200_000]


def extract_preview_text(file_path: Path, *, file_extension: str, mime_type: str) -> str | None:
    try:
        if supports_text_preview(file_extension, mime_type):
            return normalize_preview_text(file_path.read_text(encoding="utf-8", errors="ignore"))

        if os.getenv("PYTEST_CURRENT_TEST"):
            return None

        from tika import parser  # type: ignore

        parsed = parser.from_file(str(file_path))
        content = (parsed.get("content") or "").strip()
        if not content:
            return None
        return normalize_preview_text(content)
    except Exception:
        return None


def build_preview_strategy(document: Document) -> str:
    if supports_inline_preview(document.file_extension, document.mime_type):
        return "browser_inline"
    if supports_text_preview(document.file_extension, document.mime_type) or get_preview_text_asset(document) is not None:
        return "text"
    return "download_only"


def get_group_membership(db: Session, group_id: UUID, user_id: UUID) -> GroupMember | None:
    return db.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )


def ensure_can_upload_to_group(db: Session, group: Group, current_user: User) -> None:
    if group.owner_id == current_user.id:
        return

    membership = get_group_membership(db, group.id, current_user.id)
    if membership is not None:
        return

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前账号不能向该资料组上传文档")


def ensure_can_manage_document(document: Document, current_user: User) -> None:
    if document.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有管理该文档的权限")


def ensure_can_view_document(
    db: Session,
    document: Document,
    current_user: User | None,
    *,
    access_password: str | None = None,
) -> None:
    if current_user is not None and document.owner_id == current_user.id:
        return

    if document.visibility_mode == ResourceVisibility.PUBLIC:
        return

    if document.visibility_mode == ResourceVisibility.OWNER_ONLY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="该文档仅自己可见")

    if document.visibility_mode == ResourceVisibility.GROUP_MEMBERS:
        if current_user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录后才可访问组内文档")
        if document.group_id is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="该文档未配置可访问的资料组")
        membership = get_group_membership(db, document.group_id, current_user.id)
        group = document.group
        if (group and group.owner_id == current_user.id) or membership is not None:
            return
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅资料组成员可访问该文档")

    if document.visibility_mode == ResourceVisibility.SPECIFIC_USERS:
        if current_user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录后才可访问指定用户文档")
        acl_entry = db.scalar(
            select(ACLEntry).where(
                ACLEntry.resource_type == "document",
                ACLEntry.resource_id == document.id,
                ACLEntry.subject_type == ACLSubjectType.USER,
                ACLEntry.subject_id == current_user.id,
                ACLEntry.permission_type == ACLPermissionType.VIEW,
            )
        )
        if acl_entry is not None:
            return
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前账号未被授权访问该文档")

    if document.visibility_mode == ResourceVisibility.PASSWORD:
        passcode = db.scalar(
            select(AccessPasscode).where(
                AccessPasscode.resource_type == "document",
                AccessPasscode.resource_id == document.id,
                AccessPasscode.is_enabled.is_(True),
            )
        )
        if passcode is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="该文档尚未配置访问密码")
        if access_password and verify_password(access_password, passcode.password_hash):
            return
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="访问该文档需要正确的密码")

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有访问该文档的权限")


def sync_document_password_access(
    db: Session,
    *,
    document_id: UUID,
    visibility_mode: ResourceVisibility,
    password: str | None,
    password_hint: str | None,
) -> None:
    stmt = select(AccessPasscode).where(
        AccessPasscode.resource_type == "document",
        AccessPasscode.resource_id == document_id,
    )
    passcode = db.scalar(stmt)

    if visibility_mode != ResourceVisibility.PASSWORD:
        if passcode is not None:
            db.delete(passcode)
            db.flush()
        return

    if not password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="密码访问模式下必须提供访问密码")

    if passcode is None:
        passcode = AccessPasscode(
            resource_type="document",
            resource_id=document_id,
            password_hash=hash_password(password),
            hint=password_hint,
            is_enabled=True,
        )
        db.add(passcode)
    else:
        passcode.password_hash = hash_password(password)
        passcode.hint = password_hint
        passcode.is_enabled = True
    db.flush()


def sync_document_specific_users(
    db: Session,
    *,
    document_id: UUID,
    visibility_mode: ResourceVisibility,
    usernames: list[str],
) -> None:
    delete_stmt = delete(ACLEntry).where(
        ACLEntry.resource_type == "document",
        ACLEntry.resource_id == document_id,
        ACLEntry.subject_type == ACLSubjectType.USER,
        ACLEntry.permission_type == ACLPermissionType.VIEW,
    )

    if visibility_mode != ResourceVisibility.SPECIFIC_USERS:
        db.execute(delete_stmt)
        db.flush()
        return

    users = resolve_users_by_usernames(db, usernames)
    if not users:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="指定用户可见模式下至少需要一个用户")

    db.execute(delete_stmt)
    for user in users:
        db.add(
            ACLEntry(
                resource_type="document",
                resource_id=document_id,
                subject_type=ACLSubjectType.USER,
                subject_id=user.id,
                subject_key=None,
                permission_type=ACLPermissionType.VIEW,
            )
        )
    db.flush()


def list_document_specific_users(db: Session, document_id: UUID) -> list[str]:
    stmt = (
        select(User.username)
        .join(ACLEntry, ACLEntry.subject_id == User.id)
        .where(
            ACLEntry.resource_type == "document",
            ACLEntry.resource_id == document_id,
            ACLEntry.subject_type == ACLSubjectType.USER,
            ACLEntry.permission_type == ACLPermissionType.VIEW,
        )
        .order_by(User.username.asc())
    )
    return list(db.scalars(stmt))


def award_upload_reward(db: Session, user: User, *, document_id: UUID, document_title: str) -> UserCoinAccount:
    account = get_or_create_coin_account(db, user)
    account.balance += UPLOAD_REWARD_COINS
    account.total_earned += UPLOAD_REWARD_COINS
    db.add(
        CoinLedger(
            user_id=user.id,
            change_amount=UPLOAD_REWARD_COINS,
            balance_after=account.balance,
            source_type=CoinLedgerSource.UPLOAD_REWARD,
            related_document_id=document_id,
            remark=f"上传文档奖励：{document_title}",
        )
    )
    db.flush()
    return account


def create_document(
    db: Session,
    *,
    current_user: User,
    title: str,
    summary: str | None,
    category: str | None,
    group_id: UUID | None,
    visibility_mode: ResourceVisibility,
    allow_download: bool,
    password: str | None,
    password_hint: str | None,
    specific_usernames: list[str],
    upload_file: UploadFile,
) -> Document:
    if group_id is not None:
        group = ensure_group_exists(db, group_id)
        ensure_can_upload_to_group(db, group, current_user)
    else:
        group = None

    if visibility_mode == ResourceVisibility.GROUP_MEMBERS and group is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="组内可见的文档必须选择资料组")

    original_file_name = sanitize_file_name(upload_file.filename or "document")
    file_extension = Path(original_file_name).suffix.lstrip(".").lower()
    mime_type = resolve_document_media_type(original_file_name, upload_file.content_type)
    file_type = classify_file_type(file_extension)
    file_content = upload_file.file.read()
    if not file_content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="上传文件不能为空")

    inline_preview_supported = supports_inline_preview(file_extension, mime_type)
    document = Document(
        owner_id=current_user.id,
        group_id=group.id if group is not None else None,
        title=title,
        summary=summary,
        category=category,
        file_type=file_type,
        mime_type=mime_type,
        file_extension=file_extension,
        file_size=len(file_content),
        visibility_mode=visibility_mode,
        preview_status=DocumentPreviewStatus.PENDING,
        allow_download=allow_download,
        extra_metadata={"original_file_name": original_file_name},
    )
    db.add(document)
    db.flush()

    document_storage_dir = DOCUMENT_STORAGE_ROOT / str(document.id)
    document_storage_dir.mkdir(parents=True, exist_ok=True)
    storage_path = document_storage_dir / original_file_name
    storage_path.write_bytes(file_content)
    storage_key = storage_path.relative_to(BACKEND_ROOT).as_posix()

    version = DocumentVersion(
        document_id=document.id,
        version_number=1,
        file_name=original_file_name,
        storage_key=storage_key,
        checksum=sha256(file_content).hexdigest(),
        file_size=len(file_content),
        uploaded_at=datetime.now(UTC),
    )
    db.add(version)
    db.flush()

    db.add(
        DocumentAsset(
            document_id=document.id,
            document_version_id=version.id,
            asset_kind=DocumentAssetKind.ORIGINAL,
            storage_key=storage_key,
            content_type=mime_type,
            page_count=None,
            asset_order=0,
            extra_metadata={"original_file_name": original_file_name},
        )
    )
    db.flush()

    preview_text = extract_preview_text(storage_path, file_extension=file_extension, mime_type=mime_type)
    if preview_text:
        preview_text_path = document_storage_dir / "preview.txt"
        preview_text_path.write_text(preview_text, encoding="utf-8")
        preview_text_storage_key = preview_text_path.relative_to(BACKEND_ROOT).as_posix()
        db.add(
            DocumentAsset(
                document_id=document.id,
                document_version_id=version.id,
                asset_kind=DocumentAssetKind.EXTRACTED_TEXT,
                storage_key=preview_text_storage_key,
                content_type="text/plain",
                page_count=None,
                asset_order=1,
                extra_metadata={"source": "tika_or_text"},
            )
        )
        db.flush()

    sync_document_password_access(
        db,
        document_id=document.id,
        visibility_mode=visibility_mode,
        password=password,
        password_hint=password_hint,
    )
    sync_document_specific_users(
        db,
        document_id=document.id,
        visibility_mode=visibility_mode,
        usernames=specific_usernames,
    )
    document.preview_status = (
        DocumentPreviewStatus.READY
        if inline_preview_supported or get_preview_text_asset(ensure_document_exists(db, document.id)) is not None
        else DocumentPreviewStatus.PENDING
    )
    award_upload_reward(db, current_user, document_id=document.id, document_title=document.title)
    return ensure_document_exists(db, document.id)


def list_my_documents(db: Session, current_user: User) -> list[Document]:
    stmt = (
        select(Document)
        .where(Document.owner_id == current_user.id)
        .options(
            selectinload(Document.owner),
            selectinload(Document.group),
            selectinload(Document.versions),
            selectinload(Document.assets),
            selectinload(Document.likes),
        )
        .order_by(Document.created_at.desc())
    )
    return list(db.scalars(stmt))


def list_public_documents(
    db: Session,
    *,
    q: str | None = None,
    category: str | None = None,
    limit: int = 24,
) -> list[Document]:
    stmt = (
        select(Document)
        .where(Document.visibility_mode == ResourceVisibility.PUBLIC)
        .options(
            selectinload(Document.owner),
            selectinload(Document.group),
            selectinload(Document.versions),
            selectinload(Document.assets),
            selectinload(Document.likes),
        )
        .order_by(Document.read_count.desc(), Document.created_at.desc())
        .limit(limit)
    )

    if q:
        keyword = f"%{q.strip()}%"
        stmt = stmt.where(
            Document.title.ilike(keyword) | Document.summary.ilike(keyword) | Document.category.ilike(keyword)
        )

    if category:
        stmt = stmt.where(Document.category == category.strip())

    return list(db.scalars(stmt))


def add_document_like(db: Session, document: Document, current_user: User) -> Document:
    ensure_can_view_document(db, document, current_user)

    existing_like = db.scalar(
        select(DocumentLike).where(
            DocumentLike.document_id == document.id,
            DocumentLike.user_id == current_user.id,
        )
    )
    if existing_like is not None:
        return ensure_document_exists(db, document.id)

    db.add(DocumentLike(document_id=document.id, user_id=current_user.id))
    document.like_count += 1
    db.flush()
    return ensure_document_exists(db, document.id)


def remove_document_like(db: Session, document: Document, current_user: User) -> Document:
    existing_like = db.scalar(
        select(DocumentLike).where(
            DocumentLike.document_id == document.id,
            DocumentLike.user_id == current_user.id,
        )
    )
    if existing_like is not None:
        db.delete(existing_like)
        if document.like_count > 0:
            document.like_count -= 1
        db.flush()
    return ensure_document_exists(db, document.id)


def donate_document_coins(
    db: Session,
    *,
    document: Document,
    current_user: User,
    coin_amount: int,
) -> tuple[Document, UserCoinAccount, UserCoinAccount]:
    ensure_can_view_document(db, document, current_user)
    if document.owner_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能给自己的文档投币")

    sender_account = get_or_create_coin_account(db, current_user)
    if sender_account.balance < coin_amount:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前余额不足，无法完成投币")

    receiver = db.scalar(select(User).where(User.id == document.owner_id))
    if receiver is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文档拥有者不存在")

    receiver_account = get_or_create_coin_account(db, receiver)
    sender_account.balance -= coin_amount
    sender_account.total_spent += coin_amount
    receiver_account.balance += coin_amount
    receiver_account.total_earned += coin_amount
    document.coin_count += coin_amount

    db.add(
        DocumentCoinRecord(
            document_id=document.id,
            sender_user_id=current_user.id,
            receiver_user_id=receiver.id,
            coin_amount=coin_amount,
        )
    )
    db.add(
        CoinLedger(
            user_id=current_user.id,
            change_amount=-coin_amount,
            balance_after=sender_account.balance,
            source_type=CoinLedgerSource.DOCUMENT_COIN_SPEND,
            related_document_id=document.id,
            related_user_id=receiver.id,
            remark=f"给文档《{document.title}》投币",
        )
    )
    db.add(
        CoinLedger(
            user_id=receiver.id,
            change_amount=coin_amount,
            balance_after=receiver_account.balance,
            source_type=CoinLedgerSource.DOCUMENT_COIN_INCOME,
            related_document_id=document.id,
            related_user_id=current_user.id,
            remark=f"文档《{document.title}》收到投币",
        )
    )
    db.flush()
    return ensure_document_exists(db, document.id), sender_account, receiver_account


def mark_document_read(
    db: Session,
    *,
    document: Document,
    current_user: User | None,
    access_password: str | None = None,
) -> Document:
    ensure_can_view_document(db, document, current_user, access_password=access_password)
    document.read_count += 1
    db.flush()
    return ensure_document_exists(db, document.id)


def mark_document_download(
    db: Session,
    *,
    document: Document,
    current_user: User | None,
    access_password: str | None = None,
) -> Document:
    ensure_can_view_document(db, document, current_user, access_password=access_password)
    if not document.allow_download and (current_user is None or document.owner_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="该文档未开放下载")
    document.download_count += 1
    db.flush()
    return ensure_document_exists(db, document.id)


def get_document_file_path(document: Document) -> Path:
    latest_version = get_latest_version(document)
    file_path = BACKEND_ROOT / latest_version.storage_key
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文档源文件不存在")
    return file_path


def get_document_preview_text_path(document: Document) -> Path:
    if supports_text_preview(document.file_extension, document.mime_type):
        return get_document_file_path(document)

    preview_asset = get_preview_text_asset(document)
    if preview_asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="当前文档暂未生成文本预览")

    file_path = BACKEND_ROOT / preview_asset.storage_key
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文档预览文本不存在")
    return file_path


def has_document_preview_text(document: Document) -> bool:
    try:
        return get_document_preview_text_path(document).exists()
    except HTTPException:
        return False


def count_document_likes_for_user(document: Document, user_id: UUID | None) -> bool:
    if user_id is None:
        return False
    return any(item.user_id == user_id for item in document.likes)


def count_document_password_enabled(db: Session, document_id: UUID) -> bool:
    passcode_count = db.scalar(
        select(func.count(AccessPasscode.id)).where(
            AccessPasscode.resource_type == "document",
            AccessPasscode.resource_id == document_id,
            AccessPasscode.is_enabled.is_(True),
        )
    )
    return bool(passcode_count)
