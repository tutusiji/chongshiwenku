from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CoinAccountDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    balance: int
    total_earned: int
    total_spent: int


class CoinLedgerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    change_amount: int
    balance_after: int
    source_type: str
    related_document_id: UUID | None
    related_user_id: UUID | None
    remark: str | None
    created_at: datetime


class CoinLedgerListResponse(BaseModel):
    items: list[CoinLedgerResponse]


class CheckinResponse(BaseModel):
    checkin_date: date
    reward_coins: int
    balance: int
    message: str
