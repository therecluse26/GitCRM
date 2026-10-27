# Agent Guide

All coding agents should read [CLAUDE.md](CLAUDE.md) and the linked product/architecture documents before changing this project.

Rules that take priority over convenience:

1. Do not add a backend, persistent database, or GitHub Actions CRM automations.
2. The private Git repository is authoritative; one JSON document per entity.
3. Never assume a browser OAuth client secret is safe; verify auth behavior independently.
4. Write tests from `specs/` before feature implementation.
5. Document substantial tradeoffs and defer non-MVP ideas.
