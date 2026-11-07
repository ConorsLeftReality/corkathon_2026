from flask import Blueprint, Response, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import select

from corkathon_api.database import db
from corkathon_api.errors import AppError
from corkathon_api.features.auth.session import signed_in_user
from corkathon_api.features.notes.models import Note
from corkathon_api.features.notes.schemas import NoteBody, NoteOut
from corkathon_api.request_body import parse_json_body

notes_routes = Blueprint("notes", __name__, url_prefix="/api/notes")


def note_json(note: Note) -> dict[str, object]:
    return NoteOut.model_validate(note).model_dump()


@notes_routes.get("")
@jwt_required()
def list_notes() -> Response:
    query = select(Note).where(Note.user_id == signed_in_user().id).order_by(Note.id.desc())
    return jsonify(notes=[note_json(note) for note in db.session.scalars(query)])


@notes_routes.post("")
@jwt_required()
def create_note() -> tuple[Response, int]:
    body = parse_json_body(NoteBody)
    note = Note(user_id=signed_in_user().id, body=body.body)
    db.session.add(note)
    db.session.commit()
    return jsonify(note=note_json(note)), 201


@notes_routes.delete("/<int:note_id>")
@jwt_required()
def delete_note(note_id: int) -> tuple[str, int]:
    note = db.session.get(Note, note_id)
    # same answer for missing and not yours so ids cannot be probed
    if note is None or note.user_id != signed_in_user().id:
        raise AppError("not_found", "That note does not exist.", 404)
    db.session.delete(note)
    db.session.commit()
    return "", 204
