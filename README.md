# GitCRM - Project Starter

**Status:** concept / pre-implementation specification  
**Last reviewed:** 2026-10-26  
**Audience:** solo developers and tiny teams who want a useful CRM without operating a database or backend.

GitCRM is a static, browser-based CRM whose authoritative data lives as **one JSON document per record in a user's private Git repository**. On GitHub, the browser uses authenticated GitHub REST APIs to read and commit records. Searching happens over the current records in browser memory. There is no CRM application server, persistent database, or recurring automation requirement.

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

- **Authentication is the top product spike.** GitHub's documented OAuth code exchange requires a client secret; PKCE by itself does not remove that documented requirement. A static SPA must never embed an OAuth client secret or GitHub App private key. The *developer-first alpha* may accept a user-provided, repository-restricted fine-grained PAT held only in memory. A polished public onboarding flow remains an open decision.
- **Do not make GitHub Pages the default production SaaS host.** GitHub Pages explicitly restricts hosting sites primarily providing commercial SaaS. Use an appropriate static hosting provider (e.g. Cloudflare Pages after reviewing its terms). GitHub Pages may be suitable for a noncommercial demo under its terms.
- **Do not use GitHub Actions for CRM jobs.** Actions may be used for software testing/builds/deployments of the GitCRM codebase, not as the CRM's general-purpose workflow runtime.
- **A private repository does not guarantee permanent erasure.** Git history, other clones, caches, and pull request references matter. A future purge utility must state these limitations.
- **Free is a target, not an unconditional guarantee.** Respect host limits, provider terms, and GitHub API limits.

## Spec conventions

- **MUST**: required for the MVP or a safety invariant.
- **SHOULD**: preferred default, may be deferred with an explicit decision.
- **MAY**: optional and not assumed implemented.
- **P0**: must be validated before the main feature build.
- **MVP**: minimum usable release, not a production-ready multi-tenant SaaS.

## Starting the project

This ZIP contains **documentation only**, deliberately no application scaffold or hidden infrastructure. Initialize a separate code repository, copy these files, and begin with the P0 spikes in `docs/11-IMPLEMENTATION-PLAN.md`. Keep the code repository separate from end users' private data repositories.
