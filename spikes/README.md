# P0 spikes

Throwaway code for Phase 0 (`docs/11-IMPLEMENTATION-PLAN.md`). Spike records go in `docs/12-RISKS-AND-OPEN-QUESTIONS.md`. Never commit a token.

## S-01: Browser CORS for bulk reads (done)

See the S-01 record in `docs/12-RISKS-AND-OPEN-QUESTIONS.md`.

## S-02: REST CRUD, conflicts, multi-file commit, and GraphQL with a fine-grained PAT

1. Create a private repo whose name starts with `gitcrm-spike`, with a README so it has an initial commit.
2. Create a fine-grained PAT: GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token.
   - Resource owner: you.
   - Repository access: only the spike repo.
   - Permissions: Repository > Contents: Read and write.
   - Expiration: 7 days.
3. From the repo root, run `python3 -m http.server 8000 --directory spikes`.
4. Open `http://localhost:8000/p0-crud.html`, enter `owner/gitcrm-spike` and the PAT, then click **Run checks**.
5. Copy the "Results JSON" block and share it. It contains no token.
6. Delete the PAT when you are done.

The page writes only under `spike/` in the test repo and removes those files at the end.

The same checks run from Node (`p0-crud.js` is shared). The token is read from the environment and never printed:

```sh
GITCRM_SPIKE_TOKEN=<token> node spikes/run-node.js owner/gitcrm-spike
```

Node does not enforce CORS, so use the browser page when CORS matters (S-01 already covers it).

## S-04: First-load transport benchmark (done)

See the S-04 record in `docs/12-RISKS-AND-OPEN-QUESTIONS.md`. To reproduce:

```sh
node spikes/gen-dataset.js 2000 ds-2000      # then push it as branch bench-2000 of the spike repo
GITCRM_SPIKE_TOKEN=<token> node spikes/bench-load.js owner/gitcrm-spike bench-100 bench-500 bench-2000
# GraphQL-only tuning run, a few REST requests:
BENCH_CHUNKED_ONLY=1 CHUNK_DIRS=25 CHUNK_CONCURRENCY=10 GITCRM_SPIKE_TOKEN=<token> node spikes/bench-load.js owner/gitcrm-spike bench-2000
```

A full run spends about 2,600 REST requests (the per-blob transport) out of the hourly 5,000.

## S-03: Fine-grained PATs for org members (ADR-018, R-11)

This needs two GitHub accounts, A (owner) and B (member), **held by two different people**. GitHub's terms allow one free account per person; the one extra machine account they allow is only for automated tasks. Ask a colleague or friend to be B.

1. As A, create a free organization. In it, create a private repo `gitcrm-spike-org` with a README.
2. Invite B to the organization, and give B write access to the repo.
3. As B, start a fine-grained PAT. **Record:** does the organization appear under Resource owner? Select it, select only the repo, and set Contents: Read and write.
4. **Record:** does the token show "pending approval"? If it does, approve it as A under the organization's Settings > Personal access tokens > Pending requests.
5. Run the S-02 page with B's token against `<org>/gitcrm-spike-org`.
6. Optional, because GitHub's docs already answer R-11 (S-05): as A, create a personal private repo `gitcrm-spike-personal` and add B as a collaborator. As B, start a fine-grained PAT. **Record:** can B select A as Resource owner, or select that repo at all?

Share the answers to steps 3, 4, and 6, plus the S-02 results JSON from step 5.
