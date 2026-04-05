from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.user import User


class DocumentLike(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_likes"
    __table_args__ = (
        UniqueConstraint("document_id", "user_id", name="uq_document_likes_document_user"),
    )

    document_id: Mapped[UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    document: Mapped["Document"] = relationship(back_populates="likes")
    user: Mapped["User"] = relationship(back_populates="liked_documents")
