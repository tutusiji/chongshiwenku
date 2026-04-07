from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.ai_provider_config import AIProviderConfig
from app.models.coin_ledger import CoinLedger
from app.models.enums import CoinLedgerSource
from app.models.user import User
from app.models.user_coin_account import UserCoinAccount
from app.models.base import Base

ADMIN_USERNAME = "tutusiji"
ADMIN_PASSWORD = "@huangkun123"
ADMIN_EMAIL = "tutusiji@admin.local"

DEFAULT_AI_PROVIDER_CONFIGS: Sequence[dict[str, object]] = (
    {
        "name": "RightCode GPT-5.4",
        "provider_code": "rightcode_gpt54",
        "provider_type": "rightcode",
        "base_url": "https://right.codes/codex/v1",
        "api_key": "sk-0623c866709c4b488bd663407c12bb24",
        "wire_api": "responses",
        "model_name": "gpt-5.4",
        "reasoning_effort": "xhigh",
        "is_enabled": True,
        "is_default": True,
        "notes": "默认 GPT 编码模型，按用户提供的 right.codes 接入信息预置。",
        "extra_metadata": {
            "wire_api": "responses",
            "model_provider": "rightcode",
        },
    },
    {
        "name": "Kimi Code",
        "provider_code": "kimi_code",
        "provider_type": "kimi",
        "base_url": "https://api.kimi.com/coding/v1",
        "api_key": "sk-kimi-laauD2PPvD3nkT8wojktvF0gG6Gp9UP0X6pDyPRweyIpqe8fPGcZe9lFq1wvZvm6",
        "wire_api": "chat_completions",
        "model_name": "kimi-for-coding",
        "reasoning_effort": None,
        "is_enabled": True,
        "is_default": False,
        "notes": "Kimi Code 编码模型配置，适合生成摘要与代码类说明。",
        "extra_metadata": {
            "docs_url": "https://www.kimi.com/code/docs/kimi-cli/guides/getting-started.html",
        },
    },
)


def ensure_column_exists(engine: Engine, table_name: str, column_name: str, column_ddl: str) -> None:
    inspector = inspect(engine)
    existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
    if column_name in existing_columns:
        return

    with engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_ddl}"))


def run_schema_migrations(engine: Engine) -> None:
    Base.metadata.create_all(bind=engine)

    if engine.dialect.name == "sqlite":
        ensure_column_exists(engine, "users", "is_admin", "BOOLEAN NOT NULL DEFAULT 0")
        ensure_column_exists(engine, "groups", "parent_group_id", "CHAR(32)")
        return

    ensure_column_exists(engine, "users", "is_admin", "BOOLEAN NOT NULL DEFAULT FALSE")
    ensure_column_exists(engine, "groups", "parent_group_id", "UUID")


def seed_admin_user() -> None:
    with SessionLocal() as db:
        admin_user = db.query(User).filter(User.username == ADMIN_USERNAME).one_or_none()
        if admin_user is None:
            admin_user = User(
                username=ADMIN_USERNAME,
                email=ADMIN_EMAIL,
                phone=None,
                nickname=ADMIN_USERNAME,
                password_hash=hash_password(ADMIN_PASSWORD),
                is_admin=True,
            )
            db.add(admin_user)
            db.flush()

            coin_account = UserCoinAccount(
                user_id=admin_user.id,
                balance=100,
                total_earned=100,
                total_spent=0,
            )
            db.add(coin_account)
            db.flush()

            db.add(
                CoinLedger(
                    user_id=admin_user.id,
                    change_amount=100,
                    balance_after=100,
                    source_type=CoinLedgerSource.REGISTER_BONUS,
                    remark="管理员初始化账户",
                )
            )
        else:
            admin_user.is_admin = True
            admin_user.password_hash = hash_password(ADMIN_PASSWORD)
            if not admin_user.email:
                admin_user.email = ADMIN_EMAIL
            if not admin_user.nickname:
                admin_user.nickname = ADMIN_USERNAME

        db.commit()


def seed_ai_provider_configs() -> None:
    with SessionLocal() as db:
        existing_configs = {
            item.provider_code: item
            for item in db.query(AIProviderConfig).all()
        }

        for payload in DEFAULT_AI_PROVIDER_CONFIGS:
            provider_code = payload["provider_code"]
            config = existing_configs.get(provider_code)
            if config is None:
                config = AIProviderConfig(**payload)
                db.add(config)
                continue

            for key, value in payload.items():
                setattr(config, key, value)

        db.commit()


def bootstrap_application(engine: Engine) -> None:
    run_schema_migrations(engine)
    seed_admin_user()
    seed_ai_provider_configs()
