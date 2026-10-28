# GitHub REST Integration Contract

## Goal

Read and modify **only the selected private repository** from a static browser client, with predictable failure handling and no background processing.

## MVP endpoints (illustrative paths)

| Purpose | GitHub REST endpoint |
| --- | --- |
| Verify identity | `GET /user` |
| Inspect repo / visibility / default branch | `GET /repos/{owner}/{repo}` |
| Read workspace config or document | `GET /repos/{owner}/{repo}/contents/{path}?ref=main` |
| Create or update document | `PUT /repos/{owner}/{repo}/contents/{path}` |
| Delete with cascade, one commit (ADR-021) | `POST .../git/trees`, `POST .../git/commits`, `PATCH .../git/refs/heads/main` |
| Bulk first load (spike 3) | `POST /graphql` |
| Enumerate tree efficiently | `GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1` |
| Fetch blob contents | `GET /repos/{owner}/{repo}/git/blobs/{file_sha}` |
| Resolve head for consistency | `GET /repos/{owner}/{repo}/git/ref/heads/main` and commit/tree lookup |
| Display commit confirmation | returned Contents API commit metadata |

GitHub uses explicit content permissions for write operations. Request least privilege; do not ask for workflows permission. For the alpha, a fine-grained user PAT should be restricted to the one CRM repo with `Contents: Read and write` and implicit metadata read access. Confirm these permissions in a live spike.

## Workspace snapshot algorithm (candidate)

1. Resolve `refs/heads/main` to a commit and associated tree SHA.
2. Fetch recursive Git tree and filter `.gitcrm/workspace.json`, `data/**`.
3. Retrieve each referenced blob by SHA, or in bulk (see "First-load transport"); validate full content and expected path/type/ID.
4. Expose data only after a coherent snapshot has loaded. If some blobs fail, show an explicit partial-read error and disable unsafe export/write.
5. Cache blob SHA to parsed record in IndexedDB (ADR-017), so later page loads fetch only blobs whose SHA changed.
6. Refresh based on HEAD SHA. If unchanged, don't re-fetch files; if changed, compare paths + blob SHAs and fetch only changed files.

Git Trees has response-size/truncation limits. If `truncated = true`, recursively traverse subtrees or show a controlled unsupported-size error; **never silently omit data**. A first-load API call per document is potentially expensive; performance alternatives must be tested, not assumed.

## Page load with a cached snapshot (ADR-017)

1. Read the PAT from `localStorage`; if absent, show the connect screen.
2. Load the cached snapshot from IndexedDB into the in-memory store, re-validate each record, and render. Save stays disabled until step 3 finishes.
3. Sync: if `main`'s commit SHA equals the cached one, the cache is current. Otherwise fetch the recursive tree, compare blob SHAs, fetch only new or changed records, and drop deleted ones.
4. Apply the result to the in-memory store, and to IndexedDB in one transaction, so the cache is always one coherent snapshot.

Saves write to GitHub first, then update the in-memory store and IndexedDB. After a save, clear the cached commit SHA: `main` may now include other people's commits, so the next sync compares blob SHAs. A change to the app's record schema version clears the cache. Unverified: Safari may delete script-written storage for a site unused for 7 days; the app then falls back to a full load.

## First-load transport (spike 3)

Test in this order:

1. **Chunked GraphQL tree walk (the first-load transport; measured in S-04, ADR-022).** First resolve `main` to a commit SHA and fetch the recursive tree. Then send GraphQL queries in which each alias reads one shard folder (`"<commitSha>:data/contacts/d1"`) and returns each file's `name`, `oid` (blob SHA), and blob `text`. Keep each query to about 100 files and run up to 10 in parallel. GitHub allows 60 s of GraphQL server time per minute, estimated from response time; keep the summed response time under 50 s per rolling minute, and wait when it is over (S-04 addendum). GitHub ends any request that takes over 10 seconds with `502` or `504`, and a timeout costs extra rate-limit points for the next hour. A single query timed out somewhere between 500 and 800 files (500 took 6.7 s; 800 failed), so never send one large query; on a 502, split that chunk and retry it once. Pinning every expression to one commit SHA keeps all records from the same commit. Results feed the IndexedDB cache directly. Spike S-01 confirmed browser CORS for GraphQL with an `Authorization` header, and S-02 confirmed the tree walk returns file text and blob SHAs (with an OAuth token). Unverified: GraphQL response size limits, and fine-grained PAT support for GraphQL.
2. **Per-blob reads (baseline).** Git Trees plus one blob request per record.
3. **Verified rollup (fallback, ADR-016);** see below.

Ruled out by spike S-01 (`docs/12-RISKS-AND-OPEN-QUESTIONS.md`), because each would need a CORS proxy carrying the PAT and every record, which ADR-004 forbids:

- **A Git clone in the browser** (for example an isomorphic-git shallow clone): GitHub's Git-over-HTTP endpoints send no CORS headers.
- **The repo archive** (`GET /repos/{owner}/{repo}/tarball/{ref}`): it redirects to `codeload.github.com`, which only allows the origin `https://render.githubusercontent.com`.

No choice should require a CRM backend. The verified rollup is the only allowed index, and only as a cache.

## Verified rollup (fallback, ADR-016)

Build this only if spike (3) shows per-blob first loads are too expensive.

- One summary row per record: `id`, `path`, `blobSha`, and the fields list views need (for example `name`, `companyId`, `stageId`, `archivedAt`, `dueDate`, `related`). Activity bodies stay out; timelines load them on demand.
- Load: resolve `main`, fetch the recursive tree, then the rollup, and validate the rollup's shape. Compare each row's `blobSha` with the tree. Fetch only records that differ, are missing from the rollup, or no longer exist, and validate them as usual.
- The `main` tree is always the truth. A row is trusted only while its `blobSha` matches the tree, so a stale rollup costs extra fetches, not wrong data. Detail views always read the record itself.
- Record saves never write the rollup. The app rewrites it occasionally; a conflict on that write is dropped, not retried.
- Note search and full export still load every record.
- Location: an orphan commit on a separate ref such as `refs/gitcrm/rollup`, replaced on each rewrite. Each device also keeps its own record cache (ADR-017), so the rollup only speeds up a device's first load.
- Open until built: the rewrite rule and versioning of the row format. Unverified: whether a fine-grained PAT can create and force-update a ref outside `refs/heads/`.

## Create record

`PUT .../contents/data/contacts/d1/uuid.json` with `message`, Base64 `content`, and `branch: main`; no `sha` for a new path. On conflict, fetch and report that the record already exists; spike S-02 showed that a create on an existing path returns `422` ("\"sha\" wasn't supplied"). Validate exact path uniqueness before upload.

## Update record

`PUT .../contents/...` with the prior blob `sha`. A stale `sha` returns `409` ("… does not match &lt;sha&gt;", spike S-02). On `409`/`422`, reload the document and offer an explicit compare/resolve flow. Do not overwrite other users by fetching a new SHA and retrying blindly.

## Delete record (ADR-021)

One commit through the Git Trees/Commits APIs:

1. Read `main`'s commit SHA. Confirm every affected file still has the blob SHA the app loaded; if not, show a conflict.
2. `POST /repos/{owner}/{repo}/git/trees` with `base_tree` set to that commit's tree. Entries with `sha: null` delete the record and its related tasks and activities; entries with `content` rewrite linking records without the link.
3. `POST /repos/{owner}/{repo}/git/commits` with that tree and the current commit as parent.
4. `PATCH /repos/{owner}/{repo}/git/refs/heads/main` with the new commit SHA and `force: false`.

If step 4 fails because `main` moved, repeat from step 1 on the new `main`, a bounded number of times. After an ambiguous network failure in step 4, read `main` first: if it points to the new commit, the delete succeeded. This removes files from `main` only; it does **not** erase historical commits. Spike S-02 showed that a non-fast-forward update returns `422` ("Update is not a fast forward") and that the whole delete path takes about 2 seconds. GitHub's permissions page lists all four endpoints under `Contents` (S-05). Unverified: a live delete with a fine-grained PAT that has only `Contents: Read and write`.

## Rate limits and reliability

- Authenticated REST calls have primary and secondary rate limits. Observe `x-ratelimit-*` and `retry-after`; back off instead of hammering GitHub.
- Documented secondary limits (S-05): 100 concurrent requests across REST and GraphQL; 80 content-creating requests per minute and 500 per hour; 60 s of GraphQL server time per minute. Normal use stays far below them. Bulk work, such as CSV import, uses one multi-file commit.
- Keep mutating calls serialized by default (GitHub explicitly warns about conflicting concurrent Contents API create/update/delete calls).
- Avoid unconditional poll loops. Check `main` on page load, on tab focus (at most once every 30 seconds), and on the refresh button; nothing else.
- **Budget guard (ADR-023):** the adapter reads `x-ratelimit-remaining` on every REST response (S-01 and S-02 confirmed the page can read it). Below 500 remaining, pause background checks and show a quiet notice; saves and explicit refreshes still run. On `403` or `429` with `retry-after`, wait that long; never retry in a loop.
- **One syncing tab (ADR-023):** only one tab per workspace checks `main`, and it shares results with other tabs over `BroadcastChannel`. Pick that tab with the Web Locks API (`navigator.locks.request`); the browser releases the lock when the tab closes, so another tab takes over.
- Treat `401` (auth), `403/404` (permission, visibility, or missing), `409` (conflict), `422` (validation/conflict), and `429` (limit) as different user-facing states.
- Never log `Authorization` headers, private response bodies, email addresses, or customer names to telemetry.

## Contract tests

Use a mocked API client to assert request paths, Base64 encoding, `sha` preconditions, branch selection, error-state mapping, and no token leakage. One optional integration suite should run against a deliberately disposable **private test repository** using explicit credentials configured locally (not embedded in committed fixtures).
