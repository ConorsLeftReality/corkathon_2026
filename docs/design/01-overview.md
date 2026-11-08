# Overview

## The idea in one sentence

Dialed-In tells an accountant, on a web page or their phone, which companies are about to miss or have already missed a CRO filing deadline, using the free daily company register, and shows exactly how it got the answer.

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

