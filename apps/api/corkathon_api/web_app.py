from pathlib import Path, PurePosixPath

from flask import Flask, Response, send_from_directory
from werkzeug.exceptions import NotFound


def register_web_app(app: Flask, dist: Path) -> None:
    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def serve_web_app(path: str) -> Response:
        if path == "api" or path.startswith("api/"):
            raise NotFound
        # no file extension means a client side route, so react gets to handle it
        if not PurePosixPath(path).suffix:
            return send_from_directory(dist, "index.html")
        return send_from_directory(dist, path)
