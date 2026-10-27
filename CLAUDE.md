# Claude Code Instructions - GitCRM

## Objective

Build GitCRM as a clean, deliberately limited CRM. Respect the product vision rather than turning it into a conventional SaaS architecture. Treat the Markdown specs as the product contract.

## Mandatory reading order

1. `README.md`
2. `VISION.md`
3. `PRODUCT_REQUIREMENTS.md`
4. `ARCHITECTURE.md`
5. `docs/01-TECHNICAL-DECISIONS.md`
6. The relevant `specs/*.md` acceptance cases for the feature being implemented

## Engineering approach

- Work **spec-first and test-first**. For each issue: refine acceptance criteria, write failing unit/contract tests, implement the smallest solution, refactor.
- Keep domain logic pure and deterministic; GitHub REST access behind a typed adapter.
- Explicitly model loading, unsaved, saving, committed, conflict, unauthorized, rate-limited, and failed states.
- Validate every record read from Git, even if GitCRM originally created it.
- Produce human-readable canonical JSON; no generated binary record database.
- Prefer native browser functionality and existing small libraries to new abstractions.
- Keep the code readable to humans and agents; remove redundant helpers and speculative options.

## Hard prohibitions without explicit product decision

- No server API, worker, queue, cron, background processor, hosted database, or sync service.
- No GitHub Actions for CRM functionality; CI and static app deployment are allowed as software development tasks.
- No user CRM data in application source, public assets, telemetry, or logs.
- No embedded GitHub client secrets, private keys, or persistent plaintext browser tokens.
- No hidden last-write-wins behavior and no unbounded API retry loops.
- No feature creep into advanced roles, integrations, email sync, complex dashboards, or workflow engines.

## P0 sequence

Before designing the finished onboarding UI, validate: (1) browser-to-GitHub REST access with a narrowly scoped token; (2) exact feasibility of desired auth flow; (3) loading 100/500/2000 small private JSON docs; (4) concurrent same-file updates; (5) safe static deployment host. See `docs/12-RISKS-AND-OPEN-QUESTIONS.md`.

## Work completion checklist

- Relevant spec and decision log updated.
- Unit, contract, and E2E tests cover happy and negative paths.
- No secrets in fixtures/commits or browser persistence.
- Core code remains serverless and portable.
- All public-facing claims about privacy, cost, or deletion are accurate.
- Any unresolved provider behavior is flagged as unverified, not asserted.
