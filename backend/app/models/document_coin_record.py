from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.user import User


class DocumentCoinRecord(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_coin_records"

    document_id: Mapped[UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    receiver_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    coin_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    document: Mapped["Document"] = relationship(back_populates="coin_records")
    sender_user: Mapped["User"] = relationship(
        back_populates="sent_coin_records",
        foreign_keys=[sender_user_id],
    )
    receiver_user: Mapped["User"] = relationship(
        back_populates="received_coin_records",
        foreign_keys=[receiver_user_id],
    )
