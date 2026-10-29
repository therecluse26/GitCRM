# Security, Privacy, and Deletion

## Threat assumptions

CRM records contain personal or commercially sensitive information. A private repo helps restrict access; it is **not encryption**, a compliance guarantee, or proof that deleted data no longer exists. The browser and everyone authorized for the private GitHub repo are inside the trust boundary.

## Threats and mitigations

| Threat | Minimum mitigation |
| --- | --- |
| Public repo exposure | Refuse public repos; recheck visibility at connection and refresh; never publish data as static assets |
| Credential theft via JS/XSS | No inline unsafe HTML, strict CSP, no third-party analytics/scripts, one-repo short-expiry PAT; host features that inject scripts stay off (S-06) |
| Clickjacking (another site frames the app) | `frame-ancestors 'none'` header on the official copy (S-06); on hosts without custom headers, the app refuses to render inside a frame |
| Stored PAT and records on a shared or lost device | "Remember on this device" opt-out; Disconnect deletes both, and also disconnects the other open tabs of the workspace; one-repo short-expiry PAT. A fully compromised machine is out of scope (ADR-017) |
| Records passed between open tabs (ADR-023) | `BroadcastChannel` reaches only tabs of the same origin in the same browser, which can already read the record cache; messages never carry the token |
| Overbroad token scope | Fine-grained repo-restricted token; instructions to expire/revoke |
| Unauthorized collaborator access | GitHub repo permissions; onboarding explains collaborator access |
| Accidental overwrite | Blob SHA preconditions, conflict UI |
| Malformed or malicious JSON | Runtime schema checks, size caps, treat text as text rather than trusted HTML; a `website` must be `http` or `https`, so a stored `javascript:` link is refused |
| Corrupt/partial export | Validate all files and fail closed on partial snapshot |
| Sensitive information in history | Ordinary delete vs. purge distinction, clear warnings |
| Exposure through logs/telemetry | No third-party analytics by default; redact payloads and bearer tokens |
| CRM data in browser history | Browsers keep URLs in history, and some sync it to the browser vendor. URLs hold record IDs only, never names, emails, or search text; the page title stays "GitCRM" |
| Supply-chain compromise | Lockfiles, dependency review, CI scans, static-host integrity checks; `.npmrc` installs only versions at least 14 days old, and any exception is pinned and explained there |
| Compromised auth broker (only if ADR-009 is revived) | Stateless, no database; holds only the client secret; logs no codes or tokens; small reviewed codebase; secret rotation plan |

## Data boundaries

- The public static hosting origin serves **application assets only**.
- All business data comes from the user's selected private GitHub repo through authenticated API calls.
- No CRM data is sent to GitCRM-operated servers, AI APIs, crash reporters, or analytics by default. If the deferred auth broker (ADR-009) ever ships, it would see GitHub authorization codes and tokens in transit, plus request metadata such as IP addresses; never CRM records.
- No service worker should precache authenticated API responses or sensitive records.
- `Disconnect` deletes the stored token and the record cache (ADR-017); deleting browser storage cannot guarantee recovery-resistant erasure.
- Keep repo initialization and writes within `.gitcrm/` and `data/`.

## Delete, archive, purge: three different operations

1. **Archive (MVP):** record remains as a JSON file, marked `archivedAt`. Hidden from default views; can be restored.
2. **Delete from current snapshot (MVP):** commit removes the record file from `main`. Old Git commits still contain it. The same commit deletes related tasks and activities and unlinks other records (ADR-021); a preview lists every change first.
3. **Purge Git history (later, separate maintenance tool):** a dangerous rewrite may remove a record's file path from reachable repository history using `git-filter-repo`. It changes commit hashes, requires a coordinated force-push and all collaborators to reconcile their clones. It does **not** guarantee erasure from forks, other clones, GitHub caches, or PR refs. GitHub Support may only remove cached sensitive data under its documented conditions. Do not promise automatic total erasure.

Because filenames are stable UUIDs, a file's historical path is targetable. But other records, commits, exported CSV files, backups, activity notes, and the verified rollup (if built, ADR-016) may contain copies of the same PII; a path purge alone is insufficient for a subject-access or deletion request.

## Security tests required

- Static bundle scan contains no token, secret, or example real customer data.
- XSS payload in contact name or activity note is rendered harmlessly.
- Public repository is rejected; protected branch is not silently bypassed.
- `401/403/404` state produces no sensitive leaks in the UI/console.
- Same-file write conflict is not silently resolved by overwriting.
- All API/network errors preserve form data in memory until user acknowledges.

## Privacy statement scope

A future public privacy policy must separately disclose what the static host sees (Cloudflare processes visitors' IP addresses and traffic data for asset requests, never the PAT or CRM data; S-06), what an auth broker would see if one ships (codes and tokens in transit, IP addresses), what GitHub stores and when GitHub staff may access private repo content (security, scanning for malware or terms violations, support, service integrity, and legal obligations; S-05), what the browser processes, and whether any third-party telemetry is enabled. Do not claim compliance with GDPR, HIPAA, or other specialized regimes without a separate assessment.
