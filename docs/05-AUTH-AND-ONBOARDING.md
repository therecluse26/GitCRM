# Authentication and Onboarding

## The hard problem

A normal static SPA cannot securely embed an OAuth client secret or GitHub App private key. As of the checked GitHub documentation (2026-10-26), its OAuth web application token exchange lists `client_secret` as required even when PKCE is used. The GitHub OAuth endpoints also present cross-origin constraints. **Do not claim that PKCE magically makes GitHub login fully browser-only until an end-to-end secure flow is actually verified.**

## Alpha route: user-supplied fine-grained PAT (provisional)

A GitHub-savvy user creates a fine-grained PAT with:

- Only the selected private CRM repository authorized.
- `Contents: Read and write` repository permission (metadata read implicit).
- A reasonable expiration set by the user.

The token is pasted into a clear, secure connection screen and kept in **volatile memory only** for MVP. The app then validates identity and repository access using the GitHub REST API. On reload, the user may need to reconnect. Never place the token in URL parameters, logs, analytics, `localStorage`, `sessionStorage`, IndexedDB, or a service-worker cache.

This is an **alpha/dev-first UX compromise**, not the intended frictionless production onboarding. It also means browser compromise or malicious extensions can still steal a live token; communicate that risk and minimize third-party scripts.

## Supported setup flow

1. Open the static application over HTTPS.
2. Select "Connect existing private GitHub repository".
3. Provide PAT; show instructions for creating a repository-restricted token.
4. Select (or enter) `owner/repo` from a repository the token can access.
5. Verify repo `private = true`, default branch `main`, and that content read/write is possible.
6. Check for `.gitcrm/workspace.json`. If absent, show an explicit Initialize action.
7. Enter workspace display name, write config, and open CRM.
8. Show a readable "Connected to owner/repo" indicator and a Disconnect action that zeroes volatile app references to the token and cached records.

Do not automatically initialize arbitrary repositories just because a user has permission.

## Failure UX

- Repo public: **refuse** to initialize or write; explain how to create a private repository. If visibility later becomes public, stop and prominently warn (old public commits may already have leaked data).
- Expired or revoked token: prompt to reconnect; never retry indefinitely.
- Missing write permission: read-only screen with explanation.
- Unsupported default branch / protected `main`: show an actionable compatibility error, not a spin loop.
- Invalid workspace version: offer export/read-only diagnostics but no automatic destructive rewrite.
- GitHub outage/rate limit: preserve current unsaved form and allow later manual retry.

## Future production UX (open design decision)

Evaluate a minimal GitHub App with repository-scoped user authorization. Any required token exchange component or secret-bearing broker would be **additional infrastructure** and violates the current pure-static requirement unless explicitly approved. Device flow avoids the client-secret requirement but is intended for constrained/headless clients and needs browser CORS validation; do not silently adopt it.

Alternative browser-only auth paths can be explored, but must be validated on current GitHub endpoints, CORS, scope restrictions, token exposure, and UX. Document the findings as ADR-009.

## Permissions / identity

GitHub determines who can access or modify a repo; GitCRM has no independent identity provider, user table, or team membership registry. Check `GET /user` identity when a token is submitted; do not trust the user-supplied repository name as evidence of authorization.
