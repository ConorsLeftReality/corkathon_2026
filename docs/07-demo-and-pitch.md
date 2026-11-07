# Demo and pitch

Top 10 teams pitch live in Boole 2 from 19:35: **3 minutes, then 2 minutes of Q&A.** Frame wants to see the data driving the result live, and clarity beats polish.

Everything demoed here is **Planned**. Cut any beat whose feature is not working by 16:00, and use the backup for it.

## Roles

| Role | Who | Does |
|---|---|---|
| Speaker | Placeholder: name | Talks, stands at the lectern |
| Driver | Placeholder: name | Types on the laptop, switches modes, opens the honesty panel |
| Phone | Placeholder: name | Dials, holds the phone speaker to the lectern mic |

## Script (3:00)

| Time | Beat | On screen or phone | Say (roughly) |
|---|---|---|---|
| 0:00 to 0:20 | **Pain** | Title slide or the empty Radar page | "It's November. Which of your clients have to file with the CRO in December? If you're an accountant, the answer is in a spreadsheet, practice software and someone's head. Miss one and your client pays a late penalty and can lose their audit exemption." |
| 0:20 to 0:45 | **Live question, clients** | Driver types "Which of my clients file in December?" in Clients mode | "This is Filing Radar. Plain English, no query language. It reads the CRO's own register, downloaded today. Here are the clients, soonest first." |
| 0:45 to 1:20 | **Prospects mode** | Driver switches to Prospects, types "Which Cork hospitality companies are overdue on their annual return?" | "Now flip it round. These Cork cafes, hotels and pubs are already overdue. Each one is a business without a working filing process, which makes it a lead for a practice. Same engine, same data, free and public." |
| 1:20 to 1:40 | **Phone** | Phone dials 100, presses 2, speaker to the mic | "Busy people don't open dashboards, so it's on the phone they already have. Dial 100, press 2." (let it play) |
| 1:40 to 2:05 | **Show the filter** | Driver opens the honesty panel | "How do you know it isn't making this up? The AI does one job: it turns the question into this filter. Code runs this SQL on the real file. Here's the row count and the snapshot date. The AI never calculates a date, a penalty or a count." |
| 2:05 to 2:20 | **Limits** | Honesty panel still open, point at the snapshot date | "What it can't do: it's a daily snapshot, not live. Penalties are estimates, not legal advice. Irish companies only, for now." |
| 2:20 to 2:50 | **Who pays and what's next** | Phone dials 199 at 2:20 and hangs up | "Who pays? Accountancy practices, per practice, per month. Prospects mode pays for itself with one new client. Next: Revenue deadlines, and the UK, where Companies House publishes similar open data." |
| 2:50 to 3:00 | **Close** | Phone rings, put it on speaker for two seconds | "And that's tomorrow's 8:30 briefing calling. Filing Radar: deadlines you can act on, from data that already exists." |

Fill in before going on stage:

- the snapshot date: "downloaded today" only if `bun run radar:check` showed today's or yesterday's date. If the data is stale, say "the CRO's latest file is from {date}, and the banner tells you so"
- one real number from the prospects answer, for example "{N} Cork hospitality companies are overdue right now"

> **VERIFY:** the penalty and audit exemption wording in the pain beat against cro.ie before saying it on stage. If unconfirmed, say "can face late penalties" and drop the audit exemption line.

> **VERIFY:** how often the Companies House bulk data updates, before mentioning it in Q&A.

## Stage setup

- Laptop on HDMI to the projector, browser zoom 125 percent, Radar page already open and signed in.
- Desk phone and Pi on the lectern table. One power strip for the Pi, PoE injector and laptop.
- Phone audio: put the phone on speaker and hold the phone's speaker about 5 cm from the lectern mic. Test this in the room if allowed. If the venue mic is a lapel, hold the handset to it.
- Fallback for phone audio: the Linphone softphone on the laptop, so the audio goes through the laptop's HDMI sound.

## Backups

| If this fails | Do this |
|---|---|
| Claude API slow or down | Click the stored example question buttons (they run saved filters, no AI). Say so: "the API is slow, so here's the same filter, stored" |
| Web app will not load | Open the backup screen recording, `demo-backup.mp4` on the desktop |
| Phone will not register | Linphone on the laptop, or play the phone segment from the backup recording |
| Briefing call does not ring | Skip the close beat; end on the honesty panel line |
| Venue wifi down | Options 1 and 2 on the phone and saved filters on the web still work: DuckDB is local. Only free-text questions need the network |

### Cached demo answers

Before 18:30, run test questions 1, 2, 3 and 4 from [04-question-engine.md](04-question-engine.md#test-questions) and save:

- a screenshot of each answer with the honesty panel open
- the filter JSON from each, as the stored example question buttons

### Recording the backup

Record the full 3-minute run once it works end to end, before 18:00. Include the phone audio. Keep it under 3 minutes so it can be played as is.
