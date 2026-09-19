import pytest
from pydantic import ValidationError

from app.config import DEVELOPMENT_SECRET, Settings


def test_production_rejects_development_secret():
    with pytest.raises(ValidationError, match="SECRET_KEY must be replaced"):
        Settings(
            _env_file=None,
            environment="production",
            auto_seed=False,
            secret_key=DEVELOPMENT_SECRET,
        )


def test_production_rejects_demo_auto_seed():
    with pytest.raises(ValidationError, match="AUTO_SEED must be disabled"):
        Settings(
            _env_file=None,
            environment="production",
            auto_seed=True,
            secret_key="production-test-secret-with-at-least-32-characters",
        )


def test_production_accepts_hardened_configuration():
    settings = Settings(
        _env_file=None,
        environment="production",
        auto_seed=False,
        secret_key="production-test-secret-with-at-least-32-characters",
    )
    assert settings.environment == "production"
