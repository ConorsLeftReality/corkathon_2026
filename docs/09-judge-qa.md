# Judge Q&A

Two minutes of Q&A after the pitch. Short answers first; the detail is for follow-ups.

## "Accountants already know their clients' dates."

They know them in a spreadsheet or practice software, and those dates drift when a client changes its annual return date. Filing Radar checks against the register itself, every day, and asks nothing of them but a question. And prospects mode is about companies they do *not* know yet.

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

## "Why a desk phone?"

Because answers should come through the channel busy people already use, and in a practice that is still the phone on the desk. It is not about selling hardware: the Pi is our test bench. The same engine works over any phone system that can call it, and Teams or WhatsApp voice are on the roadmap.

## "What happens if the API is down on stage?"

Phone options 1 and 2 and the stored example questions on the web never call the model. The data is local. Only free-text questions need the network.

## "How is it built?"

The CRO bulk CSV goes into DuckDB. Derived fields are computed in SQL. Claude Haiku, through a forced tool call, turns the question into the filter. Flask and React run the web page. On the phone, Asterisk on a Raspberry Pi calls our Python service over FastAGI, and Piper does the text to speech. [02-architecture.md](02-architecture.md) has the diagrams.
