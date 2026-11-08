from dataclasses import dataclass

from flask import current_app

from corkathon_api.errors import AppError


@dataclass(frozen=True)
class AccessList:
    # open lets anyone in, which only development with no list allows
    open: bool
    emails: frozenset[str]
    domains: frozenset[str]

    @classmethod
    def parse(cls, raw: str, *, open_when_empty: bool) -> AccessList:
        entries = {entry.strip().lower() for entry in raw.split(",") if entry.strip()}
        domains = frozenset(entry[1:] for entry in entries if entry.startswith("@"))
        emails = frozenset(entry for entry in entries if not entry.startswith("@"))
        return cls(open=open_when_empty and not entries, emails=emails, domains=domains)

    def allows(self, email: str) -> bool:
        if self.open:
            return True
        email = email.strip().lower()
        return email in self.emails or email.rpartition("@")[2] in self.domains


def access_list() -> AccessList:
    allowed: AccessList = current_app.extensions["access_list"]
    return allowed


def require_allowed(email: str) -> None:
    if not access_list().allows(email):
        raise AppError(
            "email_not_allowed",
            "This email is not on the access list. Ask your admin to add it.",
            403,
        )
