from typing import Any

from flask import Flask, Response
from flask_jwt_extended import JWTManager, get_current_user

from corkathon_api.database import db
from corkathon_api.features.auth.models import User
from corkathon_api.http_errors import error_response

jwt = JWTManager()


def signed_in_user() -> User:
    user: User = get_current_user()
    return user


def configure_sessions(app: Flask) -> None:
    jwt.init_app(app)

    @jwt.user_lookup_loader
    def load_user(_header: dict[str, Any], payload: dict[str, Any]) -> User | None:
        return db.session.get(User, int(payload["sub"]))

    @jwt.unauthorized_loader
    def not_signed_in(_reason: str) -> tuple[Response, int]:
        return error_response("not_signed_in", "Sign in to continue.", 401)

    @jwt.invalid_token_loader
    def invalid_session(_reason: str) -> tuple[Response, int]:
        return error_response("invalid_session", "Sign in again to continue.", 401)

    @jwt.expired_token_loader
    def session_expired(_header: dict[str, Any], _payload: dict[str, Any]) -> tuple[Response, int]:
        return error_response("session_expired", "Your session ended. Sign in again.", 401)

    @jwt.user_lookup_error_loader
    def user_gone(_header: dict[str, Any], _payload: dict[str, Any]) -> tuple[Response, int]:
        return error_response("invalid_session", "Sign in again to continue.", 401)
