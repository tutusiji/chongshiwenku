from uuid import UUID

from sqlalchemy import Boolean, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AccessPasscode(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "access_passcodes"
    __table_args__ = (
        UniqueConstraint("resource_type", "resource_id", name="uq_access_passcodes_resource"),
    )

    resource_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    resource_id: Mapped[UUID] = mapped_column(nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    hint: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
