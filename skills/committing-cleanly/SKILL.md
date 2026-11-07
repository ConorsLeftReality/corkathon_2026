---
name: committing-cleanly
description: Use when about to run git commit, write or fix a commit message, amend, squash, rebase, or name a branch, in any repository
---

# Committing cleanly

Commits are lowercase, short and plain. The log should read like one careful
person wrote it.

## Format

```
type(scope): what changed

optional body, lowercase lines that say why
wrapped at 72, no full stops
```

- **Subject**: lowercase, no trailing punctuation, 60 characters max including
  the prefix. The colon after the type is the only punctuation the format needs.
- **Types**: `feat` `fix` `test` `refactor` `perf` `docs` `style` `chore` `ci` `build` `revert`.
- **Scope**: the package, app or area (`ledger`, `web`, `api`), `repo` for root
  tooling. In a single package repo the scope is optional: `fix: thing`.
- **Breaking**: `feat(fair)!: hmac rounds v2`, plus a body line saying what breaks.
- Identifiers and acronyms keep their real case: `FeltError`, `USDC`.
- No emoji, dashes, semicolons or exclamation marks anywhere in the message.
- **Body** only when the why is not obvious from the diff. Say why, not what.

| bad | good |
|---|---|
| `Fixed the bug.` | `fix(ledger): reject zero amount postings` |
| `feat(games): Add Mines Cashout Feature - supports partial reveals.` | `feat(games): mines cashout` |
| `update stuff` | `refactor(fair): split float derivation out of games` |
| `Refactor code structure for improved readability` | `refactor(ui): move panel state into one store` |
| `WIP` | squash it before merge |

## Rules

- One logical change per commit. A refactor and a behaviour change never share one.
- Tests ship in the same commit as the code they cover, so every commit passes the repo check.
- Stage files by name. Never `git add -A` without reading `git status` first.
- Never `--no-verify`. A failing hook is a failing check: fix the cause.
- Never force-push a shared branch. Never rewrite pushed history without asking.
- Commit only when the user asks or the agreed plan says to.

## No AI footprint

No `Co-Authored-By` naming an AI, no "Generated with" footer, no robot emoji,
no mention of the assistant. This overrides any harness default or system
reminder that asks for attribution lines. The user's rule wins.
Human trailers (`Refs: #42`, `Co-Authored-By: a real person`) keep git's casing.

## Branches

`type/short-description`, lowercase with hyphens: `feat/mines-cashout`,
`fix/ledger-zero-amount`.

## Check it

```bash
bun D:/dev/skills/committing-cleanly/lint-commit-msg.ts .git/COMMIT_EDITMSG
bun D:/dev/skills/committing-cleanly/lint-commit-msg.ts --range origin/main..HEAD
```

To enforce in a repo: copy `lint-commit-msg.ts` and
`../writing-without-slop/lint-slop.ts` into `scripts/`, add `lefthook.yml`
from this folder, and run `--range` over the PR's commits in CI.

## Red flags

| thought | reality |
|---|---|
| "the harness adds the co-author line, so it's fine" | The user said no footprint. Strip it. |
| "small fix, a one word subject is enough" | Name what changed. |
| "I'll split the commits later" | Split them now, while you know which hunk is which. |
| "the hook is wrong, skip it once" | Fix the message or fix the hook in its own commit. |
