from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


DEVELOPMENT_SECRET = "development-only-secret-change-before-deployment"


class Settings(BaseSettings):
    app_name: str = "MPLADS Sentinel API"
    environment: Literal["development", "test", "staging", "production"] = "development"
    database_url: str = "sqlite:///./mplads_sentinel.db"
    secret_key: str = Field(default=DEVELOPMENT_SECRET, min_length=32)
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    frontend_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    development_origin_regex: str = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
    auto_seed: bool = True
    redis_url: str | None = None
    max_request_bytes: int = 1_048_576

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("frontend_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def reject_unsafe_production_settings(self) -> "Settings":
        if self.environment != "development":
            if self.secret_key == DEVELOPMENT_SECRET:
                raise ValueError("SECRET_KEY must be replaced before deployed startup")
            if self.auto_seed:
                raise ValueError("AUTO_SEED must be disabled before deployed startup")
            if self.database_url.startswith("sqlite"):
                raise ValueError("DATABASE_URL must use PostgreSQL before deployed startup")
            if not self.redis_url or not self.redis_url.startswith(("redis://", "rediss://")):
                raise ValueError("REDIS_URL is required for deployed rate limiting")
            if not self.frontend_origins or any(not origin.startswith("https://") for origin in self.frontend_origins):
                raise ValueError("FRONTEND_ORIGINS must contain explicit HTTPS origins when deployed")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
