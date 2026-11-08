from flask import Blueprint, Response, current_app, jsonify, request
from flask_jwt_extended import jwt_required

from corkathon_api.features.auth.session import signed_in_user
from corkathon_api.features.clients.service import client_numbers
from corkathon_api.features.filings.report import Company, Report
from corkathon_api.features.filings.service import FilingsService

# same paths and json shape as the standalone cro-tracker, so the web client reads either
filings_routes = Blueprint("filings", __name__, url_prefix="/api")


def service() -> FilingsService:
    filings: FilingsService = current_app.extensions["filings"]
    return filings


def by_status(companies: list[Company]) -> list[Company]:
    wanted = request.args.get("status")
    if not wanted:
        return companies
    keep = {status.strip() for status in wanted.split(",")}
    return [company for company in companies if company["status"] in keep]


def my_report() -> Report:
    return service().report_for(client_numbers(signed_in_user().id))


@filings_routes.get("/report")
@jwt_required()
def report() -> Response:
    current = my_report()
    return jsonify({**current, "companies": by_status(current["companies"])})


@filings_routes.get("/companies")
@jwt_required()
def companies() -> Response:
    return jsonify(by_status(my_report()["companies"]))


@filings_routes.get("/briefing")
@jwt_required()
def briefing() -> Response:
    text = service().briefing_for(client_numbers(signed_in_user().id))
    return Response(text, mimetype="text/plain; charset=utf-8")


# kept so older clients still work, a report is read fresh from the register every time
@filings_routes.post("/refresh")
@jwt_required()
def refresh() -> Response:
    return jsonify(my_report())
