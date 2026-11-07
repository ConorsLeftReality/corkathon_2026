# Overview

## The idea in one sentence

Dialed In tells an accountant, on a web page or their phone, which companies are about to miss or have already missed a CRO filing deadline, using the free daily company register, and shows exactly how it got the answer.

## The problem

Every Irish company files an annual return with the Companies Registration Office (CRO) once a year. Miss the deadline and the company pays a late filing penalty and can lose its audit exemption.

> **VERIFY:** the filing window (reportedly 56 days after the annual return date), the penalty (reportedly 100 euro plus 3 euro a day, capped at 1,200 euro) and the audit exemption rule. Confirm all three on cro.ie. See [03-data.md](03-data.md#derived-fields).

For an accountancy or company secretarial practice that means two jobs:

1. **Keep clients out of trouble.** Know which clients have a return due soon and chase them before the deadline. Today this lives in practice software, spreadsheets and people's heads, and the dates drift when a client changes its annual return date.
2. **Find new clients.** A company that is already overdue is a company without a working filing process. That is a warm lead for a practice, and the CRO publishes the data to find them for free. Nobody turns it into a list a partner can act on.

The data exists. It sits in a CSV with a row for every company on the register, which a busy partner will never open.

## Who it is for

| User | What they want | Mode |
|---|---|---|
| Partner or business development lead at a small or mid-size accountancy practice | New clients in their area and sector | Prospects |
| Company secretarial staff at a practice or corporate services firm | Which clients to chase this week | Clients |
| Sole practitioner | Both, without learning a tool | Both, by phone |

They are not technical. They will not write a query, learn a filter UI or read documentation.

## Two modes, one engine

| Mode | Example question | Output | Status |
|---|---|---|---|
| **Prospects** (the startup angle) | "Which Cork hospitality companies are overdue on their annual return?" | Ranked list of overdue companies with registered office area, sector, days overdue and estimated penalty | Planned |
| **Clients** | "Who do I need to chase this week?" | The user's own clients with a filing deadline in the window, soonest first | Planned |

Both modes run the same pipeline: question, then a validated filter, then SQL, then rows, then an answer. Clients mode adds one condition, `company_num IN (the user's list)`. See [04-question-engine.md](04-question-engine.md).

## Two channels

| Channel | How | Status |
|---|---|---|
| **Web page** | Question box, short answer, ranked table, and the honesty panel: filter JSON, SQL, row count, snapshot date | Planned |
| **Desk phone** | Dial 100. Press 1 for this week's deadlines, 2 for overdue Cork companies, 3 to ask a question out loud | Planned |
| **Morning briefing** | The phone rings in the morning and reads the day's key deadlines | Planned |

Options 1 and 2 on the phone are fixed queries with no AI in the path, so they work even if the Claude API is down. See [05-telephony.md](05-telephony.md).

## How we meet the judging criteria

### Frame: "what great looks like"

| Frame asks for | Where we deliver it | Status |
|---|---|---|
| A clear idea in one sentence | The sentence at the top of this page and the README | Done |
| Honest about its limits | Honesty panel on every answer (filter, SQL, row count, snapshot date); freshness gate that says "stale" out loud; [08-limits-and-roadmap.md](08-limits-and-roadmap.md); out-of-scope questions get a polite refusal | Planned |
| Usable by non-technical people | Plain English questions on the web, a desk phone with three buttons, no query language, no training | Planned |

### Frame: scoring (equal weight)

| Criterion | What judges will see | Status |
|---|---|---|
| Innovation (a dashboard alone will not score) | Ask by voice on a desk phone; the phone rings you with a morning briefing; turns a public register into new-business leads | Planned |
| Impact (who, how, why) | Practices avoid client penalties and find overdue companies to win as clients; see [Who it is for](#who-it-is-for) | Planned |
| Technical depth (real data, sensible transforms, explainable design) | Real CRO bulk data in DuckDB; derived fields with written formulas in [03-data.md](03-data.md); LLM limited to a schema-checked filter, code does all maths ([04-question-engine.md](04-question-engine.md)); Asterisk dialplan and FastAGI ([05-telephony.md](05-telephony.md)) | Planned |
| Presentation and demo (data driving the result live) | Live question on stage, honesty panel shows the SQL and row count, live phone call through the lectern mic; [07-demo-and-pitch.md](07-demo-and-pitch.md) | Planned |

### Frame: pain points

| Pain point | Our answer | Status |
|---|---|---|
| Timing matters, answers go stale | Daily snapshot, snapshot date on every answer, freshness gate, morning call | Planned |
| Data is scattered | One register, one engine, two channels | Planned |
| Users are not technical | Plain English and a desk phone | Planned |

### IGNITE Best Startup Potential

| IGNITE asks for | Our answer | Status |
|---|---|---|
| A clear customer | Accountancy and company secretarial practices in Ireland | Defined |
| A real problem | Late filings cost clients money; practices need new clients; the data to solve both is free and unused | Defined |
| A first version people would use or pay for | Prospects mode is a lead list a practice can act on the same day; a per-practice subscription is the model (see [09-judge-qa.md](09-judge-qa.md#who-pays-how-much-how-big)) | Planned |

### Event judging

| Criterion | Covered by |
|---|---|
| Innovation and impact | Frame Innovation and Impact rows above |
| Technical depth | Frame Technical depth row above |
| Presentation and demo | [07-demo-and-pitch.md](07-demo-and-pitch.md): 3 minutes plus 2 minutes Q&A, Boole 2 from 19:35 if we make the top 10 |
