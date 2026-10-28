# Risks, Open Questions, and Feasibility Spikes

These are **real unresolved dependencies**, not minor TODOs. The docs deliberately avoid claiming they have been solved.

| ID | Impact | Question / risk | Required validation | Fallback |
| --- | --- | --- | --- | --- |
| R-01 | High | PAT setup friction limits adoption by less technical users | Usability test of the PAT setup instructions with target users | Accepted for now (ADR-008); GitHub App sign-in through a broker if demand appears (ADR-009, deferred) |
| R-02 | High | First load of thousands of JSON files may consume excessive GitHub requests | Benchmark the GraphQL tree walk and Git Trees + blob fetches (archive ruled out, S-01); incremental SHA caching | Verified rollup (ADR-016); otherwise limit published supported dataset size |
| R-03 | High | GitHub Pages disallows sites primarily providing commercial SaaS | Select compliant static provider; verify policies | Host-agnostic build (ADR-010): move the official copy to any compliant static host |
| R-04 | High | Small concurrent edits can conflict | Two-client live proof; GitHub Contents API SHA behavior | Conflict UI, serialize/retry nonoverlapping writes conservatively |
| R-05 | High | User may accidentally expose repository or token | Visibility checks, narrow scopes, browser security review | Fail closed; disclose and direct to rotate/restrict |
| R-06 | High | Delete != full erasure from Git | Validate history rewrite workflow against a disposable repo and support policy | Keep history purge out of MVP; accurately label deletion |
| R-07 | Medium | Limited account/org policies block PATs or branch writes | Test collaborator and organization permission failures | Clear unsupported-state messaging, no hidden privilege escalation |
| R-08 | Medium | GitHub API rate limits and provider terms can change | Monitor current docs; conservative API usage | Publish bounded scale expectations |
| R-09 | Medium | Multiuser data becomes inconsistent during partial refresh | Pin to commit/tree and compare SHAs | Abort partial load, manual refresh |
| R-10 | Medium | CRM migration CSV can lose relationships/notes | Contract tests + lossless JSON snapshot | Raw JSON always available |
| R-11 | High | Fine-grained PATs may not reach a repo owned by another personal account, so collaborators on a personal workspace repo might need classic PATs with all-repo scope (unverified) | Spike: a collaborator tries to create a fine-grained PAT for a personal repo they collaborate on; check org PAT policies for members | Decided: team workspaces live in a GitHub organization (ADR-018); never ask users for classic or shared PATs |

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

## Most important product decision

Decided 2026-10-27 (ADR-004, ADR-008, ADR-009, ADR-015): GitCRM is a product for other people, and users connect with a fine-grained PAT in both the alpha and the public release. A stateless auth broker is allowed in principle but deferred until real demand appears.

## Commercial deployment check

GitHub Pages' official Terms and limits restrict SaaS usage. GitHub Actions' official Additional Product Terms constrain using hosted runners as general serverless/application workloads. Treat these as provider contract boundaries, not technical limitations to evade.
