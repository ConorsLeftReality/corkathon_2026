# skills

Global conventions for every project under `D:/dev`. They outrank a repo's
`AGENTS.md`, `CLAUDE.md` and `docs/`. Where a skill and a repo doc disagree,
follow the skill and fix the doc in the same change.

Distilled from the repos that already hold the bar: solroll (enforced slop and
commit linting, test-first foundation, mutation gates), solloop and trading
(money as `bigint`, failure-path tests, one implementation per rule),
sync_college (UI copy, size limits, offline honesty) and portfolio (process
rules, motion library boundaries).

## Which skill, when

| skill | load it when |
|---|---|
| `building-foundations` | starting a project or module, designing core logic, adding a dependency |
| `testing-every-step` | implementing any step, before calling a step done |
| `reviewing-security` | finishing a step that touches input, auth, secrets, data or deps, and before a PR |
| `designing-ui` | building or restyling anything a user sees |
| `writing-without-slop` | writing comments, docs, UI copy, commit or PR text |
| `committing-cleanly` | about to commit, amend, squash or name a branch |
| `opening-prs-and-issues` | about to push, open a PR, open or comment on an issue |

A normal step runs them in this order: foundations, tests, security, commit.
Slop rules apply to every word written along the way.

## Tools

| file | what it checks |
|---|---|
| `writing-without-slop/lint-slop.ts` | banned characters and words in tracked files |
| `committing-cleanly/lint-commit-msg.ts` | commit message format, one message or a range |
| `committing-cleanly/lefthook.yml` | hook config to drop into a repo |

Both scripts ship with tests. Run them with `bun test D:/dev/skills`.

## Wiring

`link-skills.ps1` junctions each skill folder into `~/.claude/skills` so Claude
Code finds them from any directory. Rerun it after adding a skill.
`D:/dev/CLAUDE.md` points every session under `D:/dev` at this folder.
