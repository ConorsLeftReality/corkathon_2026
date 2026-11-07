from collections.abc import Callable
from pathlib import Path

import pytest
from flask import Blueprint, Flask, request
from flask.testing import FlaskClient
from sqlalchemy import text

from corkathon_api.database import db


def test_health_reports_ok_with_a_live_database(client: FlaskClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json == {"status": "ok"}


def test_unknown_api_route_is_a_json_404(client: FlaskClient) -> None:
    response = client.get("/api/nope")
    assert response.status_code == 404
    assert response.json is not None
    assert response.json["error"]["code"] == "not_found"


def test_wrong_method_is_a_json_405(client: FlaskClient) -> None:
    response = client.put("/api/health")
    assert response.status_code == 405
    assert response.json is not None
    assert response.json["error"]["code"] == "method_not_allowed"


def test_oversized_body_is_refused(client: FlaskClient) -> None:
    response = client.post(
        "/api/auth/login", data=b"x" * (1024 * 1024 + 1), content_type="application/json"
    )
    assert response.status_code == 413
    assert response.json is not None
    assert response.json["error"]["code"] == "request_entity_too_large"


def test_crash_returns_a_code_and_no_stack_trace(build_app: Callable[..., Flask]) -> None:
    app = build_app()
    crash = Blueprint("crash", __name__)

    @crash.get("/api/crash")
    def explode() -> str:
        raise RuntimeError("secret internals")

    app.register_blueprint(crash)
    response = app.test_client().get("/api/crash")
    assert response.status_code == 500
    assert response.json == {
        "error": {"code": "internal_error", "message": "Something went wrong on the server."}
    }


def test_security_headers_are_on_every_response(client: FlaskClient) -> None:
    headers = client.get("/api/health").headers
    assert "default-src 'self'" in headers["Content-Security-Policy"]
    assert "frame-ancestors 'none'" in headers["Content-Security-Policy"]
    assert headers["X-Content-Type-Options"] == "nosniff"


@pytest.fixture
def site(tmp_path: Path, build_app: Callable[..., Flask]) -> FlaskClient:
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<title>web app</title>")
    (dist / "assets" / "main.js").write_text("console.log(1)")
    (tmp_path / "private.txt").write_text("outside dist")
    return build_app().test_client()


def read_page(site: FlaskClient, path: str) -> bytes:
    # file responses hold an open handle until closed, a real wsgi server does this for us
    with site.get(path) as response:
        body: bytes = response.data
        return body


def test_serves_the_built_web_app(site: FlaskClient) -> None:
    assert b"web app" in read_page(site, "/")
    assert b"console.log" in read_page(site, "/assets/main.js")


def test_client_side_routes_fall_back_to_index(site: FlaskClient) -> None:
    assert b"web app" in read_page(site, "/notes/42")


def test_missing_asset_is_a_404_not_index(site: FlaskClient) -> None:
    assert site.get("/assets/missing.js").status_code == 404


def test_api_routes_never_fall_back_to_index(site: FlaskClient) -> None:
    response = site.get("/api/missing")
    assert response.status_code == 404
    assert response.is_json


def test_path_traversal_cannot_leave_dist(site: FlaskClient) -> None:
    for path in ("/../private.txt", "/assets/../../private.txt", "/%2e%2e/private.txt"):
        assert b"outside dist" not in read_page(site, path)


def test_failed_queries_keep_bound_values_out_of_the_logs(
    build_app: Callable[..., Flask], caplog: pytest.LogCaptureFixture
) -> None:
    app = build_app()
    crash = Blueprint("bad_query", __name__)
    # built at runtime because tracebacks quote source lines, a literal would always match
    canary = "-".join(["canary", "value"])

    @crash.get("/api/bad-query")
    def bad_query() -> str:
        db.session.execute(text("select * from missing where x = :v"), {"v": canary})
        return "unreachable"

    app.register_blueprint(crash)
    assert app.test_client().get("/api/bad-query").status_code == 500
    assert "missing" in caplog.text
    assert canary not in caplog.text


def test_only_the_client_address_is_taken_from_the_proxy(
    build_app: Callable[..., Flask],
) -> None:
    app = build_app(trusted_proxies=1)
    seen = Blueprint("seen", __name__)

    @seen.get("/api/seen")
    def show() -> dict[str, str | None]:
        return {"addr": request.remote_addr, "host": request.host}

    app.register_blueprint(seen)
    response = app.test_client().get(
        "/api/seen",
        headers={"X-Forwarded-For": "203.0.113.9", "X-Forwarded-Host": "evil.example"},
    )
    assert response.json == {"addr": "203.0.113.9", "host": "localhost"}
