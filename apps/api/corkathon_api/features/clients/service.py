from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from corkathon_api.database import db
from corkathon_api.errors import AppError
from corkathon_api.features.clients.models import Client

# a cap per account keeps one upload from filling the pi's disk or a report from growing unbounded
MAX_CLIENTS = 2000


def client_numbers(user_id: int) -> set[str]:
    query = select(Client.company_num).where(Client.user_id == user_id)
    return set(db.session.scalars(query))


def count_clients(user_id: int) -> int:
    query = select(func.count()).select_from(Client).where(Client.user_id == user_id)
    return db.session.scalar(query) or 0


def refuse_over_limit(total: int) -> None:
    if total > MAX_CLIENTS:
        raise AppError(
            "client_limit_reached",
            f"An account can hold up to {MAX_CLIENTS} clients. Remove some and try again.",
            422,
        )


# returns how many were added and how many were already on the list
def add_numbers(user_id: int, numbers: set[str], *, replace: bool) -> tuple[int, int]:
    existing = set() if replace else client_numbers(user_id)
    new = numbers - existing
    refuse_over_limit(len(existing) + len(new))
    if replace:
        db.session.execute(delete(Client).where(Client.user_id == user_id))
    db.session.add_all(Client(user_id=user_id, company_num=num) for num in sorted(new))
    try:
        db.session.commit()
    except IntegrityError:
        # two saves raced, the unique constraint kept the list clean
        db.session.rollback()
        raise AppError(
            "clients_changed", "Your client list changed while saving. Try again.", 409
        ) from None
    return len(new), len(numbers) - len(new)
