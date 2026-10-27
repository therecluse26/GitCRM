# Data Model and Invariants

## General rules

- **JSON, UTF-8, pretty-printed, deterministic property ordering**, newline at EOF.
- One file per document. No arrays of all contacts/opportunities in a single file.
- `id` is an immutable RFC 4122 UUID v4 (from `crypto.randomUUID()`); never use names/emails as IDs or paths.
- `schemaVersion: 1`, `type`, `id`, `createdAt`, `updatedAt`, and `archivedAt` are common fields. Timestamps are UTC ISO 8601 strings; `archivedAt` is `null` when active.
- Unknown schema versions or malformed documents trigger a visible validation issue; do not silently discard them from exports.
- Optional references MUST refer to same-workspace IDs; dangling references are surfaced and cannot be created through UI.
- No HTML strings stored as rich text in MVP; activity bodies are plain text.
- Monetary values are integer minor units (e.g. cents), not binary floating-point currency.

## Workspace configuration

Path: `.gitcrm/workspace.json`

```json
{
  "schemaVersion": 1,
  "workspaceId": "f81d4fae-7dec-4c1d-ae0c-0d04ef1a7291",
  "name": "Example Studio",
  "defaultCurrency": "USD",
  "pipelineStages": [
    { "id": "lead", "label": "Lead", "position": 0 },
    { "id": "qualified", "label": "Qualified", "position": 1 },
    { "id": "proposal", "label": "Proposal", "position": 2 },
    { "id": "won", "label": "Won", "position": 3 },
    { "id": "lost", "label": "Lost", "position": 4 }
  ]
}
```

For MVP: stage IDs are predefined, labels configurable later. Exactly one `won` and one `lost` terminal stage. Workflow configuration itself is not an automation system.

## Contact

```json
{
  "schemaVersion": 1,
  "type": "contact",
  "id": "d13d0f69-0a4c-4192-9009-9e36a51c42c0",
  "name": "Ava Bennett",
  "emails": ["ava@example.test"],
  "phones": [],
  "companyId": "a28a8fb0-52c6-493d-9a11-99a4f0b8a6cf",
  "tags": ["referral"],
  "createdAt": "2026-10-26T16:00:00Z",
  "updatedAt": "2026-10-26T16:00:00Z",
  "archivedAt": null
}
```

`name` required; email format optional but validated when present. `companyId` optional/null. No password, secret, or sensitive custom fields.

## Company

```json
{
  "schemaVersion": 1,
  "type": "company",
  "id": "a28a8fb0-52c6-493d-9a11-99a4f0b8a6cf",
  "name": "Example Studio",
  "website": "https://example.test",
  "tags": [],
  "createdAt": "2026-10-26T16:00:00Z",
  "updatedAt": "2026-10-26T16:00:00Z",
  "archivedAt": null
}
```

`name` required, `website` nullable and validated as a URL when present.

## Opportunity

```json
{
  "schemaVersion": 1,
  "type": "opportunity",
  "id": "e8c756c7-f1b2-4c47-9d3d-26457c6b0979",
  "title": "Website rebuild",
  "stageId": "proposal",
  "companyId": "a28a8fb0-52c6-493d-9a11-99a4f0b8a6cf",
  "contactIds": ["d13d0f69-0a4c-4192-9009-9e36a51c42c0"],
  "valueMinor": 250000,
  "currency": "USD",
  "expectedCloseDate": "2026-11-30",
  "createdAt": "2026-10-26T16:00:00Z",
  "updatedAt": "2026-10-26T16:00:00Z",
  "archivedAt": null
}
```

`title` and valid `stageId` required; `companyId` nullable; `contactIds` possibly empty. `valueMinor` nullable nonnegative integer; dates ISO `YYYY-MM-DD` (local calendar intent, not UTC instant). CRM can show won/lost based on `stageId`; no second conflicting status field.

## Task

```json
{
  "schemaVersion": 1,
  "type": "task",
  "id": "9b8b4d79-75d6-450c-a492-1e0638d49cd8",
  "title": "Follow up on proposal",
  "description": "Ask about next steps",
  "dueDate": "2026-11-02",
  "completedAt": null,
  "related": { "type": "opportunity", "id": "e8c756c7-f1b2-4c47-9d3d-26457c6b0979" },
  "createdAt": "2026-10-26T16:00:00Z",
  "updatedAt": "2026-10-26T16:00:00Z",
  "archivedAt": null
}
```

`related` may be null. Task completion is manual; due dates are displayed, not scheduled in the background.

## Activity

```json
{
  "schemaVersion": 1,
  "type": "activity",
  "id": "bf80abe2-aeda-4aec-8fc4-75f44e55d04b",
  "kind": "note",
  "body": "Discussed timeline and budget.",
  "occurredAt": "2026-10-26T16:15:00Z",
  "related": { "type": "contact", "id": "d13d0f69-0a4c-4192-9009-9e36a51c42c0" },
  "createdAt": "2026-10-26T16:16:00Z",
  "updatedAt": "2026-10-26T16:16:00Z",
  "archivedAt": null
}
```

Allowed `kind` values: `note`, `call`, `meeting`, `email_manual`. Activity is **manual documentation**, not automated email capture. Each item gets its own document so a record can be targeted by a future purge tool.

## Schema evolution

Any change to persisted shape MUST include versioned schema validation, migration tests, and an export compatibility statement. `schemaVersion` is required per record and in workspace config; unknown newer versions should open in read-only/error mode, not be rewritten by older clients.
