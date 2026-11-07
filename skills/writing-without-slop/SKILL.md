---
name: writing-without-slop
description: Use when writing or editing any text a person will read, including code comments, docs, READMEs, commit messages, PR and issue text, UI copy, error messages and log lines
---

# Writing without slop

Text should read like someone who knows the subject wrote it in one pass. Slop
is anything that signals a model wrote it: decorative punctuation, filler
words, padded structure.

**Violating the letter is violating the spirit.** A banned character swapped
for a lookalike (`--`, ` - ` as a connector) is still banned.

## Characters

| banned | use instead |
|---|---|
| em dash, en dash, a hyphen used as a dash | comma, colon, parentheses, or two sentences |
| ranges with an en dash | `6-12 months` or `m0 to m7` |
| ellipsis character | three dots |
| curly quotes in code | straight quotes |
| emoji in code, comments, commits, docs, logs, PRs | nothing. UI icons come from the icon set |

## Words

The full list is `slop-words.txt` in this folder. The usual offenders:

<!-- slop-ok-start -->
`delve`, `leverage` (as a verb), `robust`, `seamless`, `utilize`,
`comprehensive`, `cutting-edge`, `elevate`, `streamline`, `empower`, `unlock`,
`game-changer`, `supercharge`, `effortless`, `in order to`, `worth noting`,
`rest assured`, `boasts`, `tapestry`, `ever-evolving`, `journey`, `realm`.
Openers: "Certainly", "Absolutely", "Great question". Softeners: "simply",
"just", "basically", "essentially".
<!-- slop-ok-end -->

Each has a plainer word. Use it.

## Shapes

- No closing summary ("In conclusion", "Overall", "To summarise").
- No sentence that restates the heading or the code above it.
<!-- slop-ok-start -->
- No hedging filler ("It's important to note that", "Generally speaking").
<!-- slop-ok-end -->
- No triads for rhythm. If two reasons are true, give two.
- No "not just X, it's Y", no colon-then-reveal, no rhetorical question openers.
- No marketing tone. Docs say what the thing does.
- No heading soup. A five-line answer does not need three headings and a bold summary.

## Code comments

Most code gets no comment. Good names do the explaining. A comment exists
only for what the code cannot say: a reason, a trap, a constraint from
outside the file.

A comment is:

- **one line**, two at most. Needing a paragraph means it belongs in a doc or the commit body
- **lowercase**, informal, written the way you'd say it to a teammate
- **the why**: the reason, the gotcha, what breaks if someone "fixes" it
- **bare**: no full stops, semicolons, exclamation marks or dashes. A second
  thought goes on its own line. A comma only if the line reads wrong without it
- identifiers in their real case: `serverSeed`, `FeltError`

```ts
// floor not round so the house never pays the extra base unit
const payout = (stake * mult) / 1_000_000n

// nonce bumps inside the txn so a rollback hands the same nonce back
// and the retry gets the same outcome instead of a free reroll
seedPair.nonce += 1n
```

| bad | good |
|---|---|
| `// Calculate the payout by multiplying stake and multiplier.` | no comment, the line says it |
| `// This function validates the user input and returns an error if invalid` | no comment, name it `parseStake` |
| `// First we fetch the user, then we check their limits, then we...` | no comment, the code reads in order |
| `// map returns a new array so we don't mutate` | no comment, that's the language |
| `// Handle errors` | delete it |
| `// IMPORTANT: Do NOT change this! It is required for the API to work.` | `// the api 500s on a trailing slash` |
| `/** Gets the user. @param id the id @returns the user */` | `/** reads from cache first, db on a miss */` or nothing |

- TODOs name a milestone or issue: `// todo(m5) swap for the hash chain`, `// todo(#42)`.
- No banner comments, no commented-out code, no changelogs or author tags in comments.
- Doc comments on exports follow the same style and say what the signature can't.
- Test names use the same style: `it('rejects a stake over max payout')`.

UI copy, user-facing error text and docs prose are **not** in comment style.
They are normal sentence case, real sentences.

## UI copy

- Sentence case everywhere. No exclamation marks, no "Oops", no cheerleading.
- Buttons name the action and keep the verb: "Add deadline" leads to "Deadline added".
- Errors say what happened and what to do next.
- No trailing arrows on buttons, no ALL CAPS labels, no eyebrow labels above headings.
- Placeholder content is labelled `Placeholder`, never written to pass as real.

## Check it

```bash
bun D:/dev/skills/writing-without-slop/lint-slop.ts            # tracked files in the current repo
bun D:/dev/skills/writing-without-slop/lint-slop.ts a.md b.ts  # just these
```

A Markdown doc that has to name banned items wraps them in
`<!-- slop-ok-start -->` and `<!-- slop-ok-end -->`. Proper names that contain a
banned word (Elevate Tweaks) go in `slop-allow.txt` here or in a repo's
`scripts/slop-allow.txt`, matched case sensitive. Nothing else is exempt.
To enforce it in a repo, copy `lint-slop.ts` and `slop-words.txt` into
`scripts/` and wire it into `lint` and the pre-commit hook (see
`committing-cleanly/lefthook.yml`).

## Red flags

| thought | reality |
|---|---|
| "the dash reads better here" | Rewrite the sentence. It usually wants to be two. |
| "it's only a comment" | Comments are the most read prose in a repo. |
| "the existing doc already does it" | Fix it when you touch it, in its own commit. |
| "a summary helps the reader" | The reader just read it. |
