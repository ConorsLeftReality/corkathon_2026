from flask import Flask, Response, jsonify
from werkzeug.exceptions import HTTPException

from corkathon_api.errors import AppError
from corkathon_api.logging_setup import logger


def error_response(
    code: str, message: str, status: int, fields: list[str] | None = None
) -> tuple[Response, int]:
    error: dict[str, object] = {"code": code, "message": message}
    if fields is not None:
        error["fields"] = fields
    return jsonify(error=error), status


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(AppError)
    def handle_app_error(error: AppError) -> tuple[Response, int]:
        return error_response(error.code, error.message, error.status, error.fields)

    @app.errorhandler(HTTPException)
    def handle_http_error(error: HTTPException) -> tuple[Response, int]:
        name = error.name
        return error_response(name.lower().replace(" ", "_"), f"{name}.", error.code or 500)

    @app.errorhandler(Exception)
    def handle_crash(error: Exception) -> tuple[Response, int]:
        logger.error("unhandled error", exc_info=error)
        return error_response("internal_error", "Something went wrong on the server.", 500)
