from waitress import serve

from corkathon_api.app import create_app
from corkathon_api.logging_setup import logger
from corkathon_api.settings import Settings


def main() -> None:
    settings = Settings()
    app = create_app(settings)
    # waitress adds a root handler that would print every line a second time
    logger.propagate = False
    logger.info("server starting", extra={"fields": {"port": settings.port}})
    serve(app, host=settings.host, port=settings.port, threads=8)


if __name__ == "__main__":
    main()
