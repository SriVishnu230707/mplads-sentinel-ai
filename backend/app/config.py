from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "MPLADS Sentinel API"
    environment: str = "development"
    database_url: str = "sqlite:///./mplads_sentinel.db"
    secret_key: str = "development-only-secret-change-before-deployment"
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    frontend_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    development_origin_regex: str = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
    auto_seed: bool = True

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("frontend_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
