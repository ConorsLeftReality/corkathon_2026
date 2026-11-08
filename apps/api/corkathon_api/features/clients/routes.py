from flask import Blueprint, Response, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import select

from corkathon_api.database import db
from corkathon_api.errors import AppError
from corkathon_api.features.auth.session import signed_in_user
from corkathon_api.features.clients.models import Client
from corkathon_api.features.clients.schemas import ClientBody, ClientOut
from corkathon_api.features.clients.service import MAX_CLIENTS, add_numbers
from corkathon_api.features.filings.report import norm_num, parse_company_numbers
from corkathon_api.request_body import parse_json_body

clients_routes = Blueprint("clients", __name__, url_prefix="/api/clients")


def list_json(user_id: int) -> Response:
    query = select(Client).where(Client.user_id == user_id).order_by(Client.added_at.desc())
    clients = [
        ClientOut.model_validate(c).model_dump(mode="json") for c in db.session.scalars(query)
    ]
    return jsonify(clients=clients, limit=MAX_CLIENTS)


@clients_routes.get("")
@jwt_required()
def list_clients() -> Response:
    return list_json(signed_in_user().id)


@clients_routes.post("")
@jwt_required()
def add_client() -> tuple[Response, int]:
    body = parse_json_body(ClientBody)
    added, _ = add_numbers(signed_in_user().id, {norm_num(body.company_num)}, replace=False)
    if not added:
        raise AppError("client_exists", "That company is already on your list.", 409)
    return list_json(signed_in_user().id), 201


@clients_routes.post("/upload")
@jwt_required()
def upload_clients() -> Response:
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        raise AppError("upload_missing", "Choose a CSV file to upload.", 400)
    mode = request.form.get("mode", "add")
    if mode not in ("add", "replace"):
        raise AppError("validation_failed", "Check the highlighted fields.", 422, ["mode"])
    try:
        # only the parsed numbers are stored, the file is dropped with the request
        text = upload.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        raise AppError(
            "upload_unreadable", "Save the file as a UTF-8 CSV and upload it again.", 422
        ) from None
    parsed = parse_company_numbers(text)
    if not parsed.numbers:
        raise AppError(
            "upload_empty",
            "No company numbers found. Put them in a column called company_num.",
            422,
        )
    added, existing = add_numbers(signed_in_user().id, parsed.numbers, replace=mode == "replace")
    return jsonify(added=added, already_listed=existing, skipped=parsed.invalid)


@clients_routes.delete("/<company_num>")
@jwt_required()
def remove_client(company_num: str) -> tuple[str, int]:
    client = db.session.scalar(
        select(Client).where(
            Client.user_id == signed_in_user().id, Client.company_num == norm_num(company_num)
        )
    )
    # same answer for missing and not yours so other lists cannot be probed
    if client is None:
        raise AppError("not_found", "That company is not on your list.", 404)
    db.session.delete(client)
    db.session.commit()
    return "", 204
