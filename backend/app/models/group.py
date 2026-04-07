from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, Enum as SQLEnum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ResourceStatus, ResourceVisibility

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.group_member import GroupMember
    from app.models.user import User


class Group(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "groups"

    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    parent_group_id: Mapped[UUID | None] = mapped_column(ForeignKey("groups.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
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
    allow_member_invite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    owner: Mapped["User"] = relationship(back_populates="owned_groups")
    parent_group: Mapped["Group | None"] = relationship(remote_side="Group.id", back_populates="child_groups")
    child_groups: Mapped[list["Group"]] = relationship(back_populates="parent_group")
    members: Mapped[list["GroupMember"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
    )
    documents: Mapped[list["Document"]] = relationship(back_populates="group")
