# Data

Everything on this page is **Planned**. Column names and rule figures are taken from the plan and must be checked against the real file and cro.ie before the demo. Each unchecked item carries a VERIFY marker.

## Source

| | |
|---|---|
| Publisher | Companies Registration Office (CRO), Ireland |
| Dataset | Company Records |
| Landing page | https://opendata.cro.ie/dataset/companies |
| Mirror | https://data.gov.ie/en_GB/dataset/companies |
| Bulk file | `companies.csv.zip` |
| API | CKAN, https://opendata.cro.ie/api/3/action/datastore_search |
| Licence | CC BY 4.0 |
| Stated update frequency | Daily |

> **VERIFY:** that the bulk file really updates daily. One data.gov.ie page showed "last updated 12 November 2025" despite saying daily. The freshness gate below decides this from the data itself, and the result goes in this table.

> **VERIFY:** the download URL of `companies.csv.zip`. `fetch.py` plans to look it up through CKAN `package_show?id=companies` rather than hardcode it; confirm that dataset id.

Optional second source: the CRO **Financial Statements** dataset (submission dates and accounts-to dates). Only the audit exemption flag needs it. **Planned, stretch.**

## Attribution

Shown in the web footer, the README and the Devpost page:

> Contains Companies Registration Office data, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Source: CRO Open Data Portal, Company Records dataset, snapshot of {snapshot date}.

> **VERIFY:** whether the CRO portal asks for specific attribution wording.

## Fields we use

> **VERIFY:** every column name against the header row of `companies.csv`. The number, name and status column names below are placeholders until then. Also check the date format, so the `TRY_CAST` calls in `load.py` parse it.

| Column | Meaning | Used for |
|---|---|---|
| `company_num` (placeholder) | CRO company number | key, clients mode match |
| `company_name` (placeholder) | Registered name | display |
| `company_status` (placeholder) | e.g. Normal, Dissolved | only live companies can be overdue |
| `company_type` | e.g. private limited by shares | display, filters later |
| `company_reg_date` | Date of incorporation | freshness gate |
| `last_ar_date` | Last annual return date | display, audit flag |
| `nard` | Next annual return date | every deadline calculation |
| `last_accounts_date` | Last accounts date | company brief |
| `company_status_date` | When the status last changed | company brief |
| `comp_dissolved_date` | Dissolution date | excluded from leads |
| `nace_v2_code` | NACE Rev. 2 activity code | sector filter and label |
| `princ_object_code` | Principal object code | fallback sector when NACE is blank |
| `eircode` | Registered office Eircode | area filter |
| `company_address_1` to `company_address_4` | Registered office address | display |

> **VERIFY:** the exact `company_status` values (for example whether active companies are "Normal"), and whether `last_ar_date` is the date the return was made up to or the date it was filed. The audit exemption flag depends on the second one.

> **VERIFY:** the format of `nace_v2_code` in the file (`5610`, `56.10` or something else). `load.py` strips it to digits only.

## Fetch and load

```bash
bun run radar:fetch
bun run radar:check
```

These are planned `package.json` aliases for:

```bash
uv run --directory apps/api python -m corkathon_api.features.radar.fetch
uv run --directory apps/api python -m corkathon_api.features.radar.freshness
```

`fetch.py` downloads the zip to `apps/api/data/`, unzips `companies.csv`, records the SHA-256, and calls `load.py`. `load.py` builds `apps/api/data/radar.duckdb`:

```sql
CREATE OR REPLACE TABLE companies AS
SELECT
  company_num,
  company_name,
  company_status,
  company_type,
  TRY_CAST(company_reg_date AS DATE)     AS company_reg_date,
  TRY_CAST(last_ar_date AS DATE)         AS last_ar_date,
  TRY_CAST(nard AS DATE)                 AS nard,
  TRY_CAST(last_accounts_date AS DATE)   AS last_accounts_date,
  TRY_CAST(company_status_date AS DATE)  AS company_status_date,
  TRY_CAST(comp_dissolved_date AS DATE)  AS comp_dissolved_date,
  regexp_replace(coalesce(nace_v2_code, ''), '[^0-9]', '', 'g') AS nace_digits,
  princ_object_code,
  upper(replace(coalesce(eircode, ''), ' ', ''))               AS eircode_clean,
  company_address_1, company_address_2, company_address_3, company_address_4
FROM read_csv('data/companies.csv', header = true, all_varchar = true);
```

Reading everything as text first and casting with `TRY_CAST` means one bad date becomes `NULL` instead of failing the whole load. `load.py` logs how many rows have a `NULL` `nard` so the count shows up in the caveats below.

The demo needs no network once this file exists. The same `radar.duckdb` is copied to the Pi (see [06-runbook.md](06-runbook.md)).

## Freshness gate

`freshness.py` writes `apps/api/data/snapshot.json`:

```json
{
  "source_url": "https://...companies.csv.zip",
  "fetched_at": "2026-11-07T09:12:00Z",
  "file_sha256": "...",
  "row_count": 0,
  "newest_reg_date": "2026-11-06",
  "stale": false
}
```

The rule:

```
newest_reg_date = max(company_reg_date)
stale           = newest_reg_date < as_of_date - RADAR_STALE_DAYS   (default 7)
```

New companies register every working day, so the newest registration date tracks how recent the file is. Seven days leaves room for weekends and bank holidays.

When `stale` is true:
- the web page shows a banner: "This data is from {newest_reg_date}. Deadlines may have moved since then."
- the phone adds: "Note, this data is more than a week old."
- `bun run radar:check` exits with code 1.

The snapshot date appears on every answer regardless.

## Derived fields

`as_of_date` is today, unless `RADAR_AS_OF` is set (for a reproducible demo). All derived fields are computed in SQL at query time in `query.py` from a bound `as_of` parameter, so nothing goes stale inside the DuckDB file. The constants live in one place, `rules.py`.

| Field | Formula (DuckDB SQL) | Notes |
|---|---|---|
| `filing_deadline` | `nard + INTERVAL (FILING_WINDOW_DAYS) DAY` | `FILING_WINDOW_DAYS = 56` |
| `days_to_nard` | `date_diff('day', $as_of, nard)` | negative once the annual return date has passed |
| `days_to_deadline` | `date_diff('day', $as_of, filing_deadline)` | drives "due this week" |
| `is_live` | `company_status = 'Normal' AND comp_dissolved_date IS NULL` | status value to verify |
| `overdue` | `is_live AND $as_of > filing_deadline` | |
| `days_overdue` | `CASE WHEN overdue THEN date_diff('day', filing_deadline, $as_of) ELSE 0 END` | |
| `est_penalty_eur` | `CASE WHEN overdue THEN least(PENALTY_BASE + PENALTY_PER_DAY * days_overdue, PENALTY_CAP) ELSE 0 END` | `100`, `3`, `1200`; an estimate, never shown as a fact |
| `routing_key` | `CASE WHEN regexp_matches(eircode_clean, '^([AC-FHKNPRTV-Y][0-9]{2}\|D6W)') THEN left(eircode_clean, 3) END` | first 3 characters of the Eircode |
| `nace_division` | `left(nace_digits, 2)` | |
| `sector_label` | join `nace_divisions` lookup on `nace_division` | |
| `audit_exemption_at_risk` | see below | `NULL` means unknown |

> **VERIFY:** that an annual return must be filed within 56 days of the annual return date, and whether `nard` is the annual return date itself or already the filing deadline. If it is the deadline, set `FILING_WINDOW_DAYS = 0`.

> **VERIFY:** the late filing penalty, reportedly 100 euro plus 3 euro per day, capped at 1,200 euro per return. This comes from a third-party summary; confirm on cro.ie.

### Audit exemption flag

> **VERIFY:** the rule. The plan states that two consecutive late returns lose the audit exemption. Confirm the exact rule, and for which financial years it applies, on cro.ie or in the Companies Act 2014 before this flag is shown to anyone.

```
late_now    = overdue OR (is_live AND days_to_deadline BETWEEN 0 AND 14)
late_before = previous return filed after its own deadline
              (needs a submission date from the Financial Statements dataset:
               submission_date > last_ar_date + FILING_WINDOW_DAYS)
audit_exemption_at_risk = late_now AND late_before
```

Without the Financial Statements dataset, `late_before` is `NULL`, so the flag is `NULL`, and the UI shows "unknown". We never guess this one.

### Sector labels

`nace.py` holds a small lookup of NACE Rev. 2 divisions to plain labels. The ones the demo questions use:

| Division | Label | Plain words the router maps to it |
|---|---|---|
| 55 | Accommodation | hotels, B&Bs, hostels, accommodation |
| 56 | Food and beverage service | restaurants, cafes, pubs, bars, catering |
| 55, 56 | Hospitality (section I) | hospitality |
| 41, 42, 43 | Construction | builders, construction |
| 69 | Legal and accounting | accountants, solicitors |

> **VERIFY:** the source of the full division list (Eurostat or CSO NACE Rev. 2 tables) before adding more rows.

### Areas

`areas.py` maps named areas to Eircode routing keys. The router may only pick a named area or pass routing keys the user typed. It never invents keys.

| Named area | Routing keys |
|---|---|
| `cork_city` | T12, T23 |
| `cork_county` | `cork_city` plus T34, T45, T56, P12, P14, P17, P24, P25, P31, P32, P36, P43, P47, P51, P56, P61, P67, P72, P75, P81, P85 |

> **VERIFY:** every routing key in this table against the official Eircode routing key map. These are a starting list, not checked.

Companies with no usable Eircode get `routing_key = NULL` and never match an area filter. The honesty panel shows how many rows that excluded. We do not fall back to matching the word "Cork" in the address text, because "Cork Street, Dublin 8" would match.

## Data quality caveats

| Caveat | Effect | What we do |
|---|---|---|
| Daily snapshot, not real time | A return filed this morning still shows as due | Snapshot date on every answer |
| `nard` may lag when a company nominates a new annual return date | Deadline can be wrong by months for that company | Listed in [08-limits-and-roadmap.md](08-limits-and-roadmap.md) |
| Missing or invalid Eircodes | Company drops out of area filters | Count shown in the honesty panel |
| Blank NACE codes | Company drops out of sector filters | `princ_object_code` fallback, planned |
| Unparseable dates | `NULL` after `TRY_CAST` | Row excluded from deadline maths, count logged by `load.py` |
| Penalty is our estimate from public rules | Not a bill | Always worded "about" and "estimated" |
| Registered office address only | No director or personal data | By design, see [09-judge-qa.md](09-judge-qa.md) |
