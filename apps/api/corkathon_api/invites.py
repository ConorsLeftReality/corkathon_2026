"""Invite people to create an account.

    python -m corkathon_api.invites create ada@firm.ie [--days 7]
    python -m corkathon_api.invites list
    python -m corkathon_api.invites revoke ada@firm.ie

On the Pi, prefix each with: sudo dokku run corkathon2026
"""

import argparse
import sys

from corkathon_api.app import create_app
from corkathon_api.database import db
from corkathon_api.features.auth.access import access_list
from corkathon_api.features.auth.invites import (
    INVITE_DAYS,
    as_utc,
    create_invite,
    list_invites,
    revoke_invite,
)
from corkathon_api.settings import Settings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m corkathon_api.invites")
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create", help="make a one-time sign-up link for an email")
    create.add_argument("email")
    create.add_argument("--days", type=int, default=INVITE_DAYS, choices=range(1, 31))
    commands.add_parser("list", help="show invites that have not been used")
    revoke = commands.add_parser("revoke", help="stop an invite link working")
    revoke.add_argument("email")
    args = parser.parse_args(argv)

    settings = Settings()
    app = create_app(settings)
    with app.app_context():
        try:
            return run(args, settings.site_url)
        finally:
            # a one-shot command closes sqlite itself instead of waiting for exit
            db.session.remove()
            db.engine.dispose()


def run(args: argparse.Namespace, site_url: str) -> int:
    if args.command == "create":
        email = args.email.strip().lower()
        if not access_list().allows(email):
            print(f"{email} is not on ALLOWED_EMAILS, so the link would not work. Add it first.")
            return 1
        token = create_invite(email, args.days)
        print(f"Invite for {email}, valid for {args.days} days, works once:")
        print(f"{site_url.rstrip('/')}/login?invite={token}")
    elif args.command == "list":
        for invite in list_invites():
            print(f"{invite.email}  expires {as_utc(invite.expires_at):%Y-%m-%d %H:%M} UTC")
    elif not revoke_invite(args.email):
        print(f"No invite for {args.email}.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
