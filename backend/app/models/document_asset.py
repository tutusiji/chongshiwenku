from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import Enum as SQLEnum, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import DocumentAssetKind

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.document_version import DocumentVersion


class DocumentAsset(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_assets"

    document_id: Mapped[UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    document_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("document_versions.id", ondelete="CASCADE"),
        index=True,
    )
    asset_kind: Mapped[DocumentAssetKind] = mapped_column(
        SQLEnum(DocumentAssetKind, name="document_asset_kind"),
        nullable=False,
    )
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    asset_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    extra_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    document: Mapped["Document"] = relationship(back_populates="assets")
    document_version: Mapped["DocumentVersion"] = relationship(back_populates="assets")
