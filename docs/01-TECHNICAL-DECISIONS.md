# Technical Decisions (Living ADR Log)

Record material choices here before changing architecture. Statuses: **proposed** (drafted, not yet reviewed by the owner), **provisional**, **accepted**, **deferred** (decided not to build now; may revisit), **open**, **rejected**.

ChatGPT drafted the original entries. The owner reviewed every entry on 2026-10-27; the statuses below record those decisions.

| ID | Status | Decision | Rationale / tradeoff |
| --- | --- | --- | --- |
| ADR-001 | accepted | Git-backed private workspace repository | Owner decision 2026-10-27. Data ownership, native version history, no application DB |
| ADR-002 | accepted | One JSON file per record at `data/{pluralType}/{2 hex}/{uuid}.json`; tasks and activities are separate files | Owner decision 2026-10-27. Independent writes, small blast radius, per-record history, mostly path-based purge. Load cost handled separately (R-02) |
| ADR-003 | accepted | The repo's default branch, whatever its name, is the one authoritative branch; the docs call it `main` for short. A branch that requires pull requests is incompatible | Owner decision 2026-10-27. Minimizes merge complexity in a tiny-team product; also supports older `master` repos |
| ADR-004 | accepted | Static SPA; no server stores or sees CRM data; no database. A stateless auth broker is allowed in principle but not planned (ADR-009) | Owner decision 2026-10-27. Keeps data ownership and zero data infrastructure; leaves room for easier sign-in if demand appears |
| ADR-005 | accepted | Client-side querying of current data only | Owner decision 2026-10-27. Small-team scale; no Git-history searching needed |
| ADR-006 | accepted | No GitHub Actions or other compute for CRM work; the browser does all reads, writes, and aggregation. Revisit only for a feature that must run while nobody has GitCRM open (reminders, webhooks, syncs) | Owner decision 2026-10-27. Faster, cheaper, and simpler than workflow-built rollups; avoids Actions minutes and Actions-terms risk (unverified) |
| ADR-007 | accepted | Plain JSON v1 with immutable UUIDs as filenames; no PII in paths | Owner decision 2026-10-27. Widely compatible tooling and reliable per-document filenames |
| ADR-008 | accepted | Auth: existing private repo plus a user-supplied fine-grained PAT, for the alpha and the public release; no broker | Owner decision 2026-10-27. Works without infrastructure; onboarding friction accepted. Token storage rule still open (see below) |
| ADR-009 | deferred | GitHub App sign-in through a stateless auth broker, only if real demand appears; the PAT stays the supported path | Owner decision 2026-10-27: not planned. If revived, the broker holds only the client secret, has no database, and never sees CRM data (ADR-004). Device flow skipped unless a spike shows browser CORS support |
| ADR-010 | accepted | Host-agnostic static build: hash URLs, relative asset paths, CSP in a `<meta>` tag (plus a `frame-ancestors` header where the host supports headers), no host-specific features. The official hosted copy uses a host whose terms permit its use | Owner decision 2026-10-27. Anyone can self-host, including on GitHub Pages; Pages' SaaS restriction matters only for a commercial official copy (verify) |
| ADR-011 | accepted | Current-tree delete in MVP; history rewrite outside MVP | Owner decision 2026-10-27. User safety and impossibility of guaranteeing all replicas erased |
| ADR-012 | accepted | Stack: React + Vite + TypeScript; TanStack Router (hash history); Zustand store; `idb`; plain typed `fetch` (no Octokit); Zod with generated JSON Schema; shadcn/ui; dnd-kit; fflate; Vitest, MSW, Playwright. MiniSearch only if needed | Owner decision 2026-10-27. Small, widely used dependencies; fits the snapshot-store data flow and ADR-010. Details in `ARCHITECTURE.md` |
| ADR-013 | accepted | No CRM-specific role or permission system | Owner decision 2026-10-27. GitHub repo permissions are the entire authorization boundary |
| ADR-014 | accepted | Data repo separate from frontend code repo | Owner decision 2026-10-27. Never publish private records as static assets; also holds for self-hosted copies |
| ADR-015 | accepted | GitCRM is a product for other people, not a personal tool. The audience is technical: people comfortable with GitHub and creating a PAT | Owner decision 2026-10-27. Public onboarding, hosting terms, and privacy disclosures are release requirements. Commercial status still open |
| ADR-016 | accepted | A verified rollup is allowed as a read cache: summary rows with blob SHAs, checked against the `main` tree on load; record saves never write it. Build only if spike (3) shows per-blob loads are too expensive | Owner decision 2026-10-27. Keeps ADR-002 intact while bounding first-load cost. Location: an orphan ref; with ADR-017's per-device cache it only speeds up a device's first load. Rewrite rule stays open until built |
| ADR-017 | accepted | The PAT persists in `localStorage` and the record cache in IndexedDB, both unencrypted, until Disconnect. "Remember on this device" (default on) lets users skip storage on shared machines. Page loads reuse cached records whose blob SHA still matches `main` | Owner decision 2026-10-27. Normal web-app practice; a compromised machine is out of scope. The real defenses stay: one-repo short-expiry PAT, strict CSP, no third-party scripts |
| ADR-018 | accepted | Team workspaces live in a GitHub organization. Each member uses their own fine-grained PAT; no shared PATs. Solo workspaces may use a personal repo | Owner decision 2026-10-27. Fine-grained PATs may not reach personal repos owned by someone else (R-11). Keeps per-person attribution and revocation |
| ADR-019 | accepted | Pipeline stages are editable in the MVP: rename, reorder, add, and remove when unused. `won` and `lost` always exist. Stage IDs never change | Owner decision 2026-10-27. Edits touch only `.gitcrm/workspace.json`, so no record migration is needed |
| ADR-020 | accepted | Typed custom fields ship first after the MVP. Schema v1 reserves an optional `customFields` object on contacts, companies, and opportunities; the MVP keeps those values on save and in exports | Owner decision 2026-10-27. Keeps the MVP smaller and avoids a record migration later. Design in `docs/02-DATA-MODEL.md` |
| ADR-021 | accepted | Delete cascades in one commit: tasks and activities related to the record are deleted; contacts, companies, and opportunities that link to it are unlinked, never deleted. Archived records count. A preview lists every change first. Uses the Git Trees/Commits APIs with a non-forced ref update | Owner decision 2026-10-27. One commit instead of one per link; no dangling links; removes notes about the deleted record from `main` |

## Decision process

For changes to a product invariant: state the requirement, propose at least one solution with **no new runtime infrastructure**, show consequences for export/ownership, explain alternatives, then update this log. Implementation shortcuts do not override product decisions.

## Not yet decided

- Whether GitCRM is commercial (affects host terms and privacy disclosures).
- Snapshot transport after spike (3): GraphQL or per-blob (archive ruled out, S-01); and whether to build the verified rollup (ADR-016) and when it is rewritten.
- Whether default record export should additionally include a single portable ZIP in MVP.
- When, if ever, to ship a local history-purge utility.
