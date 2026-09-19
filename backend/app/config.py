from functools import lru_cache

from pydantic import field_validator, model_validator
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

    @model_validator(mode="after")
    def require_safe_production_configuration(self) -> "Settings":
        """Fail closed when a deployment was started with prototype defaults."""
        if self.environment != "production":
            return self
        if self.secret_key == "development-only-secret-change-before-deployment" or len(self.secret_key) < 32:
            raise ValueError("SECRET_KEY must be a unique value of at least 32 characters in production")
        if self.auto_seed:
            raise ValueError("AUTO_SEED must be false in production")
        if self.database_url.startswith("sqlite"):
            raise ValueError("DATABASE_URL must point to PostgreSQL in production")
        if not self.frontend_origins or any(not origin.startswith("https://") for origin in self.frontend_origins):
            raise ValueError("FRONTEND_ORIGINS must contain explicit HTTPS origins in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
