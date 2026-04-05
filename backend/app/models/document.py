from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import BigInteger, Boolean, Enum as SQLEnum, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import DocumentPreviewStatus, ResourceStatus, ResourceVisibility

if TYPE_CHECKING:
    from app.models.document_asset import DocumentAsset
    from app.models.document_version import DocumentVersion
    from app.models.group import Group
    from app.models.user import User


class Document(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "documents"

    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    group_id: Mapped[UUID | None] = mapped_column(ForeignKey("groups.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    file_type: Mapped[str] = mapped_column(String(32), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    file_extension: Mapped[str] = mapped_column(String(20), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    visibility_mode: Mapped[ResourceVisibility] = mapped_column(
        SQLEnum(ResourceVisibility, name="resource_visibility"),
        nullable=False,
        default=ResourceVisibility.PUBLIC,
    )
    status: Mapped[ResourceStatus] = mapped_column(
        SQLEnum(ResourceStatus, name="resource_status"),
        nullable=False,
        default=ResourceStatus.ACTIVE,
    )
    preview_status: Mapped[DocumentPreviewStatus] = mapped_column(
        SQLEnum(DocumentPreviewStatus, name="document_preview_status"),
        nullable=False,
        default=DocumentPreviewStatus.PENDING,
    )
    allow_download: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    view_count: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    download_count: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    extra_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    owner: Mapped["User"] = relationship(back_populates="uploaded_documents")
    group: Mapped["Group | None"] = relationship(back_populates="documents")
    versions: Mapped[list["DocumentVersion"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
    )
    assets: Mapped[list["DocumentAsset"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
    )
