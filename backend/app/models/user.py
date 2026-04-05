from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SQLEnum, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import UserStatus

if TYPE_CHECKING:
    from app.models.coin_ledger import CoinLedger
    from app.models.document import Document
    from app.models.document_coin_record import DocumentCoinRecord
    from app.models.document_like import DocumentLike
    from app.models.group import Group
    from app.models.group_member import GroupMember
    from app.models.user_checkin import UserCheckin
    from app.models.user_coin_account import UserCoinAccount


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[str] = mapped_column(String(80), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[UserStatus] = mapped_column(
        SQLEnum(UserStatus, name="user_status"),
        nullable=False,
        default=UserStatus.ACTIVE,
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owned_groups: Mapped[list["Group"]] = relationship(back_populates="owner")
    group_memberships: Mapped[list["GroupMember"]] = relationship(back_populates="user")
    uploaded_documents: Mapped[list["Document"]] = relationship(back_populates="owner")
    coin_account: Mapped["UserCoinAccount | None"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    coin_ledgers: Mapped[list["CoinLedger"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="CoinLedger.user_id",
    )
    checkins: Mapped[list["UserCheckin"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    liked_documents: Mapped[list["DocumentLike"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    sent_coin_records: Mapped[list["DocumentCoinRecord"]] = relationship(
        back_populates="sender_user",
        cascade="all, delete-orphan",
        foreign_keys="DocumentCoinRecord.sender_user_id",
    )
    received_coin_records: Mapped[list["DocumentCoinRecord"]] = relationship(
        back_populates="receiver_user",
        cascade="all, delete-orphan",
        foreign_keys="DocumentCoinRecord.receiver_user_id",
    )
