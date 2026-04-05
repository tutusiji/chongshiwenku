from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import User


class UserCheckin(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_checkins"
    __table_args__ = (
        UniqueConstraint("user_id", "checkin_date", name="uq_user_checkins_user_date"),
    )

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    checkin_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    reward_coins: Mapped[int] = mapped_column(Integer, nullable=False, default=2)

    user: Mapped["User"] = relationship(back_populates="checkins")
