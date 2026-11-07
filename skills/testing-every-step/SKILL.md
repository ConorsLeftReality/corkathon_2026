---
name: testing-every-step
description: Use when implementing any feature, fix or step of a plan, before calling a step done or moving to the next one, and when tests are missing, flaky, skipped or failing
---

# Testing every step

Every step of a build ends green, and that includes an end-to-end test of what
a user can now do. A step without its tests is not done, whatever it looks
like in the browser.

**Violating the letter is violating the spirit.** "I'll add the e2e at the end"
is skipping it.

## The loop, once per step

1. Foundation logic: write the failing test first, watch it fail, then write
   the code (REQUIRED: superpowers:test-driven-development).
2. Unit tests include at least one failure case with the right error code.
3. **E2E for the flow this step adds or changes.** Playwright in a real browser
   against the real app. A backend-only step gets an integration test against
   a real database or service (PGlite, docker, LiteSVM), not mocks.
4. Run the full check: typecheck, lint, unit, e2e, build. Read the output.
5. Security pass (REQUIRED: `reviewing-security`).
6. Commit, tests in the same commit as the code.

Only then start the next step.

## E2E rules

- Files are `*.e2e.ts` in `tests/e2e/`, never `*.spec.ts` (bun test would collect them).
- Cover loading, empty and error states, not only success.
- UI runs at 360px and 1440px. Keyboard path works. axe is clean on every page.
- Added motion: one run with `reducedMotion: 'reduce'`.
- Wait on conditions (locators, responses), never `waitForTimeout`.
- Each test makes its own data. No order dependence between tests.
- Permissions: a test proving another user cannot read or write the resource.
- Screenshots go to the scratchpad or `test-results/`, never the repo, unless
  they are visual regression baselines. Look at them before reporting.

## Rules

- Every bug fix starts with a failing regression test. The fix commit has both.
- Deterministic or it does not merge: no real clock, network or randomness in unit tests.
- A flaky test is a bug. Fix it or delete it the same day with the reason in
  the commit. No retries to hide it.
- Never skip, `.only`, delete or weaken a test to get green.
- Assert async failures on the caught value:
  `expect(await p.catch((e: unknown) => e)).toBeInstanceOf(AppError)`.
  An unawaited `.rejects` passes without checking.
- Coverage: core logic 100% lines and functions where the repo sets it, apps
  70%. Mutation testing on money and security code where configured.
- Linters and scripts have fixture tests too: input that must fail, input that must pass.

## Done means seen

Done is command output from this session showing the pass, not "should pass"
(REQUIRED: superpowers:verification-before-completion). If something fails,
report it with the output.

## Red flags

| thought | reality |
|---|---|
| "e2e at the end is more efficient" | Bugs found at the end are buried under five steps. |
| "too small to need a test" | Small changes break flows. The test takes minutes. |
| "I checked it manually" | Manual checks do not run on the next change. |
| "mocking the db is fine here" | Mocks pass while the real query fails. |
| "it's flaky, rerun it" | Flaky is a bug. Find the race. |
