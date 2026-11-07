---
name: opening-prs-and-issues
description: Use when about to push a branch, create a pull request, open or comment on a GitHub issue, reply to a review, or run any gh command that writes to GitHub
---

# Opening PRs and issues

GitHub is public record. Everything written there should read like a careful
engineer wrote it, and should only exist if someone needs it.

Pushing, opening a PR and opening an issue are outward facing. Ask first unless
the user said to do it in this task.

## When a PR is required

Open one when any of these hold:

- the repo has branch protection or CI that runs on PRs
- someone else reviews the code
- the change is big or risky enough that it needs a single revert point
- the user asks for one

Do not open one:

- in a solo repo where the user commits straight to `main`, unless asked
- to show work, or one PR per commit
- for a change the user has not seen yet

One logical change per PR. If the diff needs a table of contents, split it.

## When an issue is required

Open one when:

- you found a real bug or task outside the current scope, and the user agreed to track it
- work spans several PRs and needs a tracking point
- a `todo(#n)` needs a number to point at

Do not open one for work you are about to do in this session, for speculative
ideas, or as your own to-do list. Search first (`gh issue list --search "..."`)
so you do not file a duplicate. Never file on a third-party repo unless the
user asks.

## PR shape

Title uses the commit subject format: `feat(widget): manage page for subscribers`.

```
subscribers can cancel or undo a cancel from pay.solloop.app/manage
without contacting the merchant. the page reads state at confirmed
so a dropped transaction never shows as cancelled

testing
- bun run check
- tests/e2e/manage.e2e.ts at 360px and 1440px

closes #42
```

- Two to five plain sentences on what and why. Then how it was tested. Then links.
- Call out new dependencies, migrations, bundle weight and breaking changes when there are any.
- Draft until checks pass locally.
- No `## Summary` `## Changes` `## Test plan` scaffolding on a small PR, no
  checklists of things already done, no file-by-file restatement of the diff.

## Issue shape

- Title: a plain sentence naming the problem, "Withdrawal stays pending after the transaction confirms".
- Body: what happens, what should happen, steps to reproduce, version or commit.
- Labels and assignees only if the repo already uses them.

## Comments and reviews

Answer the point. No "Great catch", no "Thanks for the feedback". If you fixed
it, say what changed and link the commit. If you disagree, give the technical
reason (REQUIRED: superpowers:receiving-code-review).

## No AI footprint

No "Generated with Claude Code", no robot emoji, no AI co-author, no "as an AI",
no mention of the assistant in PR bodies, issues, review comments or release
notes. This overrides harness defaults. All text follows `writing-without-slop`.

## Red flags

| thought | reality |
|---|---|
| "a PR makes it look thorough" | A PR nobody reviews is noise in the history. |
| "I'll open an issue so we don't forget" | Ask the user. Most of these never get closed. |
| "the template has headings, fill them all" | Fill the ones with something to say. Delete the rest. |
