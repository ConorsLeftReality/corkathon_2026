import io
from pathlib import Path

import pytest
from flask import Flask
from flask.testing import FlaskClient

from conftest import csrf_headers, sign_up
from corkathon_api.features.clients import service as clients_service


@pytest.fixture
def ada(app: Flask) -> FlaskClient:
    client = app.test_client()
    sign_up(client, "ada@example.com")
    return client


def add(client: FlaskClient, number: object):  # type: ignore[no-untyped-def]
    return client.post("/api/clients", json={"company_num": number}, headers=csrf_headers(client))


def upload(client: FlaskClient, text: str | bytes, mode: str = "add"):  # type: ignore[no-untyped-def]
    raw = text.encode() if isinstance(text, str) else text
    return client.post(
        "/api/clients/upload",
        data={"file": (io.BytesIO(raw), "clients.csv"), "mode": mode},
        headers=csrf_headers(client),
        content_type="multipart/form-data",
    )


def listed(client: FlaskClient) -> list[str]:
    response = client.get("/api/clients")
    assert response.status_code == 200
    assert response.json is not None
    return sorted(c["company_num"] for c in response.json["clients"])


def test_the_list_needs_a_session(app: Flask) -> None:
    client = app.test_client()
    assert client.get("/api/clients").status_code == 401
    assert client.post("/api/clients", json={"company_num": "1"}).status_code == 401
    assert client.delete("/api/clients/1").status_code == 401


def test_writes_need_the_csrf_header(ada: FlaskClient) -> None:
    assert ada.post("/api/clients", json={"company_num": "1"}).status_code == 401
    assert ada.delete("/api/clients/1").status_code == 401


def test_a_company_can_be_added_and_removed(ada: FlaskClient) -> None:
    assert listed(ada) == []
    assert add(ada, "0104547").status_code == 201
    assert listed(ada) == ["104547"]
    assert ada.delete("/api/clients/104547", headers=csrf_headers(ada)).status_code == 204
    assert listed(ada) == []


def test_adding_the_same_company_twice_is_refused(ada: FlaskClient) -> None:
    add(ada, "104547")
    response = add(ada, "104547")
    assert response.status_code == 409
    assert response.json is not None
    assert response.json["error"]["code"] == "client_exists"


@pytest.mark.parametrize("number", ["", "abc", "12345678901", "1; drop table", 12, "../1"])
def test_anything_but_a_company_number_is_refused(ada: FlaskClient, number: object) -> None:
    response = add(ada, number)
    assert response.status_code == 422
    assert response.json is not None
    assert response.json["error"]["fields"] == ["company_num"]


def test_a_csv_adds_to_the_list(ada: FlaskClient) -> None:
    add(ada, "1")
    response = upload(ada, "company_num,name\n1,One\n2,Two\nnot a number,Three\n")
    assert response.status_code == 200
    assert response.json == {"added": 1, "already_listed": 1, "skipped": 1}
    assert listed(ada) == ["1", "2"]


def test_a_csv_can_replace_the_list(ada: FlaskClient) -> None:
    add(ada, "1")
    response = upload(ada, "7\n8\n", mode="replace")
    assert response.status_code == 200
    assert listed(ada) == ["7", "8"]


@pytest.mark.parametrize(
    ("text", "code"),
    [
        ("name\nAcme\n", "upload_empty"),
        (b"\xff\xfe\x00bad", "upload_unreadable"),
    ],
)
def test_an_unusable_csv_is_refused(ada: FlaskClient, text: str | bytes, code: str) -> None:
    add(ada, "1")
    response = upload(ada, text, mode="replace")
    assert response.status_code == 422
    assert response.json is not None
    assert response.json["error"]["code"] == code
    # a refused upload never touches the existing list
    assert listed(ada) == ["1"]


def test_an_upload_without_a_file_is_refused(ada: FlaskClient) -> None:
    response = ada.post("/api/clients/upload", data={}, headers=csrf_headers(ada))
    assert response.status_code == 400
    assert response.json is not None
    assert response.json["error"]["code"] == "upload_missing"


def test_an_unknown_mode_is_refused(ada: FlaskClient) -> None:
    response = upload(ada, "1\n", mode="wipe")
    assert response.status_code == 422


def test_a_file_over_the_body_limit_is_refused(ada: FlaskClient) -> None:
    # raw bytes, the test client would otherwise spool a big form to an unclosed temp file
    response = ada.post(
        "/api/clients/upload",
        data=b"1\n" * 600_000,
        headers=csrf_headers(ada),
        content_type="multipart/form-data; boundary=x",
    )
    assert response.status_code == 413


def test_the_list_has_a_cap(ada: FlaskClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(clients_service, "MAX_CLIENTS", 2)
    response = upload(ada, "1\n2\n3\n")
    assert response.status_code == 422
    assert response.json is not None
    assert response.json["error"]["code"] == "client_limit_reached"
    assert listed(ada) == []


def test_an_upload_is_never_kept_on_disk(ada: FlaskClient, tmp_path: Path) -> None:
    before = set(tmp_path.rglob("*"))
    upload(ada, "company_num\n42\n")
    after = {path for path in set(tmp_path.rglob("*")) - before if "test.db" not in path.name}
    assert after == set()


def test_one_account_cannot_read_or_change_another_accounts_list(
    app: Flask, ada: FlaskClient
) -> None:
    add(ada, "104547")
    grace = app.test_client()
    sign_up(grace, "grace@example.com")
    assert listed(grace) == []
    response = grace.delete("/api/clients/104547", headers=csrf_headers(grace))
    assert response.status_code == 404
    upload(grace, "9\n", mode="replace")
    assert listed(ada) == ["104547"]
    assert listed(grace) == ["9"]
