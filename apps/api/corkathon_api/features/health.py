from flask import Blueprint, Response, jsonify
from sqlalchemy import text

from corkathon_api.database import db

health_routes = Blueprint("health", __name__, url_prefix="/api/health")


@health_routes.get("")
def health() -> Response:
    db.session.execute(text("select 1"))
    return jsonify(status="ok")
