from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from flask import Flask
from flask.testing import FlaskClient

from corkathon_api.app import create_app
from corkathon_api.database import db
from corkathon_api.settings import Settings

TEST_SECRET = "test-secret-that-is-long-enough-for-hs256"
PASSWORD = "correct horse battery"


def make_settings(tmp_path: Path, **overrides: object) -> Settings:
    values: dict[str, object] = {
        "jwt_secret_key": TEST_SECRET,
        "database_url": f"sqlite:///{tmp_path / 'test.db'}",
        "web_dist": tmp_path / "dist",
        "auth_rate_limit_per_minute": 1000,
        # pinned so a developer's own .env allowlist never leaks into tests
        "allowed_emails": "",
        "filings_build_in_background": False,
    }
    return Settings(**{**values, **overrides})  # type: ignore[arg-type]


@pytest.fixture
def build_app(tmp_path: Path) -> Iterator[Callable[..., Flask]]:
    built: list[Flask] = []

    def build(**overrides: object) -> Flask:
        built.append(create_app(make_settings(tmp_path, **overrides)))
        return built[-1]

    yield build
    # open sqlite handles stop windows deleting tmp_path and raise ResourceWarning
    for app in built:
        with app.app_context():
            db.engine.dispose()


@pytest.fixture
def app(build_app: Callable[..., Flask]) -> Flask:
    return build_app()


@pytest.fixture
def client(app: Flask) -> FlaskClient:
    return app.test_client()


def csrf_headers(client: FlaskClient) -> dict[str, str]:
    cookie = client.get_cookie("csrf_access_token")
    assert cookie is not None
    return {"X-CSRF-TOKEN": cookie.value}


def sign_up(client: FlaskClient, email: str) -> None:
    response = client.post("/api/auth/register", json={"email": email, "password": PASSWORD})
    assert response.status_code == 201
