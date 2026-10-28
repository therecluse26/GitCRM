# Risks, Open Questions, and Feasibility Spikes

These are **real unresolved dependencies**, not minor TODOs. The docs deliberately avoid claiming they have been solved.

| ID | Impact | Question / risk | Required validation | Fallback |
| --- | --- | --- | --- | --- |
| R-01 | High | PAT setup friction limits adoption by less technical users | Usability test of the PAT setup instructions with target users | Accepted for now (ADR-008); GitHub App sign-in through a broker if demand appears (ADR-009, deferred) |
| R-02 | High | First load of thousands of JSON files may consume excessive GitHub requests | Benchmark the GraphQL tree walk and Git Trees + blob fetches (archive ruled out, S-01); incremental SHA caching | Measured (S-04): chunked GraphQL loads 2,000 records in ~5 s. Fallbacks: verified rollup (ADR-016), then a published size limit |
| R-03 | High | GitHub Pages disallows sites primarily providing commercial SaaS, and says sites shouldn't be used for sending passwords (S-05) | Select compliant static provider; verify its terms | Host-agnostic build (ADR-010): move the official copy to any compliant static host |
| R-04 | High | Small concurrent edits can conflict | Two-client live proof; GitHub Contents API SHA behavior | Conflict UI, serialize/retry nonoverlapping writes conservatively |
| R-05 | High | User may accidentally expose repository or token | Visibility checks, narrow scopes, browser security review | Fail closed; disclose and direct to rotate/restrict |
| R-06 | High | Delete != full erasure from Git | Validate history rewrite workflow against a disposable repo and support policy | Keep history purge out of MVP; accurately label deletion |
| R-07 | Medium | Limited account/org policies block PATs or branch writes | Test collaborator and organization permission failures | Clear unsupported-state messaging, no hidden privilege escalation |
| R-08 | Medium | GitHub API rate limits and provider terms can change | Monitor current docs; conservative API usage | Budget guard and one syncing tab (ADR-023); publish bounded scale expectations |
| R-09 | Medium | Multiuser data becomes inconsistent during partial refresh | Pin to commit/tree and compare SHAs | Abort partial load, manual refresh |
| R-10 | Medium | CRM migration CSV can lose relationships/notes | Contract tests + lossless JSON snapshot | Raw JSON always available |
| R-11 | High | Fine-grained PATs cannot be used by outside or repository collaborators (GitHub docs, S-05), so collaborators on a personal repo cannot use GitCRM | Answered by S-05. S-03 still checks the org approval flow live | Decided: team workspaces live in a GitHub organization, and every teammate is an org member (ADR-018); never ask users for classic or shared PATs |

## P0 spike record template

For each spike, write: **Date; hypothesis; exact repo/config; documented API behavior; reproduction steps; timings/results; threat/privacy assessment; decision; follow-up tests.** Avoid vague "looks feasible" conclusions.

## P0 spike records

### S-01: Browser CORS for bulk-read transports

- **Date:** 2026-10-27, 22:24 EDT.
- **Hypothesis:** GitHub's Git-over-HTTP endpoints and archive host block browser CORS calls; `api.github.com` REST and GraphQL allow them.
- **Config:** Chromium via Playwright; page origin `https://example.com`; public repo `octocat/Hello-World`; no valid token. A private repo would add auth, which cannot replace a missing CORS header.
- **Documented behavior:** GitHub documents CORS for the REST API (`docs/13-SOURCES.md`). Our sources document no CORS for Git HTTP or `codeload.github.com`.
- **Steps:** `fetch()` from the page to each endpoint. A blocked request throws `TypeError: Failed to fetch`, and the console names the CORS cause.
- **Results:**

| Endpoint | Result |
| --- | --- |
| `GET api.github.com/repos/{repo}` | Readable (200); `x-ratelimit-remaining` is exposed to the page |
| `POST api.github.com/graphql` with `Authorization` and a JSON body (preflighted) | Readable (401 for the invalid token), so the preflight passes |
| `GET github.com/{repo}.git/info/refs?service=git-upload-pack` | Blocked: no `Access-Control-Allow-Origin` header |
| `POST github.com/{repo}.git/git-upload-pack` | Blocked: the preflight has no `Access-Control-Allow-Origin` header |
| `GET api.github.com/repos/{repo}/tarball/master`, redirected to `codeload.github.com` | Blocked: codeload sends `Access-Control-Allow-Origin: https://render.githubusercontent.com` only |
| `GET codeload.github.com/{repo}/tar.gz/refs/heads/master` | Blocked: same header |

- **Threat/privacy assessment:** no token or private data was used.
- **Decision:** a Git clone in the browser and the archive download both need a proxy, which ADR-004 rules out. GraphQL stays the first bulk-read transport; per-blob reads are the baseline.
- **Follow-up:** S-02 confirms GraphQL with a real fine-grained PAT on a private repo (`spikes/p0-crud.html`). Spike (3) then measures GraphQL load times at 100/500/2000 records.

### S-02: REST CRUD, conflicts, multi-file commit, and GraphQL

- **Date:** 2026-10-27, 22:30 EDT.
- **Hypothesis:** Contents API writes enforce blob-SHA preconditions; the Git Trees/Commits path rejects a non-forced ref update after the branch moved; GraphQL returns file text for a folder.
- **Config:** `therecluse26/gitcrm-spike` (private, default branch `main`, created for this spike). Node 24.15 via `spikes/run-node.js`. Token: the `gh` CLI OAuth token (`repo` scope), **not** a fine-grained PAT.
- **Steps:** `GITCRM_SPIKE_TOKEN=… node spikes/run-node.js therecluse26/gitcrm-spike`. The run writes under `spike/` and removes it at the end.
- **Results (14 of 14 checks passed):**

| Check | Result | Time |
| --- | --- | --- |
| Create (Contents PUT, no `sha`) | 201 | 812 ms |
| Read back | 200, same blob SHA | 294 ms |
| Update with current `sha` | 200 | 706 ms |
| Update with stale `sha` | **409**: "… does not match &lt;sha&gt;" | 288 ms |
| Create on an existing path without `sha` | **422**: "\"sha\" wasn't supplied" | 236 ms |
| Multi-file commit (get ref, get commit, tree, commit, ref update) | 200 | 1,963 ms |
| Non-forced ref update after the branch moved | **422**: "Update is not a fast forward" | 296 ms |
| GraphQL tree walk of `spike/`, pinned to a commit SHA | 200, text and `oid` for 2 files | 335 ms |
| `x-ratelimit-remaining` readable | Yes | |
| Cleanup | `spike/` removed in one commit | 1,594 ms |

- **Threat/privacy assessment:** test data only; the token was never printed or stored.
- **Decision:** the write model works as designed. Blob-SHA preconditions stop silent overwrites (spec 07), and the non-forced ref update protects the ADR-021 delete. Single saves (0.7–0.8 s) meet the 2-second target. A cascade delete takes about 2 seconds, so the delete UI should show progress.
- **Follow-up:** repeat from the browser page with a fine-grained PAT that has only Contents: Read and write. That confirms the Git Data API and GraphQL work with that permission, and that `PUT` and `PATCH` preflights pass. Then run S-03 and the load benchmark.

### S-04: First-load transport benchmark (spike 3)

- **Date:** 2026-10-27, 22:39–22:41 EDT.
- **Hypothesis:** a GraphQL tree walk loads a full snapshot much faster, and with far fewer rate-limited requests, than per-blob REST reads.
- **Config:** `therecluse26/gitcrm-spike`, branches `bench-100`, `bench-500`, `bench-2000` made by `spikes/gen-dataset.js` (deterministic; 10% companies, 25% contacts, 10% opportunities, 15% tasks, 40% activities; note bodies 100–1,500 characters). 2,000 records are about 1.2 MB of JSON. Node 24.15 via `spikes/bench-load.js`, `gh` OAuth token, one run per setting, from one home connection.
- **Steps:** for each branch, resolve the head commit, then load the full snapshot four ways. Times include resolving the head (about 0.4 s).
- **Results (full snapshot, wall-clock):**

| Transport | 100 records | 500 records | 2,000 records |
| --- | --- | --- | --- |
| GraphQL, one query for everything | 3.2 s | 6.7 s | **Fails:** HTTP 502 after ~10.4 s |
| GraphQL, one query per type, in parallel | 1.4 s | 6.0 s | **Fails** for activities (800 records): 502 after ~10.8 s |
| GraphQL, 100 shard folders per query, 3 in parallel | 3.3 s | 5.8 s | 15.4 s (10 queries) |
| GraphQL, 50 folders per query, 8 in parallel | — | 3.8 s | 9.1 s (19 queries) |
| **GraphQL, 25 folders per query, 10 in parallel** | — | **3.1 s** | **5.1 s** (38 queries, slowest 2.1 s) |
| Per-blob REST, 8 in parallel | 3.4 s (104 requests) | 12.5 s (504) | 47.7 s (2,004 requests) |

| Other measurement | Result |
| --- | --- |
| Warm cache, `main` unchanged (`GET` ref) | ~0.2 s |
| Sync after one edit (ref, commit, recursive tree, one blob) | ~0.8–1.0 s |
| Recursive tree at 2,000 records | 0.28 s, 741 KB, not truncated |
| In-memory search at 2,000 records | ~0.15 ms per search |
| GraphQL rate-limit cost | 1 point per query |
| Bytes for 2,000 records | ~2.2 MB via GraphQL, ~2.9 MB per-blob (base64) |

- **Threat/privacy assessment:** generated data only; the token was never printed or stored.
- **Decision (proposed as ADR-022, revised by the addendum below):** load the first snapshot with chunked GraphQL, at about 100 files per query (from the recursive tree) and up to 10 queries in parallel, all pinned to one commit. Keep the summed GraphQL response time under 50 s per rolling minute. Per-blob REST is fine for small syncs. Per-blob REST is not viable for first loads: at 2,000 records it takes 48 s and spends 40% of the hourly 5,000-request limit. The verified rollup (ADR-016) is not needed at the target scale. Any single GraphQL query must stay well under ~10 s of server time; on a 502 the app splits that chunk and retries once.
- **Follow-up:** confirm in a browser with a fine-grained PAT (S-02 follow-up). Single runs from one location, so variance is unknown; repeat before treating the numbers as stable.

#### S-04 addendum: GraphQL server time (2026-10-28, 07:46 EDT)

GitHub allows 60 s of GraphQL server time per minute, and says to estimate it from total response time (S-05). A second run recorded the sum of all query times:

| Setting | Records | Wall-clock | Sum of query times | Queries |
| --- | --- | --- | --- | --- |
| 25 shard folders per query, 10 in parallel | 500 | 4.8 s | 27.6 s | 16 |
| 25 shard folders per query, 10 in parallel | 2,000 | 8.5 s | 70.6 s | 38 |
| 25 shard folders per query, 4 in parallel | 2,000 | 18.1 s | 65.1 s | 38 |
| 50 shard folders (~100 files) per query, 10 in parallel | 2,000 | 6.9 s | 46.8 s | 19 |

- Wall-clock varies a lot: the same setting took 5.1 s on the first run and 8.5 s on the second.
- A 2,000-record first load uses 47–71 s of response time in under 10 s. That is close to, or over, the 60-second limit. No request was rate-limited.
- Fewer, larger queries use less total time. Parallelism changes the wall-clock, not the total.
- Response time includes network time, so it overestimates server time. A budget of 50 s per rolling minute keeps a margin.
- With that budget, a first load above about 2,000 records slows down instead of failing.

### S-05: GitHub terms and documented limits

- **Date:** 2026-10-28, 07:45 EDT. A reading of GitHub's current docs, not a test run.
- **Question:** do GitHub's terms allow GitCRM's use of the API, private repos, Pages, and fine-grained PATs? Which documented limits apply?
- **Sources:** Terms of Service (sections E and H), Acceptable Use Policies, Additional Product Terms (Pages, Actions), Pages limits, the REST and GraphQL rate-limit pages, the PAT page, the fine-grained PAT permissions page, and repository limits. Links are in `docs/13-SOURCES.md`.
- **Findings:**

| Topic | What GitHub's docs say | Effect on GitCRM |
| --- | --- | --- |
| API use | "Abuse or excessively frequent requests" can suspend API access. "You may not share API tokens to exceed GitHub's rate limitations." | Normal use is allowed. Supports no shared PATs (ADR-018) and the budget guard (ADR-023) |
| Bulk activity | The AUP bans "excessive automated bulk activity" and placing "undue burden on our servers through automated means" | User-driven saves and loads are not bulk activity. A bulk import must be one commit |
| Private repos | Content is confidential. GitHub staff may access it for security, scanning for malware or terms violations, support, service integrity, and legal obligations | The privacy statement must say this (docs/07) |
| Pages | Not for "commercial software as a service (SaaS)". Sites "shouldn't be used for sensitive transactions like sending passwords or credit card numbers" | A PAT is a password-like secret. The official copy should use another host; self-hosters on Pages get this caveat (ADR-010) |
| Actions | Not for a burden "disproportionate to the benefits provided to users", for example "as part of a serverless application" | Confirms ADR-006 |
| Secondary limits | 100 concurrent requests (REST and GraphQL together); 80 content-creating requests per minute and 500 per hour; 900 points per minute per REST endpoint and 2,000 for GraphQL; 60 s of GraphQL server time per minute | Normal use is far below these. The GraphQL time limit shapes first loads (S-04 addendum, ADR-022) |
| GraphQL timeout | A request over 10 s returns `502` or `504`. A timeout also costs extra primary rate-limit points for the next hour | Matches the S-04 failures. Keep queries small |
| Fine-grained PAT gaps | Fine-grained PATs cannot be used to contribute to repos "where the user is an outside or repository collaborator" | Answers R-11: teammates must be organization members (ADR-018). Personal-repo collaborators and outside collaborators cannot use GitCRM, because it never asks for a classic PAT |
| Org PAT approval | If the org requires approval, a new token stays `pending` and can read only public resources. Org owners are approved automatically. Orgs can set a maximum token lifetime | Onboarding must explain a pending token (docs/05) |
| PAT permissions | Every Git endpoint GitCRM uses (`GET git/ref`, `git/trees`, `git/commits`, `git/blobs`, `PATCH git/refs`) is listed under `Contents`. `PATCH git/refs` is also listed under `Workflows`; we read that as applying only to commits that change workflow files (unverified) | A PAT with only `Contents: Read and write` should be enough. Still to confirm live (S-02 follow-up) |
| Repo limits (recommended, not enforced) | Directory width 3,000 entries; single object 1 MB; 6 pushes per minute per repository | Shards stay far below 3,000 entries, and records far below 1 MB. Unverified: whether API commits count as pushes |

- **Decision:** nothing in GitHub's terms forbids GitCRM's design. The limits are: no shared tokens, no bulk automation, no commercial SaaS on Pages, and staying inside the documented rate limits.
- **Follow-up:** confirm the PAT permissions live (S-02 follow-up). Check the terms of the static host chosen for the official copy. Read these pages again before the public release.

## Most important product decision

Decided 2026-10-27 (ADR-004, ADR-008, ADR-009, ADR-015): GitCRM is a product for other people, and users connect with a fine-grained PAT in both the alpha and the public release. A stateless auth broker is allowed in principle but deferred until real demand appears.

## Commercial deployment check

Read on 2026-10-28 (S-05): GitHub Pages forbids commercial SaaS and advises against sending passwords through Pages sites. The Actions terms forbid using Actions as part of a serverless application. Treat these as provider contract boundaries, not technical limitations to evade.
