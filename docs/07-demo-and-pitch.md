# Demo and pitch

Top 10 teams pitch live in Boole 2 from 19:35: **3 minutes, then 2 minutes of Q&A.** Frame wants to see the data driving the result live, and clarity beats polish.

## What the demo runs on

| Piece | State on the day |
|---|---|
| Web app: Today screen, Filing deadlines page, honesty panel | Built. Shows real data once the Flask radar API passes `bun run radar:contract`; until then, `bun run dev:mock` with placeholder companies |
| Example questions (stored filters, no AI) | Built in the web app, need the Flask API for real data |
| Typed free-text questions (the Claude step) | Planned. The page offers the example questions instead |
| Desk phone | Set up. Plays a **pre-recorded** spoken answer, made from hardcoded data, when a button is pressed |
| Personal work phone | Same pre-recorded answer, played from a mobile |
| Live voice pipeline and morning call | Planned, see [05-telephony.md](05-telephony.md) |

**Say on stage that the phone answer is pre-recorded.** Frame scores "honest about its limits", and judges have said they will ask how it works. Said up front it is a prototype; found out in Q&A it is a trick.

## Roles

| Role | Who | Does |
|---|---|---|
| Speaker | Placeholder: name | Talks, stands at the lectern |
| Driver | Placeholder: name | Clicks through the web app, opens the honesty panel |
| Phone | Placeholder: name | Asks the question into the desk phone, presses the button, then does the same on the mobile, speaker to the mic |

## Script (3:00)

| Time | Beat | On screen or phone | Say (roughly) |
|---|---|---|---|
| 0:00 to 0:20 | **Pain** | Landing page | "It's November. Which of your clients have to file with the CRO before Christmas? If you're an accountant, the answer is in a spreadsheet, practice software and someone's head. Miss one and your client pays a late penalty." |
| 0:20 to 0:45 | **Today** | Driver signs in, Today screen shows overdue clients and clients due this week | "This is Filing Radar. Every morning it checks your client list against the CRO's own register and tells you who to chase. Two are overdue, three are due this week." |
| 0:45 to 1:15 | **Prospects** | Filing deadlines page, Find prospects, click "Which Cork hospitality companies are overdue on their annual return?" | "Now flip it round. These Cork cafes, hotels and pubs have already missed their annual return. Each one is a business without a working filing process, which makes it a lead for a practice. Same data, free and public." |
| 1:15 to 1:35 | **Show the working** | Driver opens "How this was worked out" | "How do you know it isn't making this up? Here's the filter, the query that ran, the row count and the date of the data. For this question no AI is involved at all. When you type a question, the AI's only job is to pick this filter. It never calculates a date, a penalty or a count." |
| 1:35 to 2:00 | **Desk phone** | Phone asks the question out loud, presses the button, speaker to the mic | "Busy people don't open dashboards. This is our phone prototype: you ask, and it reads you the answer. The answer you're hearing was generated ahead of time from the same register data. Live speech in and live data out is our next step." (let it play) |
| 2:00 to 2:20 | **Personal phone** | Same on a mobile, speaker to the mic | "And it doesn't need a landline. Most people at a firm like Frame are on a work mobile, between meetings, on the way to a client. The same answers can reach the phone in their pocket." |
| 2:20 to 2:50 | **Limits, who pays, what's next** | Back to the honesty panel, point at the snapshot date | "What it can't do yet: it's a daily snapshot, not live. Penalties are estimates, not legal advice. Irish companies only. Who pays? Accountancy practices, per practice, per month. One new client from prospects mode pays for it. Next: live voice, Revenue deadlines, and the UK, where Companies House publishes similar open data." |
| 2:50 to 3:00 | **Close** | Today screen | "Filing Radar: deadlines you can act on, from data that already exists, on the screen or the phone you already have." |

Fill in before going on stage:

- the snapshot date from the Today screen. Say "downloaded today" only if it shows today's or yesterday's date. If the data is stale, say "the CRO's latest file is from {date}, and the banner tells you so"
- one real number from the prospects answer, for example "{N} Cork hospitality companies are overdue right now"
- the question the phone person asks out loud must match the recorded answer word for word in meaning. Write both down: Placeholder: question, Placeholder: recorded answer

> **VERIFY:** the penalty wording in the pain beat against cro.ie before saying it on stage. If unconfirmed, say "can face late penalties".

> **VERIFY:** how often the Companies House bulk data updates, before mentioning it in Q&A.

## Stage setup

- Laptop on HDMI to the projector, browser zoom 125 percent, signed in, Today screen open. A second tab on the Filing deadlines page in Find prospects mode.
- Desk phone on the lectern table with its power. The mobile charged, volume at maximum, notifications off, the recording ready to play.
- Phone audio: put each phone on speaker and hold its speaker about 5 cm from the lectern mic. Test this in the room if allowed. If the venue mic is a lapel, hold the phone to it.

## Backups

| If this fails | Do this |
|---|---|
| Flask API down or not finished | Run `bun run dev:mock` and say so: "this is running on sample companies, the real register data is the same shape" |
| Web app will not load | Open the backup screen recording, `demo-backup.mp4` on the desktop |
| Desk phone does not play | Go straight to the mobile beat |
| Mobile does not play | Play the audio file from the laptop through HDMI |
| Venue wifi down | Everything runs locally: the web app, the Flask API and the CSV. Nothing in the demo needs the internet |

### Cached demo answers

Before 18:30, with the real API running, save a screenshot of the Today screen and of the prospects answer with "How this was worked out" open.

### Recording the backup

Record the full 3-minute run once it works end to end, before 18:00. Include the phone audio. Keep it under 3 minutes so it can be played as is.
