from pathlib import Path

import pytest
from pydantic import ValidationError

from conftest import make_settings
from corkathon_api.settings import Settings


def test_rejects_a_short_jwt_secret(tmp_path: Path) -> None:
    with pytest.raises(ValidationError):
        make_settings(tmp_path, jwt_secret_key="short")


def test_rejects_an_unknown_app_env(tmp_path: Path) -> None:
    with pytest.raises(ValidationError):
        make_settings(tmp_path, app_env="staging")


def test_crashes_at_boot_without_a_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_secret_stays_out_of_the_repr(tmp_path: Path) -> None:
    settings = make_settings(tmp_path)
    assert settings.jwt_secret_key.get_secret_value() not in repr(settings)
