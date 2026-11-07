from collections.abc import Callable

import pytest
from flask import Flask
from flask.testing import FlaskClient

from conftest import PASSWORD, csrf_headers, sign_up


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
    response = client.post(
        "/api/auth/register", json={"email": "ada@example.com", "password": PASSWORD}
    )
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
    response = client.post(
        "/api/auth/register", json={"email": "ada@example.com", "password": PASSWORD}
    )
    cookie = next(
        c for c in response.headers.getlist("Set-Cookie") if c.startswith("access_token_cookie")
    )
    assert "HttpOnly" in cookie
    assert "SameSite=Strict" in cookie


def test_production_cookies_are_secure(build_app: Callable[..., Flask]) -> None:
    client = build_app(app_env="production").test_client()
    response = client.post(
        "/api/auth/register",
        json={"email": "ada@example.com", "password": PASSWORD},
        base_url="https://localhost",
    )
    assert all("Secure" in cookie for cookie in response.headers.getlist("Set-Cookie"))


def test_cookie_secure_false_lets_an_http_deploy_keep_the_session(
    build_app: Callable[..., Flask],
) -> None:
    client = build_app(app_env="production", cookie_secure=False).test_client()
    response = client.post(
        "/api/auth/register", json={"email": "ada@example.com", "password": PASSWORD}
    )
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
