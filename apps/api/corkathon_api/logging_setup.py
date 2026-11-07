import json
import logging
import sys

REDACTED_FIELDS = frozenset(
    {"password", "password_hash", "jwt_secret_key", "authorization", "cookie", "token"}
)

logger = logging.getLogger("corkathon")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        fields: dict[str, object] = getattr(record, "fields", {})
        line: dict[str, object] = {
            "level": record.levelname.lower(),
            "message": record.getMessage(),
            **{
                key: "[redacted]" if key.lower() in REDACTED_FIELDS else value
                for key, value in fields.items()
            },
        }
        if record.exc_info:
            line["exception"] = self.formatException(record.exc_info)
        return json.dumps(line, default=str)


def configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logger.handlers = [handler]
    logger.setLevel(logging.INFO)
