from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.business_rules import REGISTER_BONUS_COINS
from app.core.security import hash_password, verify_password
from app.models.coin_ledger import CoinLedger
from app.models.enums import CoinLedgerSource
from app.models.user import User
from app.models.user_coin_account import UserCoinAccount


def get_user_by_account(db: Session, account: str) -> User | None:
    return db.scalar(
        select(User).where(
            or_(
                User.username == account,
                User.email == account,
                User.phone == account,
            )
        )
    )


def register_user(
    db: Session,
    *,
    username: str,
    password: str,
    nickname: str,
    email: str | None = None,
    phone: str | None = None,
) -> tuple[User, UserCoinAccount]:
    user = User(
        username=username,
        email=email,
        phone=phone,
        nickname=nickname,
        password_hash=hash_password(password),
    )
    db.add(user)
    db.flush()

    coin_account = UserCoinAccount(
        user_id=user.id,
        balance=REGISTER_BONUS_COINS,
        total_earned=REGISTER_BONUS_COINS,
        total_spent=0,
    )
    db.add(coin_account)
    db.flush()

    db.add(
        CoinLedger(
            user_id=user.id,
            change_amount=REGISTER_BONUS_COINS,
            balance_after=coin_account.balance,
            source_type=CoinLedgerSource.REGISTER_BONUS,
            remark="新用户注册奖励",
        )
    )
    db.flush()
    return user, coin_account


def authenticate_user(db: Session, *, account: str, password: str) -> User | None:
    user = get_user_by_account(db, account)
    if user is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user
