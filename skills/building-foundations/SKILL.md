---
name: building-foundations
description: Use when starting a new project, package or module, designing core logic or data types, choosing structure, adding a dependency, or writing code other code will depend on
---

# Building foundations

Build the foundation first and hold it to a higher bar than app code. A bug in
a screen is a bad day. A bug in core logic is lost data or someone's money.

## Build order

1. Core types and pure logic, test first (`testing-every-step`).
2. Boundaries: schemas that parse input, adapters that do IO.
3. The shell that wires them together (server, CLI, Tauri commands).
4. UI last.

Never build on a layer whose tests are not green.

## Types

- TypeScript `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`,
  `verbatimModuleSyntax`.
- No `any`. No `as` outside parse boundaries and tests. No non-null `!`. No
  `@ts-ignore` or `@ts-expect-error` without a comment naming the issue.
- A `switch` over a union ends in `assertNever(x)`, so a new case breaks the build everywhere it must be handled.
- Money and exact quantities are integers in base units (`bigint`), never
  floats. Parse user strings with a function that throws on ambiguity, never
  `Number(input) * 10 ** decimals`.
- Brand IDs and units where mixing them is a real risk.

## Structure

- **Parse at the edges, trust inside.** Every outside value (HTTP, WS, env,
  DB json, files, user input) goes through a schema once. Env is parsed at
  boot and a missing variable crashes startup.
- **Pure core, thin shell.** Decision logic takes inputs as arguments. Clock,
  randomness and IO are injected. No `Date.now()` inside logic.
- **One implementation per rule.** Fee maths, permission checks and formatting
  each live in exactly one place.
- **Errors carry a stable `code`.** Throw error subclasses, never strings. Catch
  only to add context, translate at a boundary, or recover with a reason. Never catch and ignore.
- One concept per file, named after what it does. No `utils.ts`, `helpers.ts`,
  `common.ts`, no barrels, named exports (default only where a framework needs it).
- `kebab-case.ts` modules, `PascalCase.tsx` components. No vague names: `data`, `info`, `temp`, `manager`.
- Limits: function about 40 lines, file 300, 4 parameters (then an options
  object), 3 levels of nesting. Hitting one means split by responsibility.
- No abstraction until the second real implementation. No config object for
  one call site. No defensive `try/catch` around code that cannot throw. No dead
  or commented-out code.
- Structured logs with lowercase messages and a redaction list for secrets.

## Dependencies and APIs

- Ask before adding a runtime dependency. Pin it exactly and say why in the commit body.
- Check fast-moving APIs against current docs (context7, official docs, the
  package's `.d.ts`) before writing code. Never write against an API from memory.

## Defaults for new projects

Bun (`bun.lock` committed, never npm, pnpm, yarn or npx), TypeScript strict,
Vite, React 19, Tailwind v4 CSS-first, `motion` not `framer-motion`, Playwright
for e2e, tests beside source, `#src/*` package imports instead of tsconfig
`paths`, lefthook. A repo's own docs win on stack choice.

## Working style

- Ambiguous task: ask one question and stop. Do not build two versions to hedge.
- Not working after two attempts: say so and describe what you tried. Do not quietly cut scope.
- Do not improve files outside the task.
- Prefer deleting code to adding flags.
