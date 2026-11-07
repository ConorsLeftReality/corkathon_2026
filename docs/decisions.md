# Decisions

Short records of choices that shape the build. Newest at the bottom.

## DuckDB over Postgres

**Decision:** load the CRO file into a local DuckDB file.

**Why:** the data is one CSV, read far more than written, and queried with filters and aggregates over every row, which suits a columnar engine. DuckDB reads CSV directly, runs in-process with no server, and the database is one file we can copy to the Pi. The demo needs no network for queries.

**Cost:** a new dependency. User data (accounts, client lists) stays in the scaffold's SQLite, so there are two stores. That is fine: one is a read-only snapshot, the other is user data.

## LLM as router, not calculator

**Decision:** Claude only maps a question to a schema-checked filter. Code computes every date, money figure and count, and writes the answer from templates.

**Why:** Frame will ask how it works and whether it makes things up. A filter you can show is an answer to both. Language models are unreliable at date maths and counting; SQL is not. It also means only the question text leaves the machine.

**Cost:** questions the schema cannot express get a clarifying question or a refusal instead of a best guess. We accept that.

## Fixed DTMF options alongside voice

**Decision:** phone options 1 and 2 are fixed queries with no AI. Option 3 is the voice question.

**Why:** speech to text on 8 kHz phone audio in a noisy hall, plus a network call to Claude, is the riskiest path in the project. Options 1 and 2 cover the two questions we most want to demo and work with the wifi down. Option 3 is cut at the 16:00 freeze if it is not stable.

## Direct phone-to-Pi network

**Decision:** the phone plugs into the Pi's ethernet port; the Pi runs DHCP on `eth0` and uses wifi only for the internet.

**Why:** venue wifi often isolates clients from each other, and we cannot plug into the venue's wired network. A private two-device network removes that risk, and binding SIP to `eth0` keeps the PBX off the venue network.

**Cost:** the laptop cannot reach the Pi without a switch, so both run their own copy of the engine and the data snapshot. See [02-architecture.md](02-architecture.md#why-the-engine-runs-in-two-places).

## React on the existing Flask scaffold, not Streamlit

**Decision:** the web page is a React route on the team's Flask scaffold. The original plan said Streamlit.

**Why:** the scaffold already gives sign-in (needed for private client lists), CI, e2e tests at 360px and 1440px, and a one-container deploy. A Streamlit app would sit outside all of that, and per-user client lists would need their own auth. The honesty panel is a straightforward component in React.

**Cost:** more frontend work than a Streamlit page for the question box and table. Taken on 7 Nov 2026 after reviewing the repo.

## FastAGI between Asterisk and the engine

**Decision:** the dialplan calls `agi://127.0.0.1:4573/...` instead of running a script inside the container.

**Why:** the Asterisk container stays stock, and the phone uses the same Python package, DuckDB file and settings as the web. The protocol is simple enough to speak with the standard library.

## Model writes no user-facing text

**Decision:** clarify and refuse responses are enums the model picks; the words come from templates in `answer.py`.

**Why:** it closes the last route for model text to reach a user, including through prompt injection, at the cost of fewer phrasings.
