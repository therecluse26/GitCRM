# Spec 05 - Search and Export

**Priority:** MVP  
**Depends on:** complete validated in-memory workspace snapshot

## User stories

As a user, I want to find a record quickly using a search box and export all my current data without paying, requesting permission, or depending on a running CRM service.

## Search rules

The Search page searches the current records in browser memory (docs/06). It finds each record type by these fields:

| Record type | Found by |
| --- | --- |
| Contact | name, email, phone, tag, company name |
| Company | name, website, tag |
| Opportunity | title, stage name, company name, contact names, amount as shown ("$12,000.00") or as typed ("12000") |
| Task | title, description, the name of its related record |
| Activity | what happened, the name of its related record |

- Every word of the search must appear in the record. The words can match different fields: "ava northwind" finds Ava Bennett at Northwind Traders.
- Case and accents do not matter: "zoe" finds "Zoë".
- Results update as the user types.
- Results come in groups, in this order: Contacts, Companies, Opportunities, Tasks, Activities. A group sorts by name or title, A to Z. Activities come latest first.
- With "All types", each group shows its first 10 results. "Show all" chooses that record type, which shows every result of the type.
- A task shows as it does in other task lists, with its checkbox. Activities have no page of their own, so an activity shows in full, with Edit and Archive, as on a record page.

## Search acceptance criteria

```gherkin
Scenario: Find a contact
  Given a fully loaded workspace with contacts and companies
  When I search for a contact name or email fragment
  Then the contact appears under "Contacts", with its company and first email
  And no request goes to GitHub or another server

Scenario: Search across relationships
  Given the opportunity "Website rebuild" is linked to the company "Northwind Traders"
  When I search for "northwind"
  Then "Northwind Traders" appears under "Companies"
  And "Website rebuild" appears under "Opportunities"

Scenario: Filter by record type
  Given a search that finds a company and an opportunity
  When I choose "Opportunities" as the record type
  Then only the opportunity appears

Scenario: Many results
  Given 12 contacts match the search
  When the record type is "All types"
  Then "Contacts" shows the first 10, and says "Showing 10 of 12 contacts."
  When I select "Show all 12 contacts"
  Then the record type is "Contacts", and all 12 appear
  And focus moves to the "Contacts" heading

Scenario: Archived filtering
  Given a record is archived
  When I search without Archived enabled
  Then it is not included in normal search results
  And the page says "1 archived record hidden."
  When I check "Show archived"
  Then it appears with an "Archived" badge

Scenario: An empty search
  When the search box is empty
  Then no results appear
  And the page says what I can search for

Scenario: Results follow a save
  Given I searched for "ava"
  When I rename Ava Bennett to "Ava Lopez" and go back to Search
  Then the result shows "Ava Lopez"

Scenario: The search stays on this device
  When I type a search
  Then the page address stays "#/search"
  And the search is still there when I open a result and go back
  When I disconnect
  Then the search is cleared
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

Scenario: Incomplete snapshot
  Given one record blob fails validation or download
  When I request a full export
  Then the export is blocked with a specific explanation
  And no incomplete archive is labeled a complete backup
```

## Implementation notes

Search can begin with simple in-memory normalization/filtering. Do not include a persistent database, hosted search service, or Git-history scans. Download generation is client-side. The ZIP is a **current snapshot**, not a `.git` history backup. Document CSV flattening rules in the generated dictionary.

Search notes:

- The search text stays in memory. It is never in the page address (docs/07), and Disconnect clears it.
- No search package (docs/06). The search text of each record is built once per snapshot, and each keystroke filters it.
- The first 10 per group keep typing fast. At 2,000 records, drawing every result of a one-letter search took 0.7 s per keystroke. With the limit, it took 47 ms at most (docs/06).
- Out of scope: a keyboard shortcut to Search, a search box on every page, matching with typos, ranking by relevance, and searching Git history.

## Test gate

Round-trip JSON and CSV; Unicode, quote, CRLF and long note cases; partial-load failure; no network request to a third-party export endpoint.
