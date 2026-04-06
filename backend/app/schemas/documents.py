from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DocumentOwnerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    nickname: str


class DocumentResponse(BaseModel):
    id: UUID
    group_id: UUID | None
    title: str
    summary: str | None
    category: str | None
    file_name: str
    file_type: str
    mime_type: str
    file_extension: str
    file_size: int
    visibility_mode: str
    status: str
    preview_status: str
    allow_download: bool
    read_count: int
    like_count: int
    coin_count: int
    download_count: int
    password_enabled: bool
    my_liked: bool
    owner: DocumentOwnerResponse
    created_at: datetime
    updated_at: datetime


class DocumentDetailResponse(DocumentResponse):
    specific_usernames: list[str]
    latest_storage_key: str
    inline_preview_supported: bool
    preview_text_available: bool
    preview_strategy: str


class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]


class DocumentLikeResponse(BaseModel):
    liked: bool
    like_count: int


class DocumentCoinRequest(BaseModel):
    coin_amount: int = Field(ge=1, le=100)


class DocumentCoinResponse(BaseModel):
    coin_amount: int
    my_balance: int
    document_coin_count: int
    owner_balance: int
    message: str
