from flask import request
from pydantic import BaseModel, ValidationError

from corkathon_api.errors import AppError


def parse_json_body[T: BaseModel](schema: type[T]) -> T:
    payload = request.get_json(silent=True)
    if payload is None:
        raise AppError("invalid_json", "Send the request body as JSON.", 400)
    try:
        return schema.model_validate(payload)
    except ValidationError as error:
        # field names only, pydantic errors carry the raw input and that can be a password
        fields = [".".join(str(part) for part in item["loc"]) for item in error.errors()]
        raise AppError("validation_failed", "Check the highlighted fields.", 422, fields) from None
