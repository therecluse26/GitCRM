# Technical Decisions (Living ADR Log)

Record material choices here before changing architecture. Statuses: **accepted**, **provisional**, **open**, **rejected**.

| ID | Status | Decision | Rationale / tradeoff |
| --- | --- | --- | --- |
| ADR-001 | accepted | Git-backed private workspace repository | Data ownership, native version history, no application DB |
| ADR-002 | accepted | One JSON file per record | Independent writes and targeted record-level history handling |
| ADR-003 | accepted | `main` as current authoritative branch | Minimize merge complexity in a tiny-team product |
| ADR-004 | accepted | Pure static SPA, no CRM backend | Central product constraint, not a temporary optimization |
| ADR-005 | accepted | Client-side querying of current data only | Small-team scale; no Git-history searching needed |
| ADR-006 | accepted | No scheduled CRM automation in core | Avoid operational infrastructure and GitHub Actions policy reliance |
| ADR-007 | accepted | Plain JSON v1 with immutable UUIDs | Widely compatible tooling and reliable per-document filenames |
| ADR-008 | provisional | Existing private repo plus memory-only fine-grained PAT for developer alpha | Demonstrates persistence without embedding OAuth secrets; onboarding friction acknowledged |
| ADR-009 | open | Public-release authentication | Cannot assume pure browser OAuth code exchange; requires verified safe design |
| ADR-010 | accepted | Static host must permit intended service | GitHub Pages specifically restricts commercial SaaS hosting |
| ADR-011 | accepted | Current-tree delete in MVP; history rewrite outside MVP | User safety and impossibility of guaranteeing all replicas erased |
| ADR-012 | provisional | React + Vite + TypeScript | Lightweight, mature SPA; no backend runtime |
| ADR-013 | accepted | No CRM-specific role or permission system | GitHub repo permissions are the entire authorization boundary |
| ADR-014 | accepted | Data repo separate from frontend code repo | Never publish private records as static assets |

## Decision process

For changes to a product invariant: state the requirement, propose at least one solution with **no new runtime infrastructure**, show consequences for export/ownership, explain alternatives, then update this log. Implementation shortcuts do not override product decisions.

## Not yet decided

- Browser-friendly auth with a genuinely low-friction UX and no unsafe client secret.
- Bulk snapshot transport optimization after a measurement spike.
- Whether default record export should additionally include a single portable ZIP in MVP.
- When, if ever, to ship a local history-purge utility.
