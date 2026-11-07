from flask import Blueprint, Response, current_app, jsonify, request
from flask_jwt_extended import jwt_required

from corkathon_api.errors import AppError
from corkathon_api.features.auth.session import signed_in_user
from corkathon_api.features.filings.report import Company
from corkathon_api.features.filings.service import FilingsService

# same paths and json as matteo/app.py, so the web app works against either
filings_routes = Blueprint("filings", __name__, url_prefix="/api")


def service() -> FilingsService:
    filings: FilingsService = current_app.extensions["filings"]
    return filings


def require_access() -> None:
    # the client list is shared and sign up is open, so the allowlist is what keeps it private
    allowed: frozenset[str] = current_app.config["FILINGS_ALLOWED_EMAILS"]
    if allowed and signed_in_user().email.lower() not in allowed:
        raise AppError(
            "filings_forbidden",
            "This account cannot see the filings report. Ask your admin to add your email.",
            403,
        )


def by_status(companies: list[Company]) -> list[Company]:
    wanted = request.args.get("status")
    if not wanted:
        return companies
    keep = {status.strip() for status in wanted.split(",")}
    return [company for company in companies if company["status"] in keep]


@filings_routes.get("/report")
@jwt_required()
def report() -> Response:
    require_access()
    current = service().report()
    return jsonify({**current, "companies": by_status(current["companies"])})


@filings_routes.get("/companies")
@jwt_required()
def companies() -> Response:
    require_access()
    return jsonify(by_status(service().report()["companies"]))


@filings_routes.get("/briefing")
@jwt_required()
def briefing() -> Response:
    require_access()
    return Response(service().briefing(), mimetype="text/plain; charset=utf-8")


@filings_routes.post("/refresh")
@jwt_required()
def refresh() -> Response:
    require_access()
    return jsonify(service().rebuild())
