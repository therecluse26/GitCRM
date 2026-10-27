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
| Delete document from `main` | `DELETE /repos/{owner}/{repo}/contents/{path}` |
| Enumerate tree efficiently | `GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1` |
| Fetch blob contents | `GET /repos/{owner}/{repo}/git/blobs/{file_sha}` |
| Resolve head for consistency | `GET /repos/{owner}/{repo}/git/ref/heads/main` and commit/tree lookup |
| Display commit confirmation | returned Contents API commit metadata |

GitHub uses explicit content permissions for write operations. Request least privilege; do not ask for workflows permission. For the alpha, a fine-grained user PAT should be restricted to the one CRM repo with `Contents: Read and write` and implicit metadata read access. Confirm these permissions in a live spike.

## Workspace snapshot algorithm (candidate)

1. Resolve `refs/heads/main` to a commit and associated tree SHA.
2. Fetch recursive Git tree and filter `.gitcrm/workspace.json`, `data/**`.
3. Retrieve each referenced blob by SHA; validate full content and expected path/type/ID.
4. Expose data only after a coherent snapshot has loaded. If some blobs fail, show an explicit partial-read error and disable unsafe export/write.
5. Cache blob SHA to parsed record in **ephemeral client memory** for reloads within the session.
6. Refresh based on HEAD SHA. If unchanged, don't re-fetch files; if changed, compare paths + blob SHAs and fetch only changed files.

Git Trees has response-size/truncation limits. If `truncated = true`, recursively traverse subtrees or show a controlled unsupported-size error; **never silently omit data**. A first-load API call per document is potentially expensive; performance alternatives must be tested, not assumed.

## Alternatives worth measuring

- Downloading a private repo archive as a single snapshot. GitHub returns a redirect to a short-lived URL; test whether browser CORS, redirect behavior, and token handling make this safe and functional before choosing it.
- GraphQL alias batching or selected file reads.
- Sparse loading details after a smaller metadata summary (requires a maintained or generated index; not MVP without proven need).

No choice should require a CRM backend or a persistent query index.

## Create record

`PUT .../contents/data/contacts/d1/uuid.json` with `message`, Base64 `content`, and `branch: main`; no `sha` for a new path. On conflict, fetch and report that the record already exists. Validate exact path uniqueness before upload.

## Update record

`PUT .../contents/...` with the prior blob `sha`. On `409`/`422`, reload the document and offer an explicit compare/resolve flow. Do not overwrite other users by fetching a new SHA and retrying blindly.

## Delete record

`DELETE .../contents/...` with prior blob `sha`, branch, and message. This deletes only the file in the current branch. It does **not** erase historical commits.

## Rate limits and reliability

- Authenticated REST calls have primary and secondary rate limits. Observe `x-ratelimit-*` and `retry-after`; back off instead of hammering GitHub.
- Keep mutating calls serialized by default (GitHub explicitly warns about conflicting concurrent Contents API create/update/delete calls).
- Avoid unconditional poll loops. A refresh button plus modest visibility-triggered checks is enough for MVP.
- Treat `401` (auth), `403/404` (permission, visibility, or missing), `409` (conflict), `422` (validation/conflict), and `429` (limit) as different user-facing states.
- Never log `Authorization` headers, private response bodies, email addresses, or customer names to telemetry.

## Contract tests

Use a mocked API client to assert request paths, Base64 encoding, `sha` preconditions, branch selection, error-state mapping, and no token leakage. One optional integration suite should run against a deliberately disposable **private test repository** using explicit credentials configured locally (not embedded in committed fixtures).
