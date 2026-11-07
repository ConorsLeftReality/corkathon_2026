import json
import logging

from corkathon_api.logging_setup import JsonFormatter


def format_record(fields: dict[str, object]) -> dict[str, object]:
    record = logging.LogRecord("api", logging.INFO, "f.py", 1, "request finished", None, None)
    record.fields = fields
    parsed: dict[str, object] = json.loads(JsonFormatter().format(record))
    return parsed


def test_writes_message_and_fields_as_json() -> None:
    line = format_record({"status": 200})
    assert line["message"] == "request finished"
    assert line["status"] == 200


def test_redacts_secret_fields_whatever_their_case() -> None:
    line = format_record({"Password": "canary", "jwt_secret_key": "canary", "cookie": "canary"})
    assert "canary" not in json.dumps(line)
