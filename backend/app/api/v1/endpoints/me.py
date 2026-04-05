from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import MeResponse
from app.schemas.coins import CheckinResponse, CoinAccountDetailResponse, CoinLedgerListResponse
from app.services.coins import get_coin_account, list_coin_ledgers, perform_daily_checkin

router = APIRouter()


@router.get("", response_model=MeResponse)
def read_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MeResponse:
    coin_account = get_coin_account(db, current_user.id)
    return MeResponse(user=current_user, coin_account=coin_account)


@router.get("/coins", response_model=CoinAccountDetailResponse)
def read_my_coins(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoinAccountDetailResponse:
    coin_account = get_coin_account(db, current_user.id)
    if coin_account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="积分账户不存在")
    return CoinAccountDetailResponse.model_validate(coin_account)


@router.get("/coin-ledgers", response_model=CoinLedgerListResponse)
def read_my_coin_ledgers(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoinLedgerListResponse:
    return CoinLedgerListResponse(items=list_coin_ledgers(db, current_user.id, limit=limit))


@router.post("/checkins", response_model=CheckinResponse)
def daily_checkin(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CheckinResponse:
    try:
        checkin, coin_account = perform_daily_checkin(db, current_user)
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return CheckinResponse(
        checkin_date=checkin.checkin_date,
        reward_coins=checkin.reward_coins,
        balance=coin_account.balance,
        message="签到成功，已发放 2 个币",
    )
