# Test Strategy and Quality Gates

## Test pyramid

**Unit:** schema parsing, validation, field transformations, path derivation, immutable ID logic, relationship integrity, search, money/date formatting, export serialization.

**Contract:** mocked GitHub API request/response sequences; handling changed SHA, missing repo, public visibility, missing scopes, rate limit, invalid tree, truncated tree, and partial fetch. No real GitHub credentials in source control.

**E2E:** browser user flows with a fake repository adapter. An optional separate suite against a **disposable private GitHub repo** tests real API semantics, never production CRM data.

## Core test cases

1. A UUID record is written at the expected sharded path and re-parses identically.
2. A contact linked to a company appears on both detail views.
3. An opportunity with 250000 minor units USD displays $2,500.00, independent of binary float rounding.
4. Moving a deal stage produces exactly one record mutation and remains after reload.
5. A task becomes overdue based on its calendar date (test around timezone boundaries).
6. Two clients editing the same old SHA cause an explicit conflict; one cannot erase the other's update silently.
7. Two users editing separate files can each save, with appropriate retries for GitHub branch-level conflicts.
8. A public repository fails connection and cannot receive any CRM record writes.
9. Invalid JSON or unknown version prevents a "complete" export.
10. Untrusted note HTML is displayed as text, never executed.
11. A record with live inbound relations cannot be deleted without explicit detachment.
12. JSON and CSV exports round-trip expected fields and relations.
13. Token never appears in console output, URL, static build, or web storage.
14. `Disconnect` removes private data from view and app caches.
15. A GitHub API rate-limit response respects `retry-after` and does not trigger a tight retry loop.

## Nonfunctional probes

- Prototype at 100/500/2000 generated records; measure time, requests, bytes, memory.
- Verify responsive UI on a modest laptop and throttled connection.
- Audit accessibility: keyboard-only contact creation, Kanban stage movement, and errors.
- Scan production static artifact for real data, developer tokens, and unsafe embed configuration.

## Release gate

No MVP release without passing functional acceptance criteria, conflict tests, a documented auth/security review, and a demonstration that the chosen static host permits the intended use.
