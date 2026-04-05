from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.business_rules import DAILY_CHECKIN_BONUS_COINS
from app.models.coin_ledger import CoinLedger
from app.models.enums import CoinLedgerSource
from app.models.user import User
from app.models.user_checkin import UserCheckin
from app.models.user_coin_account import UserCoinAccount


def get_or_create_coin_account(db: Session, user: User) -> UserCoinAccount:
    account = db.scalar(select(UserCoinAccount).where(UserCoinAccount.user_id == user.id))
    if account is None:
        account = UserCoinAccount(user_id=user.id, balance=0, total_earned=0, total_spent=0)
        db.add(account)
        db.flush()
    return account


def get_coin_account(db: Session, user_id) -> UserCoinAccount | None:
    return db.scalar(select(UserCoinAccount).where(UserCoinAccount.user_id == user_id))


def list_coin_ledgers(db: Session, user_id, *, limit: int = 20) -> list[CoinLedger]:
    stmt = (
        select(CoinLedger)
        .where(CoinLedger.user_id == user_id)
        .order_by(CoinLedger.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))


def perform_daily_checkin(db: Session, user: User) -> tuple[UserCheckin, UserCoinAccount]:
    today = datetime.now().date()
    existing = db.scalar(
        select(UserCheckin).where(
            UserCheckin.user_id == user.id,
            UserCheckin.checkin_date == today,
        )
    )
    if existing is not None:
        raise ValueError("今天已经签到过了")

    account = get_or_create_coin_account(db, user)
    account.balance += DAILY_CHECKIN_BONUS_COINS
    account.total_earned += DAILY_CHECKIN_BONUS_COINS

    checkin = UserCheckin(
        user_id=user.id,
        checkin_date=today,
        reward_coins=DAILY_CHECKIN_BONUS_COINS,
    )
    db.add(checkin)
    db.flush()

    db.add(
        CoinLedger(
            user_id=user.id,
            change_amount=DAILY_CHECKIN_BONUS_COINS,
            balance_after=account.balance,
            source_type=CoinLedgerSource.DAILY_CHECKIN_REWARD,
            remark="每日签到奖励",
        )
    )
    db.flush()
    return checkin, account
