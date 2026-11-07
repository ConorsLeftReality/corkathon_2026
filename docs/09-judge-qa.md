# Judge Q&A

Two minutes of Q&A after the pitch. Short answers first; the detail is for follow-ups.

## "Accountants already know their clients' dates."

They know them in a spreadsheet or practice software, and those dates drift when a client changes its annual return date. Dialed In checks against the register itself, every day, and asks nothing of them but a question. And prospects mode is about companies they do *not* know yet.

## "Isn't this a filtered spreadsheet?"

The data part is, on purpose: a filter you can read is how you trust the answer. What is new is how you get to it. You ask in plain English or by phone, it calls you in the morning, and it turns the register into new-business leads. A partner will not open a CSV with a row per company. They will pick up a phone.

## "Is the data fresh?"

It is as fresh as the CRO's file, and we measure that instead of trusting the label. The freshness gate checks the newest registration date in the file. Today it is {snapshot date}. If it is more than a week old, the page and the phone both say so.

> **VERIFY:** fill in the date from `bun run radar:check` before the pitch.

## "How do you define overdue?"

A live company whose filing deadline has passed. The filing deadline is the next annual return date plus the filing window. Days overdue is today minus that deadline. It is one line of SQL, in [03-data.md](03-data.md#derived-fields), and the same line runs for web and phone.

> **VERIFY:** the filing window (56 days in our notes) on cro.ie.

## "What stops it hallucinating?"

The model never answers. It fills in a filter with fixed fields, like sector, area and time window, and the filter has to pass a schema. Code turns that filter into parameterised SQL, DuckDB computes every date, penalty and count, and the sentence is built from the rows by a template. You can see the filter, the SQL, the row count and the snapshot date on screen. Out-of-scope questions, like a company's turnover, get a polite refusal from a fixed list.

## "Who pays, how much, how big?"

Accountancy and company secretarial practices, as a per-practice monthly subscription. Prospects mode is the hook: one new client a year pays for it. Pricing is not set; the next step is to show it to Cork practices and ask what they would pay.

> **VERIFY:** do not quote a market size or a price unless we have a source. If asked, say "we would size it from the number of registered practices in Ireland, and the UK is the bigger market".

## "Isn't cold-contacting overdue companies creepy?"

It is public register data, published by the state under an open licence for reuse. We use company data and the registered office address only. No personal data, no director details, nothing scraped. A practice writing to a company that is overdue is offering a fix for a real problem the company has, and how they contact it is their call under their own professional and marketing rules.

## "Was that phone call live?"

No, and we said so on stage. The spoken answer was recorded ahead of time from the same register data you saw on screen. The live version records your question, turns it into a filter, runs the same query and reads out the result. That design is in our docs, with the Asterisk dialplan, and it is the next thing we build.

## "Why a phone at all?"

Because answers should come through the channel busy people already use. In a practice that is the desk phone, and for most people at a firm like Frame it is a work mobile, between meetings or on the way to a client. It is not about selling hardware. The same answers can reach any phone, and Teams or WhatsApp voice are on the roadmap.

## "Why would a firm put this on personal work phones?"

Partners are rarely at their desk when a deadline matters. A call or a voice question reaches them wherever they are, with nothing new to learn. The data stays on the server: the phone only hears the answer.

## "What happens if the API is down on stage?"

Nothing in the demo calls an outside API. The CRO file, the Flask API and the web app all run on the laptop, and the example questions use stored filters with no AI.

## "How is it built?"

Answer with what is built on the day, then the design:

- **Built:** a Flask API imports the CRO Company Records CSV, works out each company's deadline and days overdue, and serves the results. Placeholder: one line on how the import and sorting work. A React web app shows the Today screen and the Filing deadlines page, with "How this was worked out" showing the exact filter and query behind every answer. The phone plays a pre-recorded answer.
- **Designed, next:** typed and spoken questions go to Claude, which may only fill in a fixed filter that code checks; code runs the query, so the AI never computes a date, count or penalty. On the phone, Asterisk records the question and Piper reads the answer. [02-architecture.md](02-architecture.md) has the diagrams.
