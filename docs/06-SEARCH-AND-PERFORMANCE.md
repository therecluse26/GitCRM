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

**Search latency, measured 2026-10-30** (spec 05): Chromium through Playwright on the development machine, against the fake GitHub. One run per size; each number is the median of 7 keystrokes, from the input event until React has drawn the results. Filtering is fast (S-04: about 0.15 ms at 2,000 records). Drawing the result rows is the cost.

| Search | 100 records | 500 records | 2,000 records |
| --- | --- | --- | --- |
| "e" (matches every record), every row drawn | 53 ms | 116 ms | 737 ms |
| "e", the first 10 per group (built) | 32 ms | 31 ms | 37 ms (slowest 47 ms) |
| "ava bennett", the first 10 per group | 5 ms | 10 ms | 27 ms |

After "Show all", one record type draws every result. At 2,000 records, "e" took 29 ms for 600 contacts, 255 ms for 500 tasks, and 318 ms for 400 activities. A task or activity row costs about 0.5 to 0.8 ms. Building each date formatter once halved the activity time but not the task time, so that change was not kept. No search package: the filter is not the slow part.

**Export time, measured 2026-10-30** (spec 05): the same setup, three exports at each size, from the click until the browser starts the download. The records are 15% companies, 30% contacts, 10% opportunities, 25% tasks, and 20% activities with notes of about 380 characters. fflate's `zipSync` builds the ZIP on the page.

| Export | 100 records | 500 records | 2,000 records |
| --- | --- | --- | --- |
| JSON snapshot | 50–60 ms, 50 KiB | 63–97 ms, 220 KiB | 155–175 ms, 860 KiB |
| CSV | 26–46 ms, 13 KiB | 37–50 ms, 34 KiB | 49–62 ms, 113 KiB |

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
