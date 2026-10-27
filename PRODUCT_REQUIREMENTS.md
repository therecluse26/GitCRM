# Product Requirements - MVP

## Status and priority

This document defines a narrowly scoped first release. `specs/` provides testable acceptance criteria. P0 feasibility work is defined in `docs/12-RISKS-AND-OPEN-QUESTIONS.md`.

## User roles

- **Workspace owner:** controls the GitHub private repository and its collaborators.
- **Collaborator:** GitHub user with access to the private repository; capabilities follow their GitHub permissions.
- There are **no custom CRM roles** in MVP. A user able to write to the repository can also edit its files outside GitCRM.

## Functional requirements

| ID | Priority | Requirement | Acceptance home |
| --- | --- | --- | --- |
| FR-01 | P0 | Authenticate to the GitHub API without putting credentials into shipped JS or static assets | `specs/01-CONNECT-PRIVATE-REPO.md` |
| FR-02 | P0 | Reject public repositories and incompatible permissions/branches before initializing | `specs/01-CONNECT-PRIVATE-REPO.md` |
| FR-03 | MVP | Create, edit, view, archive, and remove contacts and companies | `specs/02-CONTACTS-AND-COMPANIES.md` |
| FR-04 | MVP | Create deals, assign existing stages, view a Kanban pipeline, move stages | `specs/03-OPPORTUNITIES-AND-PIPELINE.md` |
| FR-05 | MVP | Create tasks, mark done, show overdue and upcoming, relate to records | `specs/04-TASKS-AND-ACTIVITIES.md` |
| FR-06 | MVP | Capture notes and manually logged calls, meetings, or emails | `specs/04-TASKS-AND-ACTIVITIES.md` |
| FR-07 | MVP | Search and filter *current* workspace records in the browser | `specs/05-SEARCH-AND-EXPORT.md` |
| FR-08 | MVP | Export complete JSON snapshot and per-entity CSV files locally | `specs/05-SEARCH-AND-EXPORT.md` |
| FR-09 | MVP | Handle update conflict, expired auth, rate limiting, and network errors explicitly | `specs/07-MULTIUSER-AND-CONFLICTS.md` |
| FR-10 | MVP | Ordinary deletion removes a file from `main`, while Git history remains | `specs/06-RECORD-LIFECYCLE.md` |
| FR-11 | Later | Destructive full-history purge workflow / CLI, with warnings and operator review | `specs/06-RECORD-LIFECYCLE.md` |
| FR-12 | Later | CSV import, CRM-specific import/export mappings | `docs/09-EXPORT-AND-MIGRATION.md` |

## Core screens

- Connection/onboarding
- Home (upcoming tasks, active opportunities, recent manual activities)
- Contacts list and detail
- Companies list and detail
- Pipeline (Kanban, with list fallback) and opportunity detail
- Tasks list
- Global search / quick navigation
- Settings: connection, repo health, pipeline configuration, export

## Basic workflow

Create a company and contact; open an opportunity associated with them; record a note; create a follow-up task; move the opportunity between stages; export the data. None of these operations requires a CRM backend or scheduled automation.

## Nonfunctional requirements

- Correctness: JSON Schema (or equivalent) validation before commit and after fetch.
- Security: HTTPS only; least-privilege repository access; no token storage in plaintext browser persistence; private repo required.
- Portability: stable documented schema, stable record IDs, no proprietary serialization.
- Safety: no silent overwrite; unsaved edits are explicit; local network failures do not pretend data was saved.
- Responsiveness: client-side text search must remain comfortable for a small dataset. Establish load/latency budgets from a realistic private-repo prototype before choosing hard numeric targets.
- Accessibility: keyboard navigation, accessible form labels, visible error states, WCAG 2.2 AA as target.
- Compatibility: evergreen desktop browsers first; mobile web usable but not a dedicated mobile-first MVP.

## Definition of done

The MVP is done only when all MVP acceptance cases in `specs/` pass, including error paths and browser security checks; sample repo can be initialized and cloned; successful edits show up in commits; a dataset export re-parses; and data never appears in public static assets or logs.

## Out-of-scope requests

If a request implies a server, worker, DB, pipeline automation, advanced RBAC, or external integration, log it under later/disallowed with an explanation rather than quietly introducing infrastructure.
