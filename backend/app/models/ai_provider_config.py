from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AIProviderConfig(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_provider_configs"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    provider_code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    provider_type: Mapped[str] = mapped_column(String(64), nullable=False)
    base_url: Mapped[str] = mapped_column(String(512), nullable=False)
    api_key: Mapped[str] = mapped_column(Text, nullable=False)
    wire_api: Mapped[str] = mapped_column(String(64), nullable=False, default="responses")
    model_name: Mapped[str] = mapped_column(String(120), nullable=False)
    reasoning_effort: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
