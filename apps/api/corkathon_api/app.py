from datetime import date, timedelta
from time import monotonic

from flask import Flask, Response, request
from werkzeug.middleware.proxy_fix import ProxyFix

from corkathon_api.database import db
from corkathon_api.features.auth.access import AccessList
from corkathon_api.features.auth.routes import auth_routes
from corkathon_api.features.auth.session import configure_sessions
from corkathon_api.features.clients.routes import clients_routes
from corkathon_api.features.filings.routes import filings_routes
from corkathon_api.features.filings.service import FilingsService
from corkathon_api.features.health import health_routes
from corkathon_api.features.notes.routes import notes_routes
from corkathon_api.features.radar.routes import radar_routes
from corkathon_api.features.radar.service import RadarService
from corkathon_api.http_errors import register_error_handlers
from corkathon_api.logging_setup import configure_logging, logger
from corkathon_api.rate_limit import RateLimiter
from corkathon_api.security_headers import register_security_headers
from corkathon_api.settings import Settings
from corkathon_api.web_app import register_web_app

MAX_BODY_BYTES = 1024 * 1024
# looser than the pair limit because a whole venue can share one wifi address
SHARED_LIMIT_MULTIPLIER = 5


def apply_config(app: Flask, settings: Settings) -> None:
    app.config.update(
        MAX_CONTENT_LENGTH=MAX_BODY_BYTES,
        SQLALCHEMY_DATABASE_URI=settings.database_url,
        # a failed insert would otherwise put password hashes in the logged traceback
        SQLALCHEMY_ENGINE_OPTIONS={"hide_parameters": True},
        JWT_SECRET_KEY=settings.jwt_secret_key.get_secret_value(),
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(hours=settings.session_hours),
        JWT_TOKEN_LOCATION=["cookies"],
        JWT_COOKIE_SECURE=(
            settings.app_env == "production"
            if settings.cookie_secure is None
            else settings.cookie_secure
        ),
        JWT_COOKIE_SAMESITE="Strict",
        JWT_COOKIE_CSRF_PROTECT=True,
        # a persistent cookie so a browser restart mid demo keeps the login
        JWT_SESSION_COOKIE=False,
        INVITES_REQUIRED=(
            settings.app_env == "production"
            if settings.invites_required is None
            else settings.invites_required
        ),
    )


def create_app(settings: Settings | None = None) -> Flask:
    resolved = settings or Settings()
    configure_logging()

    app = Flask(__name__, static_folder=None)
    apply_config(app, resolved)
    if resolved.trusted_proxies:
        # only the client address is used, so the other forwarded headers stay untrusted
        app.wsgi_app = ProxyFix(  # type: ignore[method-assign]
            app.wsgi_app, x_for=resolved.trusted_proxies, x_proto=0, x_host=0
        )

    db.init_app(app)
    access = AccessList.parse(
        resolved.allowed_emails, open_when_empty=resolved.app_env == "development"
    )
    app.extensions["access_list"] = access
    if access.open:
        logger.warning("sign up is open to any email, set ALLOWED_EMAILS to restrict it")
    elif not access.emails and not access.domains:
        logger.warning("ALLOWED_EMAILS is empty, so nobody can sign up or sign in")
    configure_sessions(app)
    per_minute = resolved.auth_rate_limit_per_minute
    app.extensions["auth_pair_limiter"] = RateLimiter(per_minute, 60, monotonic)
    app.extensions["auth_shared_limiter"] = RateLimiter(
        per_minute * SHARED_LIMIT_MULTIPLIER, 60, monotonic
    )

    register_error_handlers(app)
    register_security_headers(app)
    app.register_blueprint(health_routes)
    app.register_blueprint(auth_routes)
    app.register_blueprint(notes_routes)
    app.extensions["filings"] = FilingsService(
        resolved.filings_data_dir,
        resolved.filings_window_days,
        today=lambda: resolved.filings_as_of or date.today(),
        background=resolved.filings_build_in_background,
    )
    app.register_blueprint(clients_routes)
    app.register_blueprint(filings_routes)
    app.extensions["radar"] = RadarService(app.extensions["filings"])
    app.register_blueprint(radar_routes)
    register_web_app(app, resolved.web_dist)

    @app.after_request
    def log_request(response: Response) -> Response:
        fields = {"method": request.method, "path": request.path, "status": response.status_code}
        logger.info("request finished", extra={"fields": fields})
        return response

    with app.app_context():
        db.create_all()

    return app
