# Search and Performance

## Principle

Git stores the truth. The **current checked-out logical snapshot on `main`** is the query dataset. Never search Git history to answer a normal CRM query; never introduce a hosted search index.

## Search behavior

- Search contacts by name, email, phone, tags, and company name.
- Search companies by name and website.
- Search opportunities by title, stage, linked contact/company, and exact/filtered value.
- Search tasks and activities by title/body and associated record.
- Case-insensitive, trimmed, forgiving matching. A local fuzzy-search library is optional.
- Results must update after a successful write and must not expose archived records by default.

## Implementation sequence

1. Load a complete validated workspace snapshot.
2. Build in-memory lookup maps by record ID and relations.
3. Implement basic text filtering plus structured filters and sorting.
4. Measure latency at 100, 500, and 2,000 entities before adding a search package.
5. Add MiniSearch/FlexSearch only if results show basic filtering is inadequate.

A "flat file search engine" is a legitimate optimization, but the most likely expensive operation is downloading thousands of distinct blobs from GitHub. Focus early measurement there.

## Transport measurement spike

With a private disposable repository, generate datasets of approximately 100, 500, and 2,000 documents, with realistic average note lengths. Record:

| Measurement | Why |
| --- | --- |
| First load wall-clock | Onboarding experience |
| Requests per initial load | GitHub rate limits |
| Bytes transferred | Mobile and slow network cost |
| Search latency | Validates local-only query assumption |
| Refresh latency after one edit | Confirms incremental approach |
| Concurrent update result | No silent data loss |
| Browser memory peak | Avoid bloated client state |

Measure the GraphQL tree walk first, then per-blob fetching (`docs/04-GITHUB-INTEGRATION.md`). The archive download is ruled out (spike S-01).

### Targets (spike pass criteria, agreed 2026-10-27)

| Measurement | Target |
| --- | --- |
| Page load with a warm cache | Under 1 second |
| Save one record | Under 2 seconds |
| First load on a new device, 500 records | Under 10 seconds |
| Two people save the same record | Always an explicit conflict, never a silent overwrite |

If first load misses the target at 2,000 records, use a faster transport or the verified rollup (ADR-016); the rest of the design stays.

**Measured in spike S-04** (Node, OAuth token, one run each; see `docs/12-RISKS-AND-OPEN-QUESTIONS.md`):

| Measurement | Target | Result |
| --- | --- | --- |
| Page load with a warm cache | Under 1 s | ~0.2 s (one `GET` of the ref) |
| Save one record | Under 2 s | 0.7–0.8 s (S-02) |
| First load, 500 records | Under 10 s | 3.1–4.8 s with chunked GraphQL (two runs); 12.5 s per-blob |
| First load, 2,000 records | (none) | 5.1–8.5 s with chunked GraphQL (two runs); 47.7 s per-blob |
| Same-record conflict | Explicit, never silent | `409` on a stale SHA (S-02) |

## Caching

- Treat git blob SHA and tree/commit SHA as the cache keys.
- Records are cached in IndexedDB, keyed by blob SHA (ADR-017). The cache hydrates the in-memory store at startup; see `docs/04-GITHUB-INTEGRATION.md`. Disconnect deletes the cache; nothing sensitive goes into static assets or service-worker caches.
- If HEAD SHA is unchanged, reuse the current snapshot.
- If HEAD moves, fetch a new tree and only changed blobs, then rebuild affected indexes.
- If spike (3) shows per-blob first loads are too expensive, use the verified rollup (ADR-016, `docs/04-GITHUB-INTEGRATION.md`).
- Never mix record versions from different snapshots without visibly reporting partial/inconsistent load.

## Intended scale

Small teams, hundreds or a few thousand records, low write volume. Not designed for tens of thousands of rapidly edited records, real-time activity streams, or daily bulk imports. Prefer an honest documented scale boundary to complex backend indexing.
