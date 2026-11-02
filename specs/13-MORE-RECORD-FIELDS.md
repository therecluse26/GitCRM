# Spec 13 - More Contact and Company Fields

**Priority:** after the visual style (docs/11, "Styling and CRM features", item 3)
**Depends on:** spec 02, `docs/02-DATA-MODEL.md`, ADR-028

## User story

As a GitCRM user, I want the common contact and company details as built-in fields, so that I do not have to define custom fields for what every CRM has.

## The fields

The owner chose the fields on 2026-11-02.

Contact:

- **Job title** (`jobTitle`): text, or null.
- **Profiles** (`profiles`): web addresses, a list, such as a LinkedIn profile. Each is an `http` or `https` URL, the same rule as a company website. A typed address with no scheme gets `https://`.
- **Address** (`address`): Street, City, Region, Postal code, and Country, or null.
- **Source** (`source`): how the user met the contact, such as Referral or Event. Text, or null.

Company:

- **Industry** (`industry`): text, or null.
- **Phone numbers** (`phones`): a list, the same as a contact's.
- **Address** (`address`): the same as a contact's.

Rules:

- Text must not be blank. The form trims it, and an empty input stores null.
- An address is an object with all five parts. An empty part is null. An address with no part is null, not an object.
- Street is a box with more than one line. The other parts are one-line inputs.
- Source and Industry suggest the values that other records already use, so the same value is typed the same way. Any value is allowed.
- A suggestion shows once, whatever its case. When records spell it differently, the most used spelling shows; a tie goes to the first in code point order, so the list is the same on every load.

## Record format

The new fields take contact and company files to `schemaVersion` 2 (ADR-028).

- A contact or company file is version 2 when one of its new fields has a value. A version 2 file has every field, new and old.
- A file whose new fields are all empty stays at version 1, with the version 1 fields only. So a workspace that never uses the new fields still opens in an older GitCRM.
- GitCRM reads both versions. A version 1 file reads as a record whose new fields are empty.
- An older GitCRM shows a version 2 file as "unsupported version" and never writes it.
- Opportunities, tasks, and activities stay at version 1.
- The export says both versions in `DATA-DICTIONARY.md`, and `schemas/` accepts both.

## In scope

- The fields in the contact and company forms, on the record pages, in search, and in both exports.
- The Contacts table gets a Job title column after Name. The Companies table gets an Industry column after Name.
- A profile shows as a link that opens in a new tab. A company phone shows as a `tel:` link, the same as a contact phone.
- A conflict compares the address as one field.
- Out of scope: sort and filter by these fields (docs/11, item 4), and an address check or lookup.

## Acceptance criteria

```gherkin
Scenario: Save the new contact fields
  Given I am connected to a writable workspace
  When I save a contact "Ava Bennett" with the job title "Head of Operations", the profile "linkedin.com/in/ava", the city "Portland", the country "USA", and the source "Referral"
  Then her file has schemaVersion 2
  And it stores the profile "https://linkedin.com/in/ava"
  And it stores the address with the street, region, and postal code null
  And her page shows each value, and the profile opens in a new tab

Scenario: A contact without the new fields stays at version 1
  Given I am connected to a writable workspace
  When I save a contact with only a name and an email
  Then the file has schemaVersion 1, and none of the new fields

Scenario: Clearing the new fields returns the file to version 1
  Given a contact whose only new field is the job title
  When I clear the job title and save
  Then the file has schemaVersion 1, and none of the new fields

Scenario: Version 1 files still load
  Given a workspace with contact and company files at schemaVersion 1
  When GitCRM loads it
  Then every record shows, with no file issue

Scenario: A bad profile
  When I enter the profile "javascript:alert(1)"
  Then I see a field error and cannot save

Scenario: A newer version
  Given a contact file at schemaVersion 3
  Then Settings lists it as "unsupported version", and GitCRM does not write it

Scenario: Save the new company fields
  When I save a company "Acme Corp" with the industry "Manufacturing", a phone, and the city "Portland"
  Then its file has schemaVersion 2
  And its page shows the industry, the phone as a link, and the address
  And the Companies table shows "Manufacturing" in the Industry column

Scenario: Suggestions from used values
  Given contacts with the sources "Referral" and "Event"
  When I edit the Source of another contact
  Then the input suggests "Event" and "Referral"

Scenario: Search finds the new fields
  When I search for "Operations"
  Then Ava Bennett is in the results

Scenario: Export
  When I export the CSV
  Then contacts.csv has the columns jobTitle, profiles, addressStreet, addressCity, addressRegion, addressPostalCode, addressCountry, and source
  And companies.csv has the columns industry, phones, and the five address columns
  And DATA-DICTIONARY.md says record files are version 1 or 2
```

## Test gate

Schema tests for both versions, the version rule, and the upgrade of a version 1 file. Form tests for each new field. Export tests for the CSV columns, the data dictionary, and the schemas. E2E: save, show, search, and the version on GitHub.
