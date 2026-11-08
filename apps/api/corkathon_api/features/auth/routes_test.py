from collections.abc import Callable

import pytest
from flask import Flask
from flask.testing import FlaskClient

from conftest import PASSWORD, csrf_headers, invite, register, sign_up
from corkathon_api.features.auth.access import AccessList
from corkathon_api.settings import Settings


def test_register_signs_the_user_in(client: FlaskClient) -> None:
    sign_up(client, "ada@example.com")
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json is not None
    assert response.json["user"]["email"] == "ada@example.com"


def test_email_is_case_insensitive(client: FlaskClient) -> None:
    sign_up(client, "Ada@Example.com")
    response = client.post(
        "/api/auth/login", json={"email": "ada@example.COM", "password": PASSWORD}
    )
    assert response.status_code == 200


def test_register_rejects_a_taken_email(client: FlaskClient) -> None:
    sign_up(client, "ada@example.com")
    response = register(client, "ada@example.com")
    assert response.status_code == 409
    assert response.json is not None
    assert response.json["error"]["code"] == "email_taken"


def test_register_lists_the_fields_that_failed(client: FlaskClient) -> None:
    response = client.post("/api/auth/register", json={"email": "nope", "password": "short"})
    assert response.status_code == 422
    assert response.json is not None
    assert response.json["error"]["code"] == "validation_failed"
    assert sorted(response.json["error"]["fields"]) == ["email", "password"]


def test_body_that_is_not_json_is_refused(client: FlaskClient) -> None:
    response = client.post("/api/auth/login", data="email=a", content_type="text/plain")
    assert response.status_code == 400
    assert response.json is not None
    assert response.json["error"]["code"] == "invalid_json"


@pytest.mark.parametrize(
    ("email", "password"),
    [("ada@example.com", "wrong password"), ("nobody@example.com", PASSWORD)],
)
def test_login_failures_look_identical(client: FlaskClient, email: str, password: str) -> None:
    sign_up(client, "ada@example.com")
    client.post("/api/auth/logout", headers=csrf_headers(client))
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 401
    assert response.json == {
        "error": {"code": "invalid_credentials", "message": "Email or password is incorrect."}
    }


def test_me_without_a_session_is_refused(client: FlaskClient) -> None:
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json is not None
    assert response.json["error"]["code"] == "not_signed_in"


def test_a_tampered_token_is_refused(client: FlaskClient) -> None:
    client.set_cookie("access_token_cookie", "not.a.jwt")
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json is not None
    assert response.json["error"]["code"] == "invalid_session"


def test_logout_needs_the_csrf_header(client: FlaskClient) -> None:
    sign_up(client, "ada@example.com")
    response = client.post("/api/auth/logout")
    assert response.status_code == 401
    assert client.get("/api/auth/me").status_code == 200


def test_logout_ends_the_session(client: FlaskClient) -> None:
    sign_up(client, "ada@example.com")
    assert client.post("/api/auth/logout", headers=csrf_headers(client)).status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_session_cookie_is_httponly_and_strict(client: FlaskClient) -> None:
    response = register(client, "ada@example.com")
    cookie = next(
        c for c in response.headers.getlist("Set-Cookie") if c.startswith("access_token_cookie")
    )
    assert "HttpOnly" in cookie
    assert "SameSite=Strict" in cookie


def test_production_cookies_are_secure(build_app: Callable[..., Flask]) -> None:
    client = build_app(app_env="production", allowed_emails="ada@example.com").test_client()
    body = {"email": "ada@example.com", "password": PASSWORD}
    response = client.post(
        "/api/auth/register",
        json={**body, "invite": invite(client, "ada@example.com")},
        base_url="https://localhost",
    )
    assert response.status_code == 201
    assert all("Secure" in cookie for cookie in response.headers.getlist("Set-Cookie"))


def test_cookie_secure_false_lets_an_http_deploy_keep_the_session(
    build_app: Callable[..., Flask],
) -> None:
    client = build_app(
        app_env="production", cookie_secure=False, allowed_emails="ada@example.com"
    ).test_client()
    response = register(client, "ada@example.com")
    assert not any("Secure" in cookie for cookie in response.headers.getlist("Set-Cookie"))
    assert client.get("/api/auth/me").status_code == 200


def test_login_is_rate_limited(build_app: Callable[..., Flask]) -> None:
    client = build_app(auth_rate_limit_per_minute=2).test_client()
    body = {"email": "ada@example.com", "password": "wrong password"}
    assert client.post("/api/auth/login", json=body).status_code == 401
    assert client.post("/api/auth/login", json=body).status_code == 401
    response = client.post("/api/auth/login", json=body)
    assert response.status_code == 429
    assert response.json is not None
    assert response.json["error"]["code"] == "rate_limited"


def test_passwords_never_reach_logs_or_responses(
    client: FlaskClient, caplog: pytest.LogCaptureFixture
) -> None:
    canary = "canary-password-value"
    caplog.set_level("DEBUG")
    responses = [
        client.post("/api/auth/register", json={"email": "bad", "password": canary}),
        client.post("/api/auth/register", json={"email": "ada@example.com", "password": canary}),
        client.post("/api/auth/login", json={"email": "ada@example.com", "password": "wrong one"}),
    ]
    assert canary not in caplog.text
    assert all(canary.encode() not in response.data for response in responses)


def test_rotating_emails_from_one_address_is_still_limited(
    build_app: Callable[..., Flask],
) -> None:
    client = build_app(auth_rate_limit_per_minute=1).test_client()
    statuses = [
        client.post(
            "/api/auth/login", json={"email": f"user{n}@example.com", "password": "wrong"}
        ).status_code
        for n in range(6)
    ]
    assert statuses == [401, 401, 401, 401, 401, 429]


def login_from(client: FlaskClient, address: str, password: str) -> int:
    return client.post(
        "/api/auth/login",
        json={"email": "ada@example.com", "password": password},
        environ_overrides={"REMOTE_ADDR": address},
    ).status_code


def test_one_attacker_cannot_lock_the_owner_out(build_app: Callable[..., Flask]) -> None:
    client = build_app(auth_rate_limit_per_minute=2).test_client()
    sign_up(client, "ada@example.com")
    attempts = [login_from(client, "10.0.0.1", "wrong") for _ in range(30)]
    assert attempts[:3] == [401, 401, 429]
    assert login_from(client, "10.0.0.2", PASSWORD) == 200


def test_rotating_addresses_against_one_email_is_still_limited(
    build_app: Callable[..., Flask],
) -> None:
    client = build_app(auth_rate_limit_per_minute=2).test_client()
    statuses = [login_from(client, f"10.0.0.{n}", "wrong") for n in range(11)]
    assert statuses == [401] * 10 + [429]


def register_status(client: FlaskClient, email: str) -> int:
    return register(client, email).status_code


def test_a_listed_email_can_sign_up_and_back_in(build_app: Callable[..., Flask]) -> None:
    client = build_app(allowed_emails="Ada@Example.com, grace@example.com").test_client()
    assert register_status(client, "ada@example.com") == 201
    client.post("/api/auth/logout", headers=csrf_headers(client))
    response = client.post(
        "/api/auth/login", json={"email": "ada@example.com", "password": PASSWORD}
    )
    assert response.status_code == 200


def test_an_email_off_the_list_cannot_sign_up(build_app: Callable[..., Flask]) -> None:
    client = build_app(allowed_emails="ada@example.com").test_client()
    response = client.post(
        "/api/auth/register", json={"email": "stranger@example.com", "password": PASSWORD}
    )
    assert response.status_code == 403
    assert response.json is not None
    assert response.json["error"]["code"] == "email_not_allowed"
    assert client.get_cookie("access_token_cookie") is None


def test_a_domain_entry_lets_the_whole_firm_in(build_app: Callable[..., Flask]) -> None:
    client = build_app(allowed_emails="@frame.ie").test_client()
    assert register_status(client, "anyone@frame.ie") == 201
    assert register_status(client, "anyone@notframe.ie") == 403
    assert register_status(client, "frame.ie@evil.example") == 403


def test_production_with_no_list_lets_nobody_in(build_app: Callable[..., Flask]) -> None:
    client = build_app(app_env="production", cookie_secure=False).test_client()
    assert register_status(client, "ada@example.com") == 403


def test_an_email_taken_off_the_list_cannot_sign_in(build_app: Callable[..., Flask]) -> None:
    app = build_app(allowed_emails="ada@example.com")
    client = app.test_client()
    sign_up(client, "ada@example.com")
    app.extensions["access_list"] = AccessList.parse("grace@example.com", open_when_empty=False)
    assert client.get("/api/auth/me").status_code == 401
    right = client.post("/api/auth/login", json={"email": "ada@example.com", "password": PASSWORD})
    assert right.status_code == 403
    assert right.json is not None
    assert right.json["error"]["code"] == "email_not_allowed"
    # a wrong password says nothing about whether the email is on the list
    wrong = client.post("/api/auth/login", json={"email": "ada@example.com", "password": "nope"})
    assert wrong.status_code == 401


def test_the_old_filings_setting_still_fills_the_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FILINGS_ALLOWED_EMAILS", "ada@example.com")
    monkeypatch.delenv("ALLOWED_EMAILS", raising=False)
    settings = Settings(_env_file=None, jwt_secret_key="x" * 32)
    assert settings.allowed_emails == "ada@example.com"
