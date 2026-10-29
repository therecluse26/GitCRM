# Architecture

## System model

```text
            public static app assets
         [static host: Cloudflare Pages]
                       |
                       v
            [browser-only React SPA]
                |             |
         local query       PAT + record cache
         + search          in browser storage
                \             /
                 v           v
                 [GitHub REST API]
                         |
             authenticated private repo
                         |
                  main branch (HEAD)
                         |
          .gitcrm/workspace.json + data/**
```

The application code repository and the user's private CRM data repository are **different repositories**. Deployments of the application MUST NOT read from or bundle a user's workspace. Each workspace's GitHub repository is its authorization and persistence boundary.

## Implementation stack (ADR-012)

- TypeScript + React + Vite.
- TanStack Router with hash history (ADR-010).
- Zustand for the in-memory snapshot store. No TanStack Query: the data is one local snapshot synced by SHA, not many separate server queries.
- `idb` for IndexedDB access.
- A plain typed `fetch` client for GitHub REST and GraphQL; no Octokit.
- Zod for runtime validation, with JSON Schema generated for the export's data dictionary (from memory, Zod 4 can emit JSON Schema; verify).
- shadcn/ui for accessible components; dnd-kit for Kanban drag and drop with keyboard support.
- fflate for the ZIP export.
- MiniSearch **only if** basic in-memory filtering proves inadequate.
- Browser Web Crypto APIs for UUID creation.
- Vitest for unit and contract tests, MSW to mock the GitHub API, Playwright for E2E.

None of these choices introduces persistent infrastructure. Prefer a thin modular architecture over application-framework ceremony.

## Modules / seams

```text
ui/          route components, forms, accessible feedback
features/    contacts, companies, opportunities, tasks, activities
core/        domain records, invariants, schema validation, export
storage/     WorkspaceRepository interface, GitHub implementation
search/      in-memory workspace index derived from current snapshot
auth/        runtime token management and identity checks
```

Phase 1 built `core/`, `storage/`, and the connect checks in `auth/`. Phase 2 adds `app/` (the router and the Zustand store), `ui/` (the app shell and shared form and page parts; shadcn/ui components live in `components/ui/`), and `features/` (each record type's screens, with pure form and list logic beside them). `dev/` holds the developer page (`dev.html`, dev server only). `test/` holds the fake GitHub that Vitest (through MSW) and Playwright both use.

`WorkspaceRepository` is an abstraction around **repository persistence behavior**, not an attempt to support every Git provider (`src/storage/workspace-repository.ts`):

```ts
interface WorkspaceRepository {
  loadWorkspace(): Promise<WorkspaceSnapshot>;
  readRecord(type: RecordType, id: string): Promise<VersionedRecord | null>;
  createRecord<R extends CRMRecord>(record: R): Promise<VersionedRecord<R>>;
  updateRecord<R extends CRMRecord>(record: R, expectedBlobSha: string): Promise<VersionedRecord<R>>;
  // One commit: deletes plus unlinks, each with its expected blob SHA (ADR-021)
  deleteWithCascade(plan: DeletePlan): Promise<{ commitSha: string }>;
}
```

A versioned record includes the Git blob SHA (and optionally the commit SHA) alongside validated JSON. The adapter must never strip away optimistic concurrency information.

## Write path

1. User edits a validated form.
2. Core validates domain rules and serializes canonical JSON.
3. Storage adapter executes a GitHub Contents API mutation on `main` with the expected existing blob SHA.
4. Successful response updates local cache and exposes the commit reference.
5. `409` or `422` conflicts trigger reload and explicit compare/retry; never silently overwrite remote changes.

Each mutation is a Git commit. Creates and updates use the Contents API. Deletes use one multi-file commit through the Git Trees/Commits APIs with a non-forced ref update (ADR-021); later bulk features such as import reuse that path.

## Read path

1. Verify repository is private, accessible, and configured.
2. Resolve `main` to a commit SHA and retrieve a record manifest/tree.
3. Download record blobs for the current snapshot; parse and validate in memory.
4. Build in-memory indexes/search for visible UI. Store no private data in built assets, service-worker precaches, or external analytics.
5. When HEAD changes, incrementally refresh where feasible or safely reload the snapshot. `main` is checked on page load, on Refresh, and when a tab gains focus; with several tabs open, one tab runs the focus checks and shares what it finds (ADR-023).

The **principal performance uncertainty is data transport from GitHub, not local full-text search**. See `docs/06-SEARCH-AND-PERFORMANCE.md`.

## Hosting

The build is host-agnostic (ADR-010): hash URLs, relative asset paths, CSP in a `<meta>` tag, and no host-specific features, so any static host works, including GitHub Pages for self-hosted copies. The official copy uses Cloudflare Pages, whose terms permit it (S-06). GitCRM has no server-side dependency; users connect with a fine-grained PAT (ADR-008). A stateless auth broker for GitHub App sign-in is deferred (ADR-009) and would never receive CRM data. Any server-side component requires an explicit owner decision.

## Offline model

Online-first. Cached data may be displayed read-only during transient outages if loaded securely, but no offline mutation queue or automatic conflict replay in MVP. The PAT and the record cache stay in browser storage until Disconnect (ADR-017).

## Scale boundary

Designed for human-scale edits and small repositories. Refuse speculative server-side search infrastructure, realtime synchronization, and database shards. Offer exports and recommend migration rather than fundamentally changing the architecture.
