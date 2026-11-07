# Architecture

Everything on this page is **Planned** unless marked **Built**. The scaffold it sits on (Flask app factory, sign-in, SQLite, React shell, CI) is **Built**, see [scaffold.md](scaffold.md).

## Components

```mermaid
flowchart TB
  subgraph Source
    CRO[CRO Open Data Portal<br/>Company Records CSV]
  end

  subgraph Laptop["Laptop (demo machine)"]
    Fetch[radar.fetch + radar.load]
    DBL[(radar.duckdb)]
    Flask[Flask app<br/>/api/radar blueprint]
    React[React page<br/>/app/radar]
    SQLite[(SQLite<br/>users, client lists)]
  end

  subgraph Pi["Raspberry Pi"]
    DBP[(radar.duckdb copy)]
    Ast[Asterisk in Docker]
    AGI[FastAGI service<br/>radar.phone_agi]
    STT[speech to text]
    TTS[Piper TTS]
    Cron[cron: morning call file]
  end

  Phone[Cisco IP phone]
  Claude[Claude API]

  CRO --> Fetch --> DBL
  DBL -. copy file .-> DBP
  React -->|/api, same origin| Flask
  Flask --> DBL
  Flask --> SQLite
  Flask -->|question text only| Claude
  Phone <-->|SIP + RTP over eth0| Ast
  Ast -->|agi://127.0.0.1:4573| AGI
  AGI --> DBP
  AGI --> STT
  AGI --> TTS
  AGI -->|question text only| Claude
  Cron --> Ast
```

| Component | Where | What it does | Status |
|---|---|---|---|
| Flask app | `apps/api/corkathon_api/app.py` | App factory, sign-in, rate limits, serves the built React app | Built |
| React shell | `apps/web/src/shell/Shell.tsx` | Signed-in layout and nav | Built |
| Radar feature (API) | `apps/api/corkathon_api/features/radar/` | Loader, rules, filter schema, router, query, answer, routes | Planned |
| Radar feature (web) | `apps/web/src/features/radar/`, `apps/web/src/routes/RadarPage.tsx` | Question box, mode switch, example questions, answer, ledger table, working paper (honesty panel), loading, empty, error and stale states | Built against a stubbed API (e2e stubs `/api/radar/*`) |
| Today screen (web) | `apps/web/src/routes/TodayPage.tsx`, `features/radar/TodayPanel.tsx` | Signed-in home at `/app`: data freshness, the web version of the morning briefing (clients overdue and due in 7 days, via the `clients_overdue` and `clients_this_week` presets, no AI), client list paste or CSV upload | Built against a stubbed API |
| DuckDB file | `apps/api/data/radar.duckdb` (gitignored) | The loaded snapshot plus derived fields | Planned |
| Asterisk | `telephony/` on the Pi | Registers the phone, runs the menu dialplan, records questions, plays answers | Planned |
| FastAGI service | `radar.phone_agi`, on the Pi | Takes calls from the dialplan, runs the same engine, returns an audio file | Planned |
| Claude API | external | Turns question text into a filter JSON. Nothing else | Planned |

### Planned module layout

```
apps/api/corkathon_api/features/radar/
  settings.py       RadarSettings, env vars (see 06-runbook)
  fetch.py          download companies.csv.zip from the CRO portal, unzip
  load.py           build radar.duckdb: typed table plus derived columns
  freshness.py      snapshot.json: fetched_at, newest company_reg_date, stale flag
  rules.py          filing window, penalty formula, as-of date
  areas.py          named areas to Eircode routing keys
  nace.py           NACE v2 code to sector label
  filter_schema.py  RadarFilter pydantic model, the one source of the JSON Schema
  router.py         question text to RadarFilter via Claude
  query.py          RadarFilter to parameterised SQL
  answer.py         rows to a web sentence or a spoken sentence
  models.py         ClientCompany rows, one per user per company number
  routes.py         /api/radar blueprint
  speech.py         speech to text and Piper wrappers
  phone_agi.py      FastAGI server for Asterisk
  briefing.py       morning briefing text
  demo_clients.py   writes a sample client list for the demo
apps/web/src/features/radar/
  radar-api.ts      zod schemas and calls
  AskPanel.tsx  ResultsTable.tsx  HonestyPanel.tsx  ClientListPanel.tsx
telephony/
  compose.yml  asterisk/  callfiles/  dnsmasq/  sounds/
```

This follows the repo rule of one folder per feature (see `AGENTS.md`). `features/notes` is the template and gets deleted once Radar needs the space.

### Why the engine runs in two places

The venue wifi may block devices from talking to each other (client isolation). So the laptop and the Pi do not depend on reaching each other. Both run the same Python package against their own copy of the same `radar.duckdb`, and both reach the internet only for the Claude API. The phone is wired straight into the Pi. See [decisions.md](decisions.md#direct-phone-to-pi-network).

## Web question flow

```mermaid
sequenceDiagram
  actor U as Accountant
  participant W as React /app/radar
  participant F as Flask /api/radar/ask
  participant R as router.py
  participant C as Claude API
  participant Q as query.py
  participant D as DuckDB
  participant A as answer.py

  U->>W: types "overdue Cork restaurants"
  W->>F: POST {question, mode}
  F->>R: question
  R->>C: question + schema (forced tool call)
  C-->>R: filter JSON
  R->>R: validate with RadarFilter
  alt invalid twice, or action is clarify or refuse
    R-->>F: clarifying question or refusal
    F-->>W: {kind: clarify | refuse, message}
  else valid
    R-->>F: RadarFilter
    F->>Q: filter (+ user's client numbers in clients mode)
    Q->>D: SQL with bound parameters
    D-->>Q: rows + total count
    Q-->>F: rows, count, SQL text
    F->>A: rows, count, snapshot
    A-->>F: answer sentence
    F-->>W: {answer, rows, filter, sql, row_count, snapshot}
  end
  W-->>U: answer, table, honesty panel
```

### Planned API

| Method and path | Auth | Body or query | Returns |
|---|---|---|---|
| `POST /api/radar/ask` | `@jwt_required()` | `{mode: "clients" \| "prospects", question: string (1-300 chars)}` or `{mode, preset: string}` | `{kind: "answer", answer, rows, filter, sql, params, row_count, snapshot}` or `{kind: "clarify" \| "refuse", message, snapshot}` |
| `GET /api/radar/snapshot` | `@jwt_required()` | none | `{fetched_at, newest_reg_date, stale}` |
| `GET /api/radar/clients` | `@jwt_required()` | none | `{company_numbers: string[]}`, the signed-in user's list |
| `PUT /api/radar/clients` | `@jwt_required()` | `{company_numbers: string[]}`, max 2,000, each 1 to 8 digits | `{company_numbers: string[]}`, the saved list |
| `GET /api/radar/companies/<num>` | `@jwt_required()` | none | one company brief (stretch) |

`preset` is the id of a stored filter (`overdue_cork_hospitality`, `overdue_cork_city`, `clients_this_week`, `clients_overdue`, defined in `apps/web/src/features/radar/radar-api.ts`). The server looks the id up in its own allowlist and runs that filter with no call to Claude; an unknown id is `radar_question_invalid`. The browser never sends a filter. The zod schema in `radar-api.ts` is the response contract the API must meet.

Company numbers travel as strings so leading zeros survive. The web page checks the format before sending, and the server checks it again, since the browser can be bypassed.

> **VERIFY:** the CRO company number format (the web page accepts 1 to 8 digits). Check against the `companies.csv` header and a sample of rows.

Client lists are user data, so every query filters by `signed_in_user().id`, and `routes_test.py` proves user B cannot read user A's list (repo rule in `AGENTS.md`).

Planned `AppError` codes: `radar_question_invalid`, `radar_llm_unavailable`, `radar_no_clients`, `radar_data_missing`, `radar_company_not_found`. The web client switches on `code`, never on the message.

## Phone call flow

```mermaid
sequenceDiagram
  actor U as Accountant
  participant P as Cisco phone
  participant A as Asterisk (Pi)
  participant G as FastAGI radar.phone_agi
  participant S as speech to text
  participant C as Claude API
  participant D as DuckDB (Pi)
  participant T as Piper TTS

  U->>P: dials 100
  P->>A: SIP INVITE
  A-->>U: "Press 1 for this week's deadlines, 2 for overdue Cork companies, 3 to ask a question"
  alt presses 1 or 2
    A->>G: AGI week | overdue_cork
    G->>D: fixed SQL, no AI
  else presses 3
    A-->>U: beep
    U->>A: speaks question
    A->>A: Record() stops on 2 s of silence
    A->>G: AGI ask + wav path
    G->>S: 16 kHz wav
    S-->>G: question text
    G->>C: question + schema
    C-->>G: filter JSON (validated)
    G->>D: SQL with bound parameters
  end
  D-->>G: rows + count
  G->>G: spoken answer, max 3 items + count + snapshot
  G->>T: text
  T-->>G: wav, converted to 8 kHz mono
  G-->>A: SET VARIABLE RADAR_REPLY
  A-->>U: plays answer, "the full list is on your screen"
  A-->>U: back to menu
```

If speech to text or Claude fails or takes too long, the service returns a prerecorded "I could not work that out, press 1 or 2" prompt. Detail in [05-telephony.md](05-telephony.md).

## Morning briefing flow

```mermaid
sequenceDiagram
  participant Cron as cron or dial 199
  participant Sh as place_briefing.sh
  participant Sp as /var/spool/asterisk/outgoing
  participant A as Asterisk
  participant P as Cisco phone
  participant G as FastAGI
  participant D as DuckDB

  Cron->>Sh: run (weekdays 08:30, or on demand)
  Sh->>Sh: write call file to a temp path
  Sh->>Sp: mv into the spool (atomic)
  Sp->>A: Asterisk picks it up
  A->>P: rings the desk phone
  P-->>A: answered
  A->>G: AGI briefing
  G->>D: today's deadlines for the demo client list
  G-->>A: RADAR_REPLY audio
  A-->>P: plays briefing, hangs up
```

To trigger it on demand, dial `199` on the desk phone: Asterisk runs `place_briefing.sh 10`, you hang up, and the phone rings 10 seconds later. See [05-telephony.md](05-telephony.md#morning-briefing).
