# Spec 01 - Connect Private Repository

**Priority:** P0 + MVP  
**Depends on:** `docs/05-AUTH-AND-ONBOARDING.md`, `docs/04-GITHUB-INTEGRATION.md`

## User story

As a GitHub user, I want GitCRM to connect only to a private repository that I control, so that I can use the CRM without deploying an application backend or database.

## Required behavior

- The connection flow accepts a **fine-grained, repository-restricted PAT** and keeps it in browser storage until Disconnect, unless the user unchecks "Remember on this device" (ADR-017).
- The app checks the authenticated GitHub identity and selected repository metadata.
- A repository must have `private = true`, be accessible with Contents read/write, and have a compatible writable `main` branch.
- If `.gitcrm/workspace.json` is missing, offer explicit initialization. If present, validate schema version and do not overwrite it.
- Connected status shows owner/repo and a Disconnect control, but not the token value.

## Acceptance criteria

```gherkin
Scenario: Initialize a new private repository
  Given I have authorized access to a private repo with a writable main branch
  And it has no GitCRM workspace config
  When I choose Initialize and give a workspace name
  Then exactly one workspace config is committed to main
  And the app opens an empty CRM

Scenario: Open an existing workspace
  Given the selected private repo has a valid workspace config
  When I connect
  Then the existing records load without a new initialization commit

Scenario: Reject a public repository
  Given the selected repo is public
  When I attempt to connect or initialize
  Then access is refused with a privacy warning
  And no CRM data is written

Scenario: Missing write permission
  Given my token has Contents read only
  When I connect
  Then I see a clear read-only or incompatible-permission message
  And I cannot use an enabled Save control

Scenario: Disconnect
  Given I am connected and records are visible
  When I disconnect
  Then the app deletes the stored token and the record cache
  And protected data is no longer displayed

Scenario: Reload with a remembered token
  Given I connected with "Remember on this device" checked
  And main has not changed since my last load
  When I reload the page
  Then I am connected without entering the PAT
  And no record blobs are downloaded
```

## Failure cases

Expired/revoked token, GitHub 403/404, protected branch, repository rename, invalid schema, GitHub outage, and user cancel. No infinite retry and no hidden fallback to public repository access.

## Test gate

Run mocked API contract tests and a manual smoke test against a disposable private GitHub repo. Never store real token in test fixtures. Public release remains gated on documented production auth decision.
