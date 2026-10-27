# Spec 05 - Search and Export

**Priority:** MVP  
**Depends on:** complete validated in-memory workspace snapshot

## User stories

As a user, I want to find a record quickly using a search box and export all my current data without paying, requesting permission, or depending on a running CRM service.

## Search acceptance criteria

```gherkin
Scenario: Find a contact
  Given a fully loaded workspace with contacts and companies
  When I search for a contact name or email fragment
  Then matching contacts appear with identifying context
  And results come from local current-snapshot data

Scenario: Search across relationships
  Given an opportunity is linked to a company
  When I search for the company name
  Then the linked opportunity is discoverable by a supported filter/search

Scenario: Archived filtering
  Given a record is archived
  When I search without Archived enabled
  Then it is not included in normal search results

Scenario: Incomplete snapshot
  Given one record blob fails validation or download
  When I request a full export
  Then the export is blocked with a specific explanation
  And no incomplete archive is labeled a complete backup
```

## Export acceptance criteria

```gherkin
Scenario: Download lossless JSON snapshot
  Given a fully loaded, valid workspace
  When I select Export JSON snapshot
  Then a local ZIP is downloaded with config and every current JSON record
  And JSON bytes re-parse with the expected record counts

Scenario: Download CSV
  Given contacts, companies, opportunities, tasks, and activities exist
  When I select Export CSV
  Then I receive one CSV per entity type with stable headers
  And IDs preserve relationships between tables

Scenario: Formula-like string
  Given a contact name begins with an equals sign
  When I export spreadsheet-facing CSV
  Then the CSV escapes the formula-like prefix safely
  And the original unmodified value remains present in JSON export
```

## Implementation notes

Search can begin with simple in-memory normalization/filtering. Do not include a persistent database, hosted search service, or Git-history scans. Download generation is client-side. The ZIP is a **current snapshot**, not a `.git` history backup. Document CSV flattening rules in the generated dictionary.

## Test gate

Round-trip JSON and CSV; Unicode, quote, CRLF and long note cases; partial-load failure; no network request to a third-party export endpoint.
