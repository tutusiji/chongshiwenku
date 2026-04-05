from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, RegisterResponse, TokenResponse
from app.services.auth import authenticate_user, get_user_by_account, register_user
from app.services.coins import get_coin_account

router = APIRouter()


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> RegisterResponse:
    if get_user_by_account(db, payload.username) is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已存在")

    if payload.email and db.scalar(select(User).where(User.email == payload.email)) is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邮箱已存在")

    if payload.phone and db.scalar(select(User).where(User.phone == payload.phone)) is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="手机号已存在")

    nickname = payload.nickname or payload.username

    try:
        user, coin_account = register_user(
            db,
            username=payload.username,
            password=payload.password,
            nickname=nickname,
            email=payload.email,
            phone=payload.phone,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户注册失败，请检查提交信息") from exc

    db.refresh(user)
    db.refresh(coin_account)
    return RegisterResponse(
        user=user,
        coin_account=coin_account,
        message="注册成功，已发放 100 个初始币",
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate_user(db, account=payload.account, password=payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号或密码错误")

    coin_account = get_coin_account(db, user.id)
    token, expires_in = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        expires_in=expires_in,
        user=user,
        coin_account=coin_account,
    )
