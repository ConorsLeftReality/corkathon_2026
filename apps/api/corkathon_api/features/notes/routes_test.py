from flask import Flask
from flask.testing import FlaskClient

from conftest import csrf_headers, sign_up


def add_note(client: FlaskClient, body: str) -> int:
    response = client.post("/api/notes", json={"body": body}, headers=csrf_headers(client))
    assert response.status_code == 201
    assert response.json is not None
    note_id: int = response.json["note"]["id"]
    return note_id


def test_a_new_user_has_no_notes(client: FlaskClient) -> None:
    sign_up(client, "ada@example.com")
    response = client.get("/api/notes")
    assert response.status_code == 200
    assert response.json == {"notes": []}


def test_notes_come_back_newest_first(client: FlaskClient) -> None:
    sign_up(client, "ada@example.com")
    add_note(client, "first")
    add_note(client, "second")
    response = client.get("/api/notes")
    assert response.json is not None
    assert [note["body"] for note in response.json["notes"]] == ["second", "first"]


def test_blank_note_is_refused(client: FlaskClient) -> None:
    sign_up(client, "ada@example.com")
    response = client.post("/api/notes", json={"body": "   "}, headers=csrf_headers(client))
    assert response.status_code == 422
    assert response.json is not None
    assert response.json["error"]["fields"] == ["body"]


def test_notes_need_a_session(client: FlaskClient) -> None:
    assert client.get("/api/notes").status_code == 401
    assert client.post("/api/notes", json={"body": "hi"}).status_code == 401


def test_writing_a_note_needs_the_csrf_header(client: FlaskClient) -> None:
    sign_up(client, "ada@example.com")
    assert client.post("/api/notes", json={"body": "hi"}).status_code == 401


def test_another_user_cannot_read_or_delete_a_note(app: Flask) -> None:
    owner, stranger = app.test_client(), app.test_client()
    sign_up(owner, "owner@example.com")
    sign_up(stranger, "stranger@example.com")
    note_id = add_note(owner, "private")

    assert stranger.get("/api/notes").json == {"notes": []}
    denied = stranger.delete(f"/api/notes/{note_id}", headers=csrf_headers(stranger))
    assert denied.status_code == 404

    remaining = owner.get("/api/notes").json
    assert remaining is not None
    assert [note["id"] for note in remaining["notes"]] == [note_id]


def test_owner_can_delete_a_note(client: FlaskClient) -> None:
    sign_up(client, "ada@example.com")
    note_id = add_note(client, "gone soon")
    response = client.delete(f"/api/notes/{note_id}", headers=csrf_headers(client))
    assert response.status_code == 204
    assert client.get("/api/notes").json == {"notes": []}
