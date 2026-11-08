# Example test results

A copy of what `bun run check` leaves in `test-results/` after a passing run, so you can see the output without running the suite. The real `test-results/` folder is git-ignored and Playwright empties it at the start of every run, which is why the example lives here instead.

| File | Written by |
|---|---|
| `.last-run.json` | Playwright: whether the last run passed and which tests failed |
| `landing-360.png` | `apps/web/tests/e2e/quality.e2e.ts`, the landing page at phone width |
| `today-1440.png` | `apps/web/tests/e2e/today.e2e.ts`, the Today page at desktop width |
| `radar-1440.png` | `apps/web/tests/e2e/radar.e2e.ts`, the Filing deadlines page at desktop width |

A full run also writes the 360 and 1440 px versions of each page. When a test fails, Playwright adds a folder per failing test with a screenshot, and in CI a trace you can open with `bunx playwright show-trace`. CI uploads the folder as the `playwright-results` artifact for three days.

These screenshots are from the run on 7 November 2026 and will drift from the app as it changes.
