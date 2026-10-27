# Private Repository Contract

## Canonical layout

```text
gitcrm-workspace/                 # user-owned, PRIVATE, separate from app source
├── .gitcrm/
│   └── workspace.json           # schemaVersion, name, currency, stages
└── data/
    ├── contacts/
    │   └── d1/
    │       └── d13d0f69-0a4c-4192-9009-9e36a51c42c0.json
    ├── companies/
    │   └── a2/
    │       └── a28a8fb0-52c6-493d-9a11-99a4f0b8a6cf.json
    ├── opportunities/
    │   └── e8/
    │       └── e8c756c7-f1b2-4c47-9d3d-26457c6b0979.json
    ├── tasks/
    │   └── 9b/
    │       └── 9b8b4d79-75d6-450c-a492-1e0638d49cd8.json
    └── activities/
        └── bf/
            └── bf80abe2-aeda-4aec-8fc4-75f44e55d04b.json
```

## Filename invariant

`data/{pluralType}/{firstTwoLowercaseHexCharsOfUUID}/{uuid}.json`.

UUID v4's first two hex characters distribute records across 256 directories and avoid the GitHub Contents API's **1,000 entries per directory** limit. Never put a person's name, email, or company name in a filename.

## Branch model

- `main` is authoritative for MVP, with an initial commit in place before initialization.
- The app reads only `main`; do not treat unmerged pull requests as current CRM data.
- A selected branch may be protected or require PRs; for MVP, flag as incompatible with direct writes rather than implementing a PR approval workflow.
- Repositories may contain other files, but the app only reads/writes `.gitcrm/workspace.json` and `data/**`.

## Git semantics

- One ordinary UI record save = one commit with an informative message, e.g. `gitcrm: update contact d13d0f69`.
- Use GitHub's Contents API for single-document writes. An update requires the **previous Git blob SHA**.
- Write `updatedAt` only when user-visible content changes. Avoid commit loops from formatting differences.
- Unknown files outside the managed paths are never touched.
- No generated index or aggregated CRM records file is committed as part of normal operation.

## Initialization and validation

1. Require a repository that is private; ideally empty/dedicated.
2. Verify `main` is readable and writable.
3. If `.gitcrm/workspace.json` exists, validate version and shape before mounting the workspace.
4. If missing, offer explicit Initialize, writing the config via one commit.
5. Never overwrite pre-existing workspace config without a migration or explicit user confirmation.

## Repository limitations

The Contents API lists at most 1,000 entries per directory; use Git Trees for discovery. GitHub also recommends bounded directory width, small Git objects, and fewer than about six pushes per minute per repo. These are provider recommendations, not a license to bypass rate limits. See `docs/13-SOURCES.md`.

## Portability invariant

A human with `git clone` and a JSON parser must be able to understand all essential CRM data without running the GitCRM application. The folder structure and record schema are a public contract.
