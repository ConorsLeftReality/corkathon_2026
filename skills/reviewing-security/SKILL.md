---
name: reviewing-security
description: Use when finishing any step that touches input handling, auth, sessions, secrets, money, files, network calls, database queries, dependencies, desktop permissions or deployment config, and before opening a PR
---

# Reviewing security

Every step gets a security pass before it is committed, not one audit at the
end. Read the diff as someone trying to break it.

## Per-step checklist

Go through the sections the diff touches. Each item is a yes or a fix.

**Secrets**
- None in the repo, the client bundle, logs, error messages or URLs.
- `.env` is gitignored and only `.env.example` is committed.
- Where secrets exist, a test feeds a canary value through logging and asserts it never appears.

**Input**
- Every external value is parsed by a schema before use.
- No string-built SQL, filters or shell commands. Parameterised queries only
  (Drizzle, `pb.filter()` with bound params). A template string filter is an injection bug.
- File paths are checked for traversal. Request bodies and uploads have size limits.

**Auth**
- Every mutating route checks permission on the server. A hidden button is not enforcement.
- A test proves another user cannot read or write the resource.
- Cookies are HttpOnly, Secure and SameSite. Cookie auth has CSRF protection.
- Auth and expensive routes are rate limited.

**Web**
- No `dangerouslySetInnerHTML` or `innerHTML` with user data. User text renders as text.
- Strict CSP. CORS is an allowlist, never `*` with credentials.
- Errors to clients carry a code, not a stack trace.

**State and money**
- Writes that can be retried carry an idempotency key.
- Races are closed with row locks or constraints, with a concurrency test.

**Supply chain**
- New dependency justified, pinned exactly, `bun audit` clean, no surprise postinstall script.
- Copy-in components (shadcn and friends) are read in full on import.

**Infra and desktop**
- Least privilege for DB users, tokens and containers. Containers run as non-root.
- No default credentials, no debug ports exposed.
- Tauri capabilities stay minimal: no broad filesystem or shell scope.

## Before a PR

Run the `security-review` skill over the branch. Fix every finding, or record
in the PR why it does not apply. Then a code review pass
(superpowers:requesting-code-review).

## When you find something serious

A leaked secret, an auth bypass or an injection path: stop, do not commit, tell
the user plainly. A secret that reached git history must be rotated, not just
deleted from the latest commit.

## Red flags

| thought | reality |
|---|---|
| "it's internal, nobody will call it" | Internal routes get exposed by one proxy change. |
| "the frontend validates it" | Anyone can send the request without the frontend. |
| "I'll do the security pass before release" | By then nobody remembers which step added the hole. |
