from uuid import UUID

from sqlalchemy import Enum as SQLEnum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ACLPermissionType, ACLSubjectType


class ACLEntry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "acl_entries"

    resource_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    resource_id: Mapped[UUID] = mapped_column(nullable=False, index=True)
    subject_type: Mapped[ACLSubjectType] = mapped_column(
        SQLEnum(ACLSubjectType, name="acl_subject_type"),
        nullable=False,
    )
    subject_id: Mapped[UUID | None] = mapped_column(nullable=True, index=True)
    subject_key: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    permission_type: Mapped[ACLPermissionType] = mapped_column(
        SQLEnum(ACLPermissionType, name="acl_permission_type"),
        nullable=False,
    )
