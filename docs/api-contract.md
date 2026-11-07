# API contracts

Two APIs feed the web app.

## Filings API (built)

The Today screen at `/app` reads this one. It runs inside the main Flask app (`apps/api/corkathon_api/features/filings/`), so it ships in the one deployed container and every route needs a signed-in session. The report logic is ported from Matteo's `matteo/app.py`, which still runs on its own for the phone and ElevenLabs work.

| Setting | Default | What it does |
|---|---|---|
| `FILINGS_DATA_DIR` | `apps/api/instance/filings`, `/data/filings` in the container | Holds the CRO snapshot, `my_companies.csv` and the cached `report.json` |
| `FILINGS_WINDOW_DAYS` | `30` | How far ahead counts as due |
| `FILINGS_AS_OF` | today | A fixed date for a reproducible demo |
| `FILINGS_ALLOWED_EMAILS` | not set | Comma separated emails. When set, only those accounts can read the report; everyone else gets `403 filings_forbidden` |

Sign-up is open and the client list is shared, so **set `FILINGS_ALLOWED_EMAILS` before you put a real `my_companies.csv` on the server**. Without it, anyone who creates an account can read the list. The app logs a warning at start-up when a client list exists and no allowlist is set. Leaving it unset is fine while the demo list of public companies is in use.

Sign-up does not check that people own the email they register, so an allowlisted address counts for whoever registers it first. Have every allowed person create their account **before** you set the list; after that an impostor cannot take the address, because emails are unique. Email verification or admin-granted access would close this properly. On the Pi: `dokku config:set corkathon2026 FILINGS_ALLOWED_EMAILS=you@example.com,teammate@example.com`.

Without a `my_companies.csv` in the data folder, the report uses Matteo's demo list (Ryanair, Kerry Group, CRH and one fake number). On the first request of the day the app downloads the CRO snapshot (about 47 MB) in the background and answers `503 filings_building` until it is ready; the page shows that message with a retry button. To use your own list on the Pi, copy it into the app's `/data/filings/` volume and press Rebuild report.

The rest of this section describes `matteo/app.py` running on its own, which the web app only uses when Vite is started with `FILINGS_API_URL`.

| Route | Returns | Used by |
|---|---|---|
| `GET /api/report` | `{generated_at, as_of, window_days, grace_days, counts, companies, source}`, optional `?status=due,overdue` | Today screen: tiles, overdue and due tables |
| `GET /api/companies` | the sorted `companies` list only | not used yet |
| `GET /api/briefing` | plain text for ElevenLabs | Today screen: "What the phone reads" |
| `POST /api/refresh` | the rebuilt report | Today screen: "Rebuild report" |

The zod schema for the report is `reportSchema` in `apps/web/src/features/filings/filings-api.ts`. Each company has `company_num`, `company_name`, `company_status`, `company_type`, `address`, `last_ar_date`, `nard`, `deadline`, `days_left` (negative when overdue) and `status` (`overdue`, `due`, `ok`, `unknown`, `dissolved` or `not_found`). Errors come back as `{"error": {"code": ..., "message": ...}}` from the main app and `{"error": "..."}` from the standalone one; the page shows the message either way.

Standalone, the client list is `my_companies.csv` beside `matteo/app.py`, shared by everyone, with no sign-in.

To run it standalone beside the web app:

```bash
uv run --with flask==3.1.3 python matteo/app.py serve
FILINGS_API_URL=http://127.0.0.1:5000 bun run dev
```

With `FILINGS_API_URL=http://127.0.0.1:5000` set, Vite sends `/api/report`, `/api/companies`, `/api/briefing` and `/api/refresh` to it and everything else under `/api` to the scaffold Flask app on 5001. Without it, all of `/api` goes to the scaffold. `bun run dev:mock` answers all of them with placeholder data instead.

The filings app guards itself:

| Setting | Default | What it does |
|---|---|---|
| `HOST` | `127.0.0.1` | Where it listens. Anything else needs `FILINGS_TOKEN`, or it refuses to start |
| `ALLOWED_HOSTS` | `127.0.0.1:<port>,localhost:<port>` | Requests naming any other host get a 403, which stops DNS rebinding. Add the address another device uses, for example `192.168.1.20:5000` |
| `FILINGS_TOKEN` | not set | When set, every request needs an `X-Filings-Token` header with this value. Start Vite with the same `FILINGS_TOKEN` and the proxy adds it |
| `ALLOWED_ORIGIN` | not set | Sends a CORS header for that origin only. The web app does not need it, since it goes through the proxy |

To let the phone or another device fetch the briefing:

```bash
HOST=0.0.0.0 ALLOWED_HOSTS=192.168.1.20:5000 FILINGS_TOKEN=<long random value> uv run --with flask==3.1.3 python matteo/app.py serve
```

The device then sends `X-Filings-Token: <the same value>`. Generate the value with `openssl rand -hex 16` and keep it out of git.

## Radar API (Planned)

The Filing deadlines page at `/app/radar` (prospects search, stored questions, typed questions) needs this one, and it is not built. Until it is, that page only works under `bun run dev:mock`. The rest of this page is the contract for it.

The source of truth is the zod schemas in `apps/web/src/features/radar/radar-api.ts`. This page restates them in Python.

### Check your work

With your Flask app running (`bun run dev:api`), in a second terminal:

```bash
bun run radar:contract
```

It signs up a throwaway user, calls every route, and prints `ok` or `FAIL` with the field that is wrong. It also checks that a second user cannot see the first user's client list, and that a request with no session gets a 401. Every line should say `ok` before the demo. The turnover check only warns, since free-text questions are optional.

To see your data in the real page, run `bun run dev` (not `dev:mock`) and open http://localhost:5173.

### Where the code goes

Follow the `notes` feature, as `AGENTS.md` says:

```
apps/api/corkathon_api/features/radar/
  __init__.py
  schemas.py      the models below
  models.py       ClientCompany table (user_id, company_num)
  routes.py       radar_routes = Blueprint("radar", __name__, url_prefix="/api/radar")
  routes_test.py  include a test that user B cannot read user A's list
```

Register the blueprint in `apps/api/corkathon_api/app.py`, next to `notes_routes`. Every route uses `@jwt_required()`, and the client list routes filter by `signed_in_user().id`.

### Routes

| Method and path | Body | Success | Errors |
|---|---|---|---|
| `GET /api/radar/snapshot` | none | `200` `Snapshot` | |
| `GET /api/radar/clients` | none | `200` `ClientList` (the signed-in user's list, `[]` for a new user) | |
| `PUT /api/radar/clients` | `ClientListBody` | `200` `ClientList` (the saved list, replacing the old one) | `400` bad numbers |
| `POST /api/radar/ask` | `AskBody` | `200` `Answer` or `Reply` | `400` unknown preset, `503` free text not available |

Errors use the existing `AppError(code, message, status)`, which the scaffold already turns into `{"error": {"code": ..., "message": ...}}`. The page shows `message` to the user, so write it as a sentence a person can act on.

### Models

```python
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator

CompanyNumber = Annotated[str, StringConstraints(pattern=r"^\d{1,8}$")]


class Snapshot(BaseModel):
    fetched_at: str  # when the CSV was downloaded, ISO 8601, e.g. "2026-11-07T09:12:00Z"
    newest_reg_date: date  # max(company_reg_date) in the file
    stale: bool  # newest_reg_date older than 7 days before today


class Row(BaseModel):
    company_num: str
    company_name: str
    sector_label: str | None  # None when the NACE code is blank
    routing_key: str | None  # first 3 characters of the Eircode, None when missing
    filing_deadline: date
    days_to_deadline: int  # negative once the deadline has passed
    days_overdue: int = Field(ge=0)  # 0 unless overdue
    est_penalty_eur: float = Field(ge=0)  # 0 unless overdue


class Answer(BaseModel):
    kind: Literal["answer"] = "answer"
    answer: str  # one sentence written from the rows, e.g. "6 Cork hospitality companies are overdue."
    rows: list[Row]  # already sorted, most urgent first, at most the limit
    filter: dict[str, object]  # the filter you ran, shown in "How this was worked out"
    sql: str  # the query you ran, shown the same way
    params: list[object]  # values bound into that query
    row_count: int = Field(ge=0)  # total matches before the limit
    snapshot: Snapshot


class Reply(BaseModel):
    kind: Literal["clarify", "refuse"]
    message: str
    snapshot: Snapshot


class ClientList(BaseModel):
    company_numbers: list[str]


class ClientListBody(BaseModel):
    company_numbers: list[CompanyNumber] = Field(max_length=2000)


class AskBody(BaseModel):
    mode: Literal["clients", "prospects"]
    question: str | None = Field(default=None, min_length=1, max_length=300)
    preset: str | None = None

    @model_validator(mode="after")
    def one_of_question_or_preset(self) -> "AskBody":
        if (self.question is None) == (self.preset is None):
            raise ValueError("send a question or a preset, not both")
        return self
```

Return them with `jsonify(model.model_dump(mode="json"))`. Without `mode="json"`, Flask writes dates as `"Fri, 14 Nov 2026 00:00:00 GMT"` and the page rejects the response.

### Example responses

`GET /api/radar/snapshot`

```json
{ "fetched_at": "2026-11-07T09:12:00Z", "newest_reg_date": "2026-11-06", "stale": false }
```

`POST /api/radar/ask` with `{"mode": "prospects", "preset": "overdue_cork_hospitality"}`

```json
{
  "kind": "answer",
  "answer": "6 Cork hospitality companies are overdue.",
  "rows": [
    {
      "company_num": "600001",
      "company_name": "Placeholder Bakery Limited",
      "sector_label": "Food and beverage service",
      "routing_key": "T12",
      "filing_deadline": "2025-09-13",
      "days_to_deadline": -420,
      "days_overdue": 420,
      "est_penalty_eur": 1200
    }
  ],
  "filter": { "mode": "prospects", "overdue_only": true, "nace_prefixes": ["55", "56"], "area": "cork_county" },
  "sql": "SELECT ... WHERE overdue AND routing_key IN (?, ?) ORDER BY days_overdue DESC LIMIT ?",
  "params": ["T12", "T23", 10],
  "row_count": 6,
  "snapshot": { "fetched_at": "2026-11-07T09:12:00Z", "newest_reg_date": "2026-11-06", "stale": false }
}
```

`apps/web/dev/radar-mock.ts` has a full set of example responses, including a refusal and a clarifying question.

### The four stored questions

The page sends `preset` with one of these ids. Look the id up in your own dict (with `in`, so `__proto__`-style ids are just unknown), and return `400` with code `radar_question_invalid` for anything else. Never take a filter from the request.

| `preset` | Mode | What it returns | Sort |
|---|---|---|---|
| `overdue_cork_hospitality` | prospects | live companies, overdue, NACE division 55 or 56, Cork routing key | most days overdue first |
| `overdue_cork_city` | prospects | live companies, overdue, routing key T12 or T23 | most days overdue first |
| `clients_overdue` | clients | the user's clients that are overdue | most days overdue first |
| `clients_this_week` | clients | the user's clients with a deadline in the next 7 days | soonest first |

The rules for overdue, the deadline, days overdue and the penalty are in [03-data.md](03-data.md#derived-fields), with the facts still to verify. Cork routing keys are in [03-data.md](03-data.md#areas).

For a clients preset with an empty client list, return an `Answer` with no rows. The page shows its empty state before asking, so this is a fallback.

### Free-text questions

These are optional. Until the Claude step from [04-question-engine.md](04-question-engine.md) exists, answer any `question` with:

```python
raise AppError("radar_llm_unavailable", "Typed questions are not available yet. Try one of the example questions.", 503)
```

The page reads that code and offers the four stored questions instead, which still work.

### Being honest in "How this was worked out"

The page shows `filter`, `sql` and `params` under "The filter the AI chose" and "The query that ran". Put in exactly what your code ran. If you sort with pandas instead of SQL, put the pandas expression in `sql`. Do not write SQL that never ran: judges will ask how it works, and this panel is the answer.
