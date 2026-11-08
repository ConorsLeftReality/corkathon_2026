from secrets import token_hex

from flask import Blueprint, Response, current_app, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    set_access_cookies,
    unset_jwt_cookies,
)
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from corkathon_api.database import db
from corkathon_api.errors import AppError
from corkathon_api.features.auth.access import require_allowed
from corkathon_api.features.auth.invites import take_invite
from corkathon_api.features.auth.models import User
from corkathon_api.features.auth.schemas import LoginBody, RegisterBody, UserOut
from corkathon_api.features.auth.session import signed_in_user
from corkathon_api.rate_limit import RateLimiter, address_bucket
from corkathon_api.request_body import parse_json_body

auth_routes = Blueprint("auth", __name__, url_prefix="/api/auth")

# checked when the email is unknown so a miss costs the same time as a wrong password
UNKNOWN_USER_HASH = generate_password_hash(token_hex(16))


def enforce_rate_limit(limiter: RateLimiter, key: str) -> None:
    if not limiter.allow(key):
        raise AppError("rate_limited", "Too many attempts. Wait a minute and try again.", 429)


def client_bucket() -> str:
    return address_bucket(request.remote_addr or "unknown")


def limit_by_address() -> None:
    limiter = current_app.extensions["auth_shared_limiter"]
    enforce_rate_limit(limiter, f"address:{client_bucket()}")


def limit_by_email(email: str) -> None:
    # the pair check runs first so one attacker stops here and never spends the shared email budget
    enforce_rate_limit(current_app.extensions["auth_pair_limiter"], f"{client_bucket()}:{email}")
    enforce_rate_limit(current_app.extensions["auth_shared_limiter"], f"email:{email}")


def signed_in_response(user: User, status: int) -> tuple[Response, int]:
    response = jsonify(user=UserOut.model_validate(user).model_dump())
    set_access_cookies(response, create_access_token(identity=str(user.id)))
    return response, status


@auth_routes.post("/register")
def register() -> tuple[Response, int]:
    limit_by_address()
    body = parse_json_body(RegisterBody)
    require_allowed(body.email)
    if current_app.config["INVITES_REQUIRED"]:
        take_invite(body.email, body.invite)
    user = User(email=body.email, password_hash=generate_password_hash(body.password))
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        # the unique constraint decides, a check before insert would race
        db.session.rollback()
        raise AppError("email_taken", "That email already has an account.", 409) from None
    return signed_in_response(user, 201)


@auth_routes.post("/login")
def login() -> tuple[Response, int]:
    limit_by_address()
    body = parse_json_body(LoginBody)
    limit_by_email(body.email)
    user = db.session.scalar(select(User).where(User.email == body.email))
    stored_hash = user.password_hash if user else UNKNOWN_USER_HASH
    password_matches = check_password_hash(stored_hash, body.password)
    if user is None or not password_matches:
        raise AppError("invalid_credentials", "Email or password is incorrect.", 401)
    # checked after the password so the list cannot be probed through sign in
    require_allowed(user.email)
    return signed_in_response(user, 200)


@auth_routes.post("/logout")
@jwt_required()
def logout() -> tuple[Response, int]:
    response = Response(status=204)
    unset_jwt_cookies(response)
    return response, 204


@auth_routes.get("/me")
@jwt_required()
def me() -> Response:
    return jsonify(user=UserOut.model_validate(signed_in_user()).model_dump())
