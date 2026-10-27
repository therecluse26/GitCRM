# Implementation Plan

Build in **small vertical slices**. The first meaningful release must prove the core Git persistence model before visual polish. No task requires a new server or database.

## Phase 0 - technical viability (must pass first)

- [ ] Create disposable private test repo and repo-restricted fine-grained PAT.
- [ ] Verify browser `fetch` to GitHub REST for repo metadata, blob reads, one create, update with SHA, delete with SHA.
- [ ] Independently document OAuth/PKCE/CORS results; select supported alpha auth approach.
- [ ] Validate `private: true`, `main`, branch protection, permission failures.
- [ ] Benchmark initial and incremental load at 100/500/2000 docs.
- [ ] Confirm chosen static hosting provider permits intended use; never assume GitHub Pages can host commercial SaaS.
- [ ] Record P0 spike findings in `docs/12-RISKS-AND-OPEN-QUESTIONS.md` and update ADRs.

**Exit:** verified authenticated CRUD in a browser for a private repo, with explicit boundary/limits.

## Phase 1 - minimal domain and storage

- [ ] Set up React + TypeScript + Vite and tests.
- [ ] Define versioned record schemas and canonical serializer.
- [ ] Implement path generation, GitHub adapter, and in-memory snapshot reader.
- [ ] Implement explicit operation state and safe conflict/error mapping.
- [ ] Write unit and adapter contract tests first.

**Exit:** a CLI-like developer test page can create/read/edit/delete one contact without data loss.

## Phase 2 - onboarding and core CRM

- [ ] Connection screen; private repo validation and initialization.
- [ ] Contacts and companies CRUD + links.
- [ ] Opportunity CRUD + pipeline stage board/list.
- [ ] Tasks and manual activities with relational display.
- [ ] Responsive navigation, save feedback, and validation UX.

**Exit:** full "company -> contact -> opportunity -> note -> follow-up task" user journey works.

## Phase 3 - portability and hardening

- [ ] Search over current fully loaded snapshot.
- [ ] Full JSON snapshot ZIP, per-entity CSV, data dictionary.
- [ ] Archive / delete current snapshot with inbound-reference checks.
- [ ] Browser and GitHub adapter failure-path E2E tests.
- [ ] CSP and static bundle audits; accessibility pass.
- [ ] Performance optimization based on recorded measurements only.

**Exit:** MVP acceptance criteria pass, exports validate, no critical security issues remain.

## Future considerations (not promises)

- Repository-scoped GitHub App onboarding if it can be reconciled with product constraints.
- Offline-only export/import utilities and dedicated CRM import mappers.
- Local, explicit history-purge CLI with separate operator confirmation.
- Custom stages and restrained visual improvements.

## Suggested issue order

1. ADR-009 auth feasibility and P0 proof.
2. Record schema + deterministic paths + validation tests.
3. GitHub content adapter with compare-and-swap save.
4. Snapshot loader + performance benchmark.
5. Private repo onboarding.
6. Contacts/companies slice.
7. Pipeline and opportunity slice.
8. Tasks/activities slice.
9. Search and export.
10. Deletion, failure hardening, accessibility, release checks.

At every phase, update acceptance criteria before implementation and avoid adding speculative abstractions.
