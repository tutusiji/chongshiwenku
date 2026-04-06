from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GroupOwnerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    nickname: str


class GroupMemberUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    nickname: str
    email: str | None


class GroupMemberResponse(BaseModel):
    role: str
    joined_at: datetime
    user: GroupMemberUserResponse


class GroupResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: str | None
    cover_url: str | None
    visibility_mode: str
    status: str
    allow_member_invite: bool
    member_count: int
    my_role: str | None
    password_enabled: bool
    owner: GroupOwnerResponse
    created_at: datetime
    updated_at: datetime


class GroupDetailResponse(GroupResponse):
    members: list[GroupMemberResponse]
    specific_users: list[GroupMemberUserResponse]


class GroupListResponse(BaseModel):
    items: list[GroupResponse]


class GroupCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    visibility_mode: str = Field(default="public")
    allow_member_invite: bool = True
    password: str | None = Field(default=None, min_length=4, max_length=64)
    password_hint: str | None = Field(default=None, max_length=120)
    specific_usernames: list[str] = Field(default_factory=list)


class GroupUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    visibility_mode: str | None = None
    allow_member_invite: bool | None = None
    password: str | None = Field(default=None, min_length=4, max_length=64)
    password_hint: str | None = Field(default=None, max_length=120)
    specific_usernames: list[str] | None = None


class GroupMemberCreateRequest(BaseModel):
    username: str
    role: str = Field(default="member")
