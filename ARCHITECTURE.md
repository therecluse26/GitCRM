# Architecture

## System model

```text
            public static app assets
       [static host: e.g. Cloudflare Pages]
                       |
                       v
            [browser-only React SPA]
                |             |
         local query       auth token in
         + search          volatile memory
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

## Suggested implementation stack

- TypeScript + React + Vite.
- TanStack Router + TanStack Query for routes, remote data/caching, and request states.
- shadcn/ui (or comparable accessible component primitives).
- Zod or JSON Schema for runtime shape validation.
- MiniSearch / FlexSearch **only if** basic in-memory filtering proves inadequate.
- Browser Web Crypto APIs for UUID creation and any necessary ephemeral crypto.

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

`WorkspaceRepository` is an abstraction around **repository persistence behavior**, not an attempt to support every Git provider:

```ts
interface WorkspaceRepository {
  loadWorkspace(): Promise<WorkspaceSnapshot>;
  readRecord(type: RecordType, id: string): Promise<VersionedRecord | null>;
  createRecord(record: CRMRecord): Promise<VersionedRecord>;
  updateRecord(record: CRMRecord, expectedBlobSha: string): Promise<VersionedRecord>;
  deleteRecord(type: RecordType, id: string, expectedBlobSha: string): Promise<void>;
}
```

A versioned record includes the Git blob SHA (and optionally the commit SHA) alongside validated JSON. The adapter must never strip away optimistic concurrency information.

## Write path

1. User edits a validated form.
2. Core validates domain rules and serializes canonical JSON.
3. Storage adapter executes a GitHub Contents API mutation on `main` with the expected existing blob SHA.
4. Successful response updates local cache and exposes the commit reference.
5. `409` or `422` conflicts trigger reload and explicit compare/retry; never silently overwrite remote changes.

Each mutation is a Git commit. A later batching feature might use Git Trees/Commits APIs, but MVP values simplicity over aggressive commit reduction.

## Read path

1. Verify repository is private, accessible, and configured.
2. Resolve `main` to a commit SHA and retrieve a record manifest/tree.
3. Download record blobs for the current snapshot; parse and validate in memory.
4. Build in-memory indexes/search for visible UI. Store no private data in built assets, service-worker precaches, or external analytics.
5. When HEAD changes, incrementally refresh where feasible or safely reload the snapshot.

The **principal performance uncertainty is data transport from GitHub, not local full-text search**. See `docs/06-SEARCH-AND-PERFORMANCE.md`.

## Hosting

Use an appropriate static host that permits the intended use. GitHub Pages' terms restrict hosting a commercial SaaS application; don't treat Pages as the default commercial host. No Cloudflare Worker, Lambda, Edge Function, or identity service is a baseline dependency. A small server-side auth broker is an *explicit architecture change* requiring approval, not a hidden implementation detail.

## Offline model

Online-first. Cached data may be displayed read-only during transient outages if loaded securely, but no offline mutation queue or automatic conflict replay in MVP. Reloads may require re-authentication if tokens are memory-only.

## Scale boundary

Designed for human-scale edits and small repositories. Refuse speculative server-side search infrastructure, realtime synchronization, and database shards. Offer exports and recommend migration rather than fundamentally changing the architecture.
