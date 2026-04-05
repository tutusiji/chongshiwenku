from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    app_name: str = Field(default="崇实文库 API", validation_alias=AliasChoices("APP_NAME"))
    environment: str = Field(default="development", validation_alias=AliasChoices("APP_ENVIRONMENT"))
    debug: bool = Field(default=True, validation_alias=AliasChoices("APP_DEBUG"))
    api_v1_prefix: str = Field(default="/api/v1", validation_alias=AliasChoices("APP_API_V1_PREFIX"))

    postgres_dsn: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/chongshiwenku",
        validation_alias=AliasChoices("APP_POSTGRES_DSN"),
    )
    redis_url: str = Field(default="redis://localhost:6379/0", validation_alias=AliasChoices("APP_REDIS_URL"))

    s3_endpoint_url: str = Field(default="http://localhost:9000", validation_alias=AliasChoices("APP_S3_ENDPOINT_URL"))
    s3_access_key: str = Field(default="minioadmin", validation_alias=AliasChoices("APP_S3_ACCESS_KEY"))
    s3_secret_key: str = Field(default="minioadmin", validation_alias=AliasChoices("APP_S3_SECRET_KEY"))
    s3_bucket: str = Field(default="chongshiwenku", validation_alias=AliasChoices("APP_S3_BUCKET"))

    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        validation_alias=AliasChoices("APP_CORS_ORIGINS"),
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
