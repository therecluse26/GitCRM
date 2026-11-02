# Spec 14 - List Sort, Filters, and Columns

**Priority:** after the new record fields (docs/11, "Styling and CRM features", item 4)
**Depends on:** specs 02, 03, 08, 10, 12, 13

## User story

As a GitCRM user, I want to sort and filter a list by any field, and show my custom fields as columns, so that I can find a group of records, such as every contact from a referral, without a search.

## Owner decisions (2026-11-02)

- The lists: Contacts, Companies, and the Pipeline list. Tasks keep their groups by due date.
- Sort: a click on a column header. The "Sort by" menu goes away.
- Filters: an "Add filter" button adds a row of field, condition, and value. A record must match every row.
- Custom fields: in the filters, and as columns that the user turns on.

## Sort

- Each column header is a button. A click sorts by that column, A to Z. A click on the sorted column changes the direction.
- A to Z means: text A to Z, numbers low to high, dates old to new, a checkbox No before Yes.
- The sorted column has `aria-sort` and an arrow. Each other header has no arrow.
- Empty values come last, in both directions.
- Text sorts by what the cell shows, with case and accents ignored. An email or phone column shows the first value; a tags or contacts column shows all of them.
- A stage sorts in pipeline order, and an unknown stage comes last. A choice list sorts in the order of its options in Settings.
- Value sorts by the amount, whatever the currency: 1,000 USD and 1,000 EUR are equal.
- Ties go by name, then by ID, so the order is the same on every load. On the Pipeline list, ties go by expected close date (empty last), then by title, then by ID.
- Contacts and Companies start sorted by Name, A to Z. The Pipeline list starts sorted by Stage, A to Z; inside a stage, by expected close date (empty last), then by title. That is the order before this spec.
- The board does not sort. A board column keeps its order: expected close date, then title.

## Filters

- "Add filter" adds a row with Name, "contains", and an empty value. Focus moves to the row's field menu.
- The field menu has every field of the record type, also fields that have no column, and the active custom fields.
  - Contact: Name, Job title, Company, Email, Phone, Profiles, Address, Source, Tags, Updated.
  - Company: Name, Industry, Website, Phone, Address, Contacts, Tags, Updated.
  - Opportunity: Opportunity, Stage, Value, Company, Contacts, Expected close, Updated.
- The conditions depend on the kind of field:

| Kind | Fields | Conditions | Value |
| --- | --- | --- | --- |
| Text | Name, Opportunity, Job title, Company, Email, Phone, Profiles, Address, Source, Industry, Website, Tags, the contacts of an opportunity, and custom text and web address fields | contains, is, is empty, is not empty | a text input |
| Choice | Stage, and custom choice lists | is, is not, is empty, is not empty | a menu of the options |
| Number | Value, the contact count of a company, and custom numbers | is, at least, at most, is empty, is not empty | a number input |
| Date | Expected close, Updated, and custom dates | is, on or after, on or before, is empty, is not empty | a date input |
| Checkbox | custom checkboxes | is checked, is not checked | none |

- Text matches ignore case and accents, the same as search. For a field with more values, such as Email or Tags, one value must match.
- "Is empty" matches no value: no text, an empty list, or no address. A company with 0 contacts is not empty. A removed choice option reads as empty, as on the record page.
- Updated compares the date of the change on this device's clock.
- A row that needs a value and has none does not filter yet.
- A new field in a row resets its condition to the first one and clears the value.
- "Remove filter" takes the row away. Focus moves to "Add filter".
- Filters work with the search box, "Show archived", and the Pipeline "Show" menu. The count under the toolbar counts the records that match all of them.
- On the Pipeline, filters change the board and the list.
- Filters and the sort stay in memory with the search text, never in the page address (spec 08). A change starts the list at page 1. Disconnect clears them.
- A row for a custom field that Settings removes goes away.

## Columns

- "Columns" opens a list of the active custom fields of the record type, each with a checkbox. All are off at first.
- A custom column comes after the built-in columns, in the order of the fields in Settings. It sorts like any column.
- A cell shows the value as the record page does, but an empty value shows nothing, and an unchecked box shows nothing. A web address shows its host. A number is right-aligned.
- The column choice is stored on this device only while the connection is remembered, the same as the theme (spec 12). Disconnect removes it.
- With no active custom fields, there is no "Columns" button. On the Pipeline, "Columns" shows in the List view only.
- A cell shows nothing for a removed option or a value that does not fit its field, the same values that a filter reads as empty.
- A removed field has no column. When the user hides the sorted column, or Settings removes its field, the list goes back to its first sort.

## Accessibility

- A header button keeps the column name as its text. The arrow is `aria-hidden`.
- The filter rows are a group named "Filters". Each control has a name with its row number: "Filter 1 field", "Filter 1 condition", "Filter 1 value", "Remove filter 1".
- "Columns" is a native disclosure (`<details>`), and each field is a checkbox with its name.

## Out of scope

Saved views, "or" between filters, filters on Tasks and Search, a column choice for built-in fields, and a search box on the Pipeline.

## Acceptance criteria

```gherkin
Scenario: Sort by a column
  Given contacts "Ava" with the job title "Owner" and "Ben" with the job title "Buyer"
  When I select the "Job title" column header
  Then Ben comes before Ava, and the header has aria-sort "ascending"
  When I select it again
  Then Ava comes before Ben, and the header has aria-sort "descending"

Scenario: Empty values come last
  Given a contact with no job title
  When I sort by "Job title" in either direction
  Then that contact is the last row

Scenario: The Pipeline list sorts by value
  Given opportunities worth 500, 2,000, and none
  When I select the "Value" column header on the Pipeline list
  Then the order is 500, 2,000, then the one with no value

Scenario: Filter by a field without a column
  Given contacts with the sources "Referral" and "Event"
  When I add a filter "Source is referral"
  Then only the contact from a referral shows, and the count says "1 contact"

Scenario: Every filter must match
  Given filters "Tags contains vip" and "Job title is empty"
  Then only contacts with the tag vip and no job title show

Scenario: A filter with no value
  When I add a filter and enter no value
  Then every contact still shows

Scenario: Filter the board
  When I add a filter "Stage is not Lead" on the Pipeline
  Then the board has no Lead cards, and the list has no Lead rows

Scenario: Filter by a date
  Given opportunities that close on 2026-11-10 and 2026-12-10
  When I add a filter "Expected close on or before 2026-11-30"
  Then only the first one shows

Scenario: Filter by a custom field
  Given a contact field "Newsletter" of type Checkbox
  When I add a filter "Newsletter is checked"
  Then only the contacts with Newsletter checked show

Scenario: Remove a filter
  When I remove the only filter
  Then every contact shows, and focus is on "Add filter"

Scenario: Show a custom field as a column
  Given a company field "Employees" of type Number
  When I turn on "Employees" in "Columns"
  Then the Companies table has an "Employees" column after "Updated"
  And I can sort by it

Scenario: The column choice stays on a remembered device
  Given I turned on a column, and the connection is remembered
  When I load GitCRM again
  Then the column still shows

Scenario: Disconnect removes the column choice
  Given I turned on a column
  When I disconnect and connect again
  Then the column does not show

Scenario: A filter keeps the list at page 1
  Given I am on page 2 of Contacts
  When I add a filter value
  Then the list shows its first page
```

## Test gate

Unit tests for each kind of field: the value, the sort order with empty values, and each condition. Unit tests for the stored column choice. E2E: sort by a header, a filter on each list, the board filter, a custom column, and the accessibility checks on each page.
