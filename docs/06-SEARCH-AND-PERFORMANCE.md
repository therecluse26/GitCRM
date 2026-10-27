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

Measure tree+blob fetching first. Only test archive snapshot if browser security/CORS and temporary redirect semantics are understood.

## Caching

- Treat git blob SHA and tree/commit SHA as the cache keys.
- In-memory cache only in MVP; no sensitive data persisted in static assets or caches across logout.
- If HEAD SHA is unchanged, reuse the current snapshot.
- If HEAD moves, fetch a new tree and only changed blobs, then rebuild affected indexes.
- Never mix record versions from different snapshots without visibly reporting partial/inconsistent load.

## Intended scale

Small teams, hundreds or a few thousand records, low write volume. Not designed for tens of thousands of rapidly edited records, real-time activity streams, or daily bulk imports. Prefer an honest documented scale boundary to complex backend indexing.
