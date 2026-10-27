# Spec 02 - Contacts and Companies

**Priority:** MVP  
**Depends on:** `docs/02-DATA-MODEL.md`, `docs/03-REPOSITORY-LAYOUT.md`

## User stories

As a solo consultant, I want to maintain contacts and companies, with lightweight relationships and notes, so that I remember whom I work with without administrative overhead.

## In scope

- Contacts: create, view, edit name/email(s)/phone(s)/tags/company association, archive, unarchive, and safe current-snapshot deletion.
- Companies: create, view, edit name/website/tags, archive, unarchive, and safe deletion.
- Detail views show related records and recent manual activities.
- List views support filters, search, and sensible sort (name, recently updated).
- No custom fields, deduplication engine, enrichment, or email integration.

## Acceptance criteria

```gherkin
Scenario: Create a contact
  Given I am connected to a writable private workspace
  When I save a contact named "Ava Bennett" with an email address
  Then a new UUID-named JSON document exists under data/contacts/<shard>/
  And the document validates against schema version 1
  And the contact appears after a fresh reload

Scenario: Associate a company
  Given a company exists
  When I assign that company to a contact
  Then the contact stores the company UUID
  And the company detail lists the contact

Scenario: Edit contact
  Given I load a contact at a known Git blob SHA
  When I update the email and save
  Then the update commit uses the expected blob SHA
  And no unrelated contact file changes

Scenario: Invalid email
  When I enter a malformed nonempty email
  Then I see a field error and cannot save

Scenario: Archived contact
  Given a contact is archived
  When I visit the standard contacts list
  Then it is hidden until Archived is enabled
  And it can be restored without changing its UUID
```

## Notes

Duplicate contacts are allowed for MVP. Warn on exact duplicate email if trivial, but do not silently merge. A company delete is blocked while active contacts or opportunities reference it unless the user explicitly detaches those references first. Note entry creates a separate Activity document, not a growing notes array on the contact file.

## Test gate

Domain validation tests; mock GitHub adapter; E2E create/edit/association/archival; verify that contact and company exports preserve their relationships.
