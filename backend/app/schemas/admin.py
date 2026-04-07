from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class AdminOverviewResponse(BaseModel):
    users_count: int
    documents_count: int
    groups_count: int
    public_documents_count: int
    ai_provider_count: int
    enabled_ai_provider_count: int


class AdminUserSummaryResponse(BaseModel):
    id: UUID
    username: str
    nickname: str
    email: str | None
    phone: str | None
    status: str
    is_admin: bool
    document_count: int
    group_count: int
    coin_balance: int
    created_at: datetime
    updated_at: datetime


class AdminUserListResponse(BaseModel):
    items: list[AdminUserSummaryResponse]


class AdminUserUpdateRequest(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=64)
    nickname: str | None = Field(default=None, max_length=80)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    status: str | None = None
    is_admin: bool | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)


class AdminDocumentSummaryResponse(BaseModel):
    id: UUID
    title: str
    summary: str | None
    category: str | None
    owner_username: str
    group_name: str | None
    file_name: str
    file_extension: str
    file_size: int
    page_count: int | None
    visibility_mode: str
    status: str
    preview_status: str
    allow_download: bool
    read_count: int
    like_count: int
    coin_count: int
    download_count: int
    created_at: datetime
    updated_at: datetime


class AdminDocumentListResponse(BaseModel):
    items: list[AdminDocumentSummaryResponse]


class AdminDocumentUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    summary: str | None = None
    category: str | None = Field(default=None, max_length=80)
    group_id: UUID | None = None
    visibility_mode: str | None = None
    status: str | None = None
    allow_download: bool | None = None
    password: str | None = Field(default=None, min_length=4, max_length=128)
    password_hint: str | None = Field(default=None, max_length=255)
    specific_usernames: list[str] | None = None


class AdminAIProviderSummaryResponse(BaseModel):
    id: UUID
    name: str
    provider_code: str
    provider_type: str
    base_url: str
    wire_api: str
    model_name: str
    reasoning_effort: str | None
    api_key_masked: str
    is_enabled: bool
    is_default: bool
    usage_count: int
    last_used_at: datetime | None
    last_error: str | None
    notes: str | None
    extra_metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class AdminAIProviderListResponse(BaseModel):
    items: list[AdminAIProviderSummaryResponse]


class AdminAIProviderCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    provider_code: str = Field(min_length=2, max_length=64)
    provider_type: str = Field(min_length=2, max_length=64)
    base_url: str = Field(min_length=4, max_length=512)
    api_key: str = Field(min_length=6)
    wire_api: str = Field(default="responses", min_length=2, max_length=64)
    model_name: str = Field(min_length=2, max_length=120)
    reasoning_effort: str | None = Field(default=None, max_length=32)
    is_enabled: bool = True
    is_default: bool = False
    notes: str | None = None
    extra_metadata: dict[str, Any] | None = None


class AdminAIProviderUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    provider_code: str | None = Field(default=None, min_length=2, max_length=64)
    provider_type: str | None = Field(default=None, min_length=2, max_length=64)
    base_url: str | None = Field(default=None, min_length=4, max_length=512)
    api_key: str | None = Field(default=None, min_length=6)
    wire_api: str | None = Field(default=None, min_length=2, max_length=64)
    model_name: str | None = Field(default=None, min_length=2, max_length=120)
    reasoning_effort: str | None = Field(default=None, max_length=32)
    is_enabled: bool | None = None
    is_default: bool | None = None
    notes: str | None = None
    extra_metadata: dict[str, Any] | None = None
