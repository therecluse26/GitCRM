# Risks, Open Questions, and Feasibility Spikes

These are **real unresolved dependencies**, not minor TODOs. The docs deliberately avoid claiming they have been solved.

| ID | Impact | Question / risk | Required validation | Fallback |
| --- | --- | --- | --- | --- |
| R-01 | Critical | Polished GitHub login from a truly static browser app | Test official OAuth requirements, PKCE, client secret and token-exchange CORS; threat model | Fine-grained PAT for developer alpha; explicit decision for public UX |
| R-02 | High | First load of thousands of JSON files may consume excessive GitHub requests | Benchmark Git Trees + blob fetches, incremental SHA caching, optional private archive delivery | Limit published supported dataset size |
| R-03 | High | GitHub Pages disallows sites primarily providing commercial SaaS | Select compliant static provider; verify policies | Cloudflare Pages or equivalent static host; do not use Pages for SaaS |
| R-04 | High | Small concurrent edits can conflict | Two-client live proof; GitHub Contents API SHA behavior | Conflict UI, serialize/retry nonoverlapping writes conservatively |
| R-05 | High | User may accidentally expose repository or token | Visibility checks, narrow scopes, browser security review | Fail closed; disclose and direct to rotate/restrict |
| R-06 | High | Delete != full erasure from Git | Validate history rewrite workflow against a disposable repo and support policy | Keep history purge out of MVP; accurately label deletion |
| R-07 | Medium | Limited account/org policies block PATs or branch writes | Test collaborator and organization permission failures | Clear unsupported-state messaging, no hidden privilege escalation |
| R-08 | Medium | GitHub API rate limits and provider terms can change | Monitor current docs; conservative API usage | Publish bounded scale expectations |
| R-09 | Medium | Multiuser data becomes inconsistent during partial refresh | Pin to commit/tree and compare SHAs | Abort partial load, manual refresh |
| R-10 | Medium | CRM migration CSV can lose relationships/notes | Contract tests + lossless JSON snapshot | Raw JSON always available |

## P0 spike record template

For each spike, write: **Date; hypothesis; exact repo/config; documented API behavior; reproduction steps; timings/results; threat/privacy assessment; decision; follow-up tests.** Avoid vague "looks feasible" conclusions.

## Most important product decision

Does a PAT-based alpha satisfy the first release's intended audience, or is polished GitHub App login a release blocker? This decision determines whether a *pure static no-backend commercial product* can ship under the original constraints. Do not add a secret-bearing proxy without deliberately revisiting the vision.

## Commercial deployment check

GitHub Pages' official Terms and limits restrict SaaS usage. GitHub Actions' official Additional Product Terms constrain using hosted runners as general serverless/application workloads. Treat these as provider contract boundaries, not technical limitations to evade.
