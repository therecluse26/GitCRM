# Implementation Plan

Build in **small vertical slices**. The first meaningful release must prove the core Git persistence model before visual polish. No task requires a new server or database.

## Phase 0 - technical viability (must pass first)

- [ ] Create disposable private test repo and repo-restricted fine-grained PAT.
- [ ] Verify browser `fetch` to GitHub REST for repo metadata, blob reads, one create, update with SHA, delete with SHA. Semantics verified from Node with an OAuth token (S-02); a browser run with a fine-grained PAT is pending.
- [ ] Verify the PAT route end to end in a real browser (ADR-008).
- [ ] Check whether GitHub supports URL parameters that pre-fill the fine-grained PAT form.
- [ ] Verify fine-grained PATs for org members, including the org's PAT approval policy (ADR-018, R-11).
- [ ] Read GitHub's current Terms of Service, API terms, and Acceptable Use Policies for storing app data in private repos through the API; record findings in `docs/12-RISKS-AND-OPEN-QUESTIONS.md`.
- [ ] Validate `private: true`, `main`, branch protection, permission failures.
- [ ] Benchmark initial and incremental load at 100/500/2000 docs: GraphQL tree walk first, then per-blob (`docs/04-GITHUB-INTEGRATION.md`; the archive is ruled out by S-01). Check results against the targets in `docs/06-SEARCH-AND-PERFORMANCE.md`. Decide whether to build the verified rollup (ADR-016); if yes, test custom-ref create and force-update with a fine-grained PAT.
- [ ] Verify a multi-file commit through the Git Trees/Commits APIs with a fine-grained PAT, including a non-forced ref update after `main` has moved (ADR-021). Works with an OAuth token (S-02); fine-grained PAT pending.
- [x] Check whether GitHub's Git-over-HTTP endpoints accept browser CORS calls. They don't, so a browser shallow clone is ruled out (S-01).
- [ ] Confirm chosen static hosting provider permits intended use; never assume GitHub Pages can host commercial SaaS.
- [ ] Record P0 spike findings in `docs/12-RISKS-AND-OPEN-QUESTIONS.md` and update ADRs.

**Exit:** verified authenticated CRUD in a browser for a private repo, with explicit boundary/limits.

## Phase 1 - minimal domain and storage

- [ ] Set up the ADR-012 stack (React + TypeScript + Vite) with Vitest, MSW, and Playwright.
- [ ] Define versioned record schemas and canonical serializer.
- [ ] Implement path generation, GitHub adapter, and in-memory snapshot reader.
- [ ] Implement explicit operation state and safe conflict/error mapping.
- [ ] Write unit and adapter contract tests first.

**Exit:** a CLI-like developer test page can create/read/edit/delete one contact without data loss.

## Phase 2 - onboarding and core CRM

- [ ] Connection screen; private repo validation and initialization.
- [ ] Contacts and companies CRUD + links.
- [ ] Opportunity CRUD + pipeline stage board/list + stage editor (ADR-019).
- [ ] Tasks and manual activities with relational display.
- [ ] Responsive navigation, save feedback, and validation UX.

**Exit:** full "company -> contact -> opportunity -> note -> follow-up task" user journey works.

## Phase 3 - portability and hardening

- [ ] Search over current fully loaded snapshot.
- [ ] Full JSON snapshot ZIP, per-entity CSV, data dictionary.
- [ ] Archive, and delete with a cascade preview in one commit (ADR-021).
- [ ] Browser and GitHub adapter failure-path E2E tests.
- [ ] CSP and static bundle audits; accessibility pass.
- [ ] Deploy the same build to GitHub Pages and one other static host (ADR-010).
- [ ] Performance optimization based on recorded measurements only.

**Exit:** MVP acceptance criteria pass, exports validate, no critical security issues remain.

## Right after the MVP

- Typed custom fields (ADR-020, design in `docs/02-DATA-MODEL.md`).

## Future considerations (not promises)

- GitHub App sign-in through a stateless auth broker, only if real demand appears (ADR-009, deferred; design in `docs/05-AUTH-AND-ONBOARDING.md`).
- Offline-only export/import utilities and dedicated CRM import mappers.
- Local, explicit history-purge CLI with separate operator confirmation.
- Restrained visual improvements.

## Suggested issue order

1. P0 proof with the PAT route (ADR-008).
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
