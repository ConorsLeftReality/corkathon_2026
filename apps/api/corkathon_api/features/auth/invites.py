from datetime import UTC, datetime, timedelta
from hashlib import sha256
from hmac import compare_digest
from secrets import token_urlsafe

from sqlalchemy import DateTime, String, delete, select
from sqlalchemy.orm import Mapped, mapped_column

from corkathon_api.database import Base, db
from corkathon_api.errors import AppError

INVITE_DAYS = 7


class Invite(Base):
    __tablename__ = "invites"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    # only the hash is stored, so a copy of the database cannot be turned into sign-ups
    token_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


def token_hash(token: str) -> str:
    return sha256(token.encode()).hexdigest()


def now() -> datetime:
    return datetime.now(UTC)


def as_utc(moment: datetime) -> datetime:
    # sqlite hands datetimes back without a timezone
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


def create_invite(email: str, days: int = INVITE_DAYS) -> str:
    """replaces any earlier invite for the email, so an old link stops working"""
    email = email.strip().lower()
    token = token_urlsafe(32)
    db.session.execute(delete(Invite).where(Invite.email == email))
    db.session.add(
        Invite(email=email, token_hash=token_hash(token), expires_at=now() + timedelta(days=days))
    )
    db.session.commit()
    return token


def revoke_invite(email: str) -> bool:
    result = db.session.execute(delete(Invite).where(Invite.email == email.strip().lower()))
    db.session.commit()
    return bool(getattr(result, "rowcount", 0))


def list_invites() -> list[Invite]:
    return list(db.session.scalars(select(Invite).order_by(Invite.email)))


def take_invite(email: str, token: str | None) -> None:
    """checks the invite and removes it in the caller's transaction, so it works once"""
    invite = db.session.scalar(select(Invite).where(Invite.email == email))
    valid = (
        invite is not None
        and token is not None
        and compare_digest(invite.token_hash, token_hash(token))
        and as_utc(invite.expires_at) > now()
    )
    if not valid or invite is None:
        # one answer for missing, wrong, expired and used, so links cannot be probed
        raise AppError(
            "invite_invalid",
            "This invite link is not valid for that email. Ask your admin for a new one.",
            403,
        )
    db.session.delete(invite)
