# Spec 07 - Tiny-Team Collaboration and Conflicts

**Priority:** MVP

## Goal

Support a handful of collaborators on the same private repository without silently losing edits. Do not introduce a realtime service, event bus, locks server, or CRM-specific RBAC system.

## Model

- Every collaborator uses their own GitHub-authorized identity/credentials.
- Repository access is governed by GitHub permissions.
- Writes target `main` with expected old blob SHA for updates/deletes.
- Cache tracks current blob SHA and commit/tree SHA.
- If another user modifies **the same record**, local edits require explicit resolution.
- If users modify different records, serialize and retry safely only as permitted by API semantics; avoid blindly repeating a mutation after an ambiguous network response.

## Acceptance criteria

```gherkin
Scenario: Edit distinct documents
  Given two collaborators have a valid snapshot
  When one edits contact A and another edits opportunity B
  Then both saves can eventually succeed without an app server
  And neither document is overwritten by the unrelated change

Scenario: Edit same document
  Given two collaborators load the same contact SHA
  When collaborator A saves first
  And collaborator B submits a different edit against the old SHA
  Then B is told there is a conflict
  And B can compare their unsaved changes with the latest remote record
  And B must explicitly resolve before a new save

Scenario: Offline save attempt
  Given network access is lost
  When I click Save
  Then the app does not claim the save succeeded
  And the unsaved form remains available in current browser memory

Scenario: Ambiguous network failure
  Given a write request may have reached GitHub but the response is lost
  When the app reconnects
  Then it reads the target document before deciding whether to retry
  And it never creates an unintended duplicate record

Scenario: Repository permission revoked
  Given I lost permission since loading the app
  When I try to save
  Then the operation fails with a clear permission message
  And no alternative credential is silently used
```

## Conflict UI requirements

Show the record type/name, remote updated value, local unsaved value, and actions: Discard mine, Copy mine, and Retry after review. A full three-way text merge tool is unnecessary initially. Preserve edited form values until resolved or the user explicitly discards.

## Limits

This is **low-volume optimistic concurrency**, not realtime collaboration. No live cursors, locks, presence, instant feeds, or cross-repository merges. If a team's operational requirements exceed this model, recommend migration rather than introducing a server.
