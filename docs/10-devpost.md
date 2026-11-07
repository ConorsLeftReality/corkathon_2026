# Devpost

Ready to paste. Written as if everything shipped. **Before 18:30, delete or reword every sentence about a feature that is not working**, and fill in the placeholders in braces. Devpost locks at 19:00.

---

## Inspiration

Frame asked us to take data that exists today and turn it into something a busy person can act on. Every Irish company files an annual return with the CRO, and the CRO publishes the whole register as free open data. Accountants still track filing deadlines in spreadsheets and practice software, and nobody uses the register to spot companies that have already missed theirs. We wanted a partner in a practice to get an answer by asking a question, not by opening a CSV.

## What it does

Filing Radar answers two questions for accountancy practices, from the CRO's open company register:

- **Prospects:** "Which Cork hospitality companies are overdue on their annual return?" gives a ranked list of overdue companies: new-business leads, with days overdue and an estimated late penalty.
- **Clients:** "Who do I need to chase this week?" checks the practice's own client list against the register.

You can ask on a web page or by dialling 100 on a desk phone: press 1 for this week's deadlines, 2 for overdue Cork companies, or 3 to ask out loud. Every morning the phone rings and reads out that day's deadlines.

Every web answer shows how it was made: the filter, the SQL, the row count and the date of the data. If the data is more than a week old, it says so.

## How we built it

- **Data:** the CRO Company Records bulk file (CC BY 4.0), loaded into DuckDB. A freshness gate checks the newest registration date in the file instead of trusting the "daily" label.
- **Rules in SQL:** filing deadline, days overdue, estimated penalty, Eircode routing key for areas, NACE sector labels. All computed in code from a fixed date.
- **Plain English:** Claude Haiku, through a forced tool call, turns the question into a JSON filter that must pass a pydantic schema. Code turns the filter into parameterised SQL. The model never writes SQL, never computes a date, penalty or count, and never sees company rows. Answer sentences are templates filled from the result rows.
- **Web:** Flask API and React page, with sign-in so each practice's client list stays private.
- **Phone:** a Cisco IP phone wired straight to a Raspberry Pi running Asterisk in Docker, with the Pi giving out addresses on its ethernet port so the venue wifi never matters. The dialplan calls our Python service over FastAGI, which runs the same engine. Speech to text with {whisper.cpp or chosen service}, speech out with Piper. The morning briefing is an Asterisk call file dropped into the outgoing spool.

## Challenges we ran into

- {Fill in on the day. Candidates: getting the Cisco phone to register, venue network client isolation, CRO column names and date formats, freshness of the "daily" file, audio sample rates between Asterisk, whisper and Piper.}

## Accomplishments that we're proud of

- An AI feature you can audit: every answer shows the exact filter and SQL that produced it.
- Phone options that keep working with no AI and no internet.
- {Fill in.}

## What we learned

- {Fill in. Candidates: how CRO filing rules work, how much of a "natural language" product is really a well-designed schema, FastAGI, the gap between "updated daily" and the data.}

## What's next

- Email and calendar alerts for client deadlines
- Importing client lists from practice software
- The CRO Financial Statements dataset, to flag clients at risk of losing their audit exemption
- Revenue deadlines
- Teams and WhatsApp voice
- The UK, using Companies House open data, then Cayman Islands and US filings

## Built with

{Delete any not used:} python, flask, duckdb, claude, anthropic-api, pydantic, react, typescript, vite, tailwind, bun, uv, asterisk, docker, raspberry-pi, cisco, piper, whisper-cpp, sox, dnsmasq, cro-open-data

---

Data attribution for the Devpost page: Contains Companies Registration Office data, licensed under CC BY 4.0.
