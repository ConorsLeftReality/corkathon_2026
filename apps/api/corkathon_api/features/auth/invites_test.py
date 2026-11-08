from collections.abc import Callable
from datetime import timedelta

import pytest
from flask import Flask
from flask.testing import FlaskClient

from conftest import invite, register
from corkathon_api.database import db
from corkathon_api.features.auth.invites import Invite, create_invite, list_invites, revoke_invite
from corkathon_api.invites import main


def error_code(client: FlaskClient, email: str, **overrides: object) -> str:
    response = register(client, email, **overrides)
    assert response.status_code == 403
    assert response.json is not None
    assert client.get_cookie("access_token_cookie") is None
    code: str = response.json["error"]["code"]
    return code


def test_sign_up_without_an_invite_is_refused(client: FlaskClient) -> None:
    assert error_code(client, "ada@example.com", invite=None) == "invite_invalid"


def test_a_wrong_token_is_refused(client: FlaskClient) -> None:
    invite(client, "ada@example.com")
    assert error_code(client, "ada@example.com", invite="not-the-token") == "invite_invalid"


def test_an_invite_only_works_for_its_own_email(client: FlaskClient) -> None:
    token = invite(client, "ada@example.com")
    assert error_code(client, "grace@example.com", invite=token) == "invite_invalid"


def test_an_invite_works_once(client: FlaskClient) -> None:
    token = invite(client, "ada@example.com")
    assert register(client, "ada@example.com", invite=token).status_code == 201
    client.delete_cookie("access_token_cookie")
    assert error_code(client, "ada@example.com", invite=token) == "invite_invalid"


def test_an_expired_invite_is_refused(app: Flask) -> None:
    client = app.test_client()
    token = invite(client, "ada@example.com")
    with app.app_context():
        stored = db.session.query(Invite).one()
        stored.expires_at -= timedelta(days=8)
        db.session.commit()
    assert error_code(client, "ada@example.com", invite=token) == "invite_invalid"


def test_a_new_invite_replaces_the_old_link(client: FlaskClient) -> None:
    old = invite(client, "ada@example.com")
    invite(client, "ada@example.com")
    assert error_code(client, "ada@example.com", invite=old) == "invite_invalid"


def test_a_taken_email_keeps_its_invite_for_a_retry(app: Flask) -> None:
    client = app.test_client()
    assert register(client, "ada@example.com").status_code == 201
    token = invite(client, "ada@example.com")
    assert register(client, "ada@example.com", invite=token).status_code == 409
    # the failed insert rolled back, so the invite is still there
    with app.app_context():
        assert [i.email for i in list_invites()] == ["ada@example.com"]


def test_the_token_is_never_stored(app: Flask) -> None:
    with app.app_context():
        token = create_invite("ada@example.com")
        stored = db.session.query(Invite).one()
        assert token not in stored.token_hash


def test_revoking_stops_the_link(client: FlaskClient) -> None:
    token = invite(client, "ada@example.com")
    with client.application.app_context():
        assert revoke_invite("ADA@example.com")
        assert not revoke_invite("ada@example.com")
    assert error_code(client, "ada@example.com", invite=token) == "invite_invalid"


def test_development_without_the_setting_needs_no_invite(
    build_app: Callable[..., Flask],
) -> None:
    client = build_app(invites_required=None).test_client()
    assert register(client, "ada@example.com", invite=None).status_code == 201


def test_production_without_the_setting_needs_an_invite(
    build_app: Callable[..., Flask],
) -> None:
    app = build_app(
        app_env="production",
        invites_required=None,
        cookie_secure=False,
        allowed_emails="@example.com",
    )
    assert error_code(app.test_client(), "ada@example.com", invite=None) == "invite_invalid"


@pytest.fixture
def cli_env(monkeypatch: pytest.MonkeyPatch, tmp_path: object) -> None:
    monkeypatch.setenv("JWT_SECRET_KEY", "x" * 32)
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}/cli.db")
    monkeypatch.setenv("WEB_DIST", str(tmp_path))
    monkeypatch.setenv("ALLOWED_EMAILS", "@example.com")
    monkeypatch.setenv("SITE_URL", "https://pi.example/")


def test_the_command_prints_a_working_link(
    cli_env: None, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(["create", "Ada@Example.com"]) == 0
    link = capsys.readouterr().out.strip().splitlines()[-1]
    assert link.startswith("https://pi.example/login?invite=")
    assert main(["list"]) == 0
    assert "ada@example.com" in capsys.readouterr().out
    assert main(["revoke", "ada@example.com"]) == 0
    assert main(["revoke", "ada@example.com"]) == 1


def test_the_command_refuses_an_email_off_the_list(
    cli_env: None, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(["create", "stranger@other.test"]) == 1
    assert "not on ALLOWED_EMAILS" in capsys.readouterr().out
