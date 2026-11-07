# Limits and roadmap

## What Filing Radar cannot do

These apply to the planned design. They are said out loud in the demo and shown in the product.

| Limit | Why | How the product shows it |
|---|---|---|
| A daily snapshot, not real time | We load the CRO's bulk file. A return filed this morning still shows as due until the next file | Snapshot date on every web and phone answer; stale banner from the freshness gate |
| The file may update less often than "daily" | A data.gov.ie page showed an old "last updated" date | Freshness gate measures it from the data and says so |
| `nard` can lag when a company nominates a new annual return date | The register updates after the change is processed | Listed here; a client can be marked "date changed" by the user (roadmap) |
| No Revenue (tax) deadlines | Not in the CRO data | Refusal template for tax questions |
| No beneficial ownership, director or personal data | Not in the dataset we use, and we do not want it | Registered office and company data only |
| Penalty figures are estimates, not legal advice | Our formula from public rules, not a CRO bill | Always "about" and "estimated"; rule pending verification |
| Audit exemption flag needs filing history | The companies file alone does not show whether the last return was late | Shows "unknown" until the Financial Statements dataset is loaded |
| Area filters miss companies without a valid Eircode | Not every registered office has one in the file | Excluded count in the honesty panel |
| Irish companies only | One registry | Stated in the pitch |
| The phone demo plays a pre-recorded answer | The live voice pipeline (record, speech to text, filter, text to speech) is designed but not built | Said out loud in the pitch; the design is in 05-telephony.md |
| Typed questions need the Claude step, which is not built | The web page offers the stored example questions instead | Example questions run with no AI and are labelled that way in the honesty panel |
| The model can misread a question | It is a language model | The filter it chose is always visible, and the answer is computed by code from that filter |

> **VERIFY:** the filing window, the penalty and the audit exemption rule before any of them is shown as more than an estimate. See [03-data.md](03-data.md#derived-fields).

## Roadmap

Ordered by what a paying practice would ask for first.

| Next | What | Why |
|---|---|---|
| 1 | Email and calendar alerts for clients mode | The morning call for people without a desk phone |
| 2 | Import client lists from practice software exports | Today it is a CSV of company numbers |
| 3 | Financial Statements dataset, so the audit exemption flag works | It is the strongest reason to chase a client |
| 4 | Revenue deadlines | The other half of a practice's calendar; needs a source we do not have yet |
| 5 | Live voice on any phone: desk phones, personal work mobiles, Teams and WhatsApp | Same engine, the channels people use at their desk and on the move. Today the phone answer is pre-recorded |
| 6 | Company brief page | Status, filing history, late filings, sector on one screen (stretch goal today) |
| 7 | UK: Companies House | Similar open company data; a much larger market for prospects mode |
| 8 | Cayman Islands and US filing deadlines | Matches Frame's offices in Grand Cayman and New York; needs per-jurisdiction rules and data access |
