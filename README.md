# GitCRM - Project Starter

**Status:** Phase 2 is built and tested against a fake GitHub: connecting, setting up a workspace, contacts, companies, the opportunity pipeline, tasks, and activity notes work; other people's changes show when you return to the tab. Phase 3 has begun: Search finds every record type, Settings exports the records as a JSON snapshot or CSV files, and Delete lists every change before one commit removes the record. Browser tests cover each failure path in `docs/10`. The built app runs under a strict Content Security Policy, and each build is audited (docs/07). Browser tests check each page against WCAG 2.2 AA (docs/08). A workflow deploys each push to `main` to the official copy, after every test passes (spec 09). A manual run against a real private repository is still to do  
**Last reviewed:** 2026-10-30  
**Audience:** solo developers and tiny teams who want a useful CRM without operating a database or backend.

GitCRM is a static, browser-based CRM whose authoritative data lives as **one JSON document per record in a user's private Git repository**. On GitHub, the browser uses authenticated GitHub REST APIs to read and commit records. Searching happens over the current records in browser memory. There is no CRM application server, persistent database, or recurring automation requirement. Users connect with a fine-grained PAT (ADR-008).

> **Scope rule:** If the use case requires a traditional backend, use a different CRM instead of adding infrastructure to GitCRM.

## Read these first

1. [VISION.md](VISION.md) - product purpose, audience, promises, and anti-goals.
2. [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) - MVP behavior and definition of done.
3. [ARCHITECTURE.md](ARCHITECTURE.md) - deployment boundaries and runtime data flow.
4. [docs/12-RISKS-AND-OPEN-QUESTIONS.md](docs/12-RISKS-AND-OPEN-QUESTIONS.md) - items requiring spikes *before* building the whole UI.
5. [docs/11-IMPLEMENTATION-PLAN.md](docs/11-IMPLEMENTATION-PLAN.md) - implementation sequence and test gates.

## Documentation map

| Area | Files |
| --- | --- |
| Product | `VISION.md`, `PRODUCT_REQUIREMENTS.md`, `docs/08-UI-UX.md` |
| Persistence | `docs/02-DATA-MODEL.md`, `docs/03-REPOSITORY-LAYOUT.md`, `docs/04-GITHUB-INTEGRATION.md` |
| Access | `docs/05-AUTH-AND-ONBOARDING.md`, `docs/07-SECURITY-PRIVACY-AND-DELETION.md` |
| Performance & portability | `docs/06-SEARCH-AND-PERFORMANCE.md`, `docs/09-EXPORT-AND-MIGRATION.md` |
| Delivery | `docs/10-TESTING.md`, `docs/11-IMPLEMENTATION-PLAN.md`, `docs/01-TECHNICAL-DECISIONS.md` |
| Functional acceptance | `specs/*.md` |
| Agent instructions | `CLAUDE.md`, `AGENTS.md` |

## Core user journey

1. Open a publicly served **static application** (app code is public; CRM records are not).
2. Supply authorized access to an existing **private GitHub repository**.
3. Connect, validate, and initialize `.gitcrm/workspace.json` if not present.
4. Create contacts, companies, opportunities, tasks, and activity notes.
5. View a pipeline, search current records, and export at any time.
6. Eventually migrate to another CRM without needing GitCRM to retrieve the raw data.

## Important feasibility constraints

- **Authentication is the top product spike.** GitHub's documented OAuth code exchange requires a client secret; PKCE by itself does not remove that documented requirement. A static SPA must never embed an OAuth client secret or GitHub App private key. Users supply a repository-restricted fine-grained PAT, stored in browser storage until Disconnect (ADR-017). GitCRM uses this PAT route for the alpha and the public release (ADR-008); GitHub App sign-in through a broker is deferred until real demand appears (ADR-009).
- **The build runs on any static host (ADR-010).** Self-hosted copies can use GitHub Pages. The official copy uses Cloudflare Pages, whose terms permit it (S-06). See "Self-hosting" below.
- **Do not use GitHub Actions for CRM jobs (ADR-006).** The browser does all reads, writes, and aggregation. Actions may be used for software testing/builds/deployments of the GitCRM codebase, not as the CRM's general-purpose workflow runtime.
- **A private repository does not guarantee permanent erasure.** Git history, other clones, caches, and pull request references matter. A future purge utility must state these limitations.
- **Free is a target, not an unconditional guarantee.** Respect host limits, provider terms, and GitHub API limits.

## Spec conventions

- **MUST**: required for the MVP or a safety invariant.
- **SHOULD**: preferred default, may be deferred with an explicit decision.
- **MAY**: optional and not assumed implemented.
- **P0**: must be validated before the main feature build.
- **MVP**: minimum usable release, not a production-ready multi-tenant SaaS.

## Development

Requires Node 24 or later. Keep this code repository separate from end users' private data repositories (ADR-014). On NixOS, run `nix-shell` first: `shell.nix` provides Node and the libraries Playwright's Chromium needs.

```sh
npm install
npx playwright install chromium   # once, for the browser tests
npm test            # unit and contract tests (Vitest, against a fake GitHub)
npm run test:e2e    # browser tests (Playwright, against the built app and the same fake)
npm run dev         # the app at http://localhost:5173/, the developer page at /dev.html
npm run build       # the static app in dist/, then the build audit (docs/07)
```

`dev.html` is the developer page from Phase 1. It connects to a repo with a fine-grained PAT and creates, reads, edits, and deletes one contact. The token stays in that tab's memory. Writes go straight to the repo's default branch, so use a disposable private repo. The dev server serves the page; `npm run build` leaves it out.

## Self-hosting

`npm run build` makes `dist/`, a folder of static files. Publish it as is on any static host, at the root or in a folder, such as a GitHub Pages project site. A browser test runs the same build from `/GitCRM/` with no custom headers (spec 09).

- `dist/_headers` is for Cloudflare Pages. Other hosts serve it as a plain file that holds only the policy and a `noindex` line.
- Until the public release, `_headers` asks search engines not to index the site. On Cloudflare Pages, your copy gets that too.
- If your host can send headers, send the policy from `_headers`, with `frame-ancestors 'none'`. Without it, the app still refuses to run inside a frame.
- GitHub says Pages sites shouldn't take passwords (R-03), and GitCRM asks for a PAT. Decide that for your own copy.
