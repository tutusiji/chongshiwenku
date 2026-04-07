from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: str | None = None
    phone: str | None = None
    password: str = Field(min_length=6, max_length=128)
    nickname: str | None = Field(default=None, max_length=80)


class LoginRequest(BaseModel):
    account: str
    password: str = Field(min_length=6, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    email: str | None
    phone: str | None
    nickname: str
    avatar_url: str | None
    bio: str | None
    is_admin: bool
    status: str
    created_at: datetime
    updated_at: datetime


class CoinAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    balance: int
    total_earned: int
    total_spent: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
    coin_account: CoinAccountResponse


class RegisterResponse(BaseModel):
    user: UserResponse
    coin_account: CoinAccountResponse
    message: str


class MeResponse(BaseModel):
    user: UserResponse
    coin_account: CoinAccountResponse | None
