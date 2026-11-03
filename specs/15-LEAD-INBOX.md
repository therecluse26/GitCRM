# Spec 15 - Lead Form and Lead Inbox

**Priority:** after list sort and filter (docs/11, "Styling and CRM features", item 5)
**Depends on:** specs 02, 03, 06, 08, 09, 12, ADR-029 (proposed), spike S-10

## User story

As a GitCRM user, I want visitors to send me a message through a form, and to review each message in GitCRM, so that a new lead becomes a contact without me typing it.

## Words

- **Lead:** one entry that a visitor sent through the lead form.
- **Lead inbox:** the service that holds leads until GitCRM takes them. The first one is Formcarry.
- **Adapter:** the code for one lead inbox. Another inbox, such as an owner's own relay, is another adapter with the same interface.

## Owner decisions (2026-11-02 and 2026-11-03)

- A browser cannot write to a private repository without a token, so leads wait in a form service (ADR-004 stays: no GitCRM server).
- The first service is Formcarry, on its Free plan ($0). S-10 checked the Free plan: list and delete work. The code sits behind an adapter interface, so a relay can come later.
- Visitors reach the form in two ways: a page on the owner's GitCRM site, and an HTML snippet for the owner's own website.
- Each lead waits for review. The owner chooses "Add as contact" or "Discard".
- "Add as contact" makes a contact and a note. It makes no opportunity.

## The adapter interface

```ts
type Lead = { id: string; receivedAt: string; fields: { key: string; value: string }[] };

interface LeadInbox {
  // The key is valid, can read the form, and can delete its leads.
  check(): Promise<void>;
  // New leads, oldest first, without spam. `unreadable` counts the leads the adapter skipped, and
  // `more` is true when the service holds more leads than one check reads.
  list(): Promise<{ leads: Lead[]; unreadable: number; more: boolean }>;
  // Deletes the lead from the service. It cannot be undone.
  remove(lead: Lead): Promise<void>;
}
```

- Every failure is an `InboxError` with a kind: `key`, `scope`, `form`, `plan`, `rate-limit` (with the seconds to wait), `network`, or `service`. The page shows one sentence for each kind.
- No automatic retry. The owner selects "Check for leads" again.
- A lead that the adapter cannot read is skipped and counted: "1 lead could not be read. It stays in Formcarry." A lead marked as spam is not listed, and stays in Formcarry.

### The Formcarry adapter

- Base URL `https://api.formcarry.com/v1`. The key is a Bearer token.
- `check`: `GET /me` must list `submissions:read` and `submissions:write` in `scopes`. Then `GET /forms/{form}/submissions?limit=1` must answer.
- `list`: `GET /forms/{form}/submissions?status=inbox&order=oldest&limit=100`, with `cursor` from `next_cursor` while `has_more` is true. At most 5 pages, so 500 leads. If more exist, `more` is true and the page says so.
- `remove`: `DELETE /forms/{form}/submissions/{id}`. The answer `deleted: true` counts as done.
- Formcarry's error body is `{ error: { type, code, message } }`. Codes: `invalid_key` and `missing_bearer` are `key`; `insufficient_scope` is `scope`; `form_access_restricted` and `form_not_found` are `form`; `plan_restricted` is `plan`; HTTP 429 is `rate-limit` with `Retry-After`.
- The adapter reads each lead with a schema. `created_at` becomes a UTC timestamp. `ip`, `country`, `user_agent`, `referer`, and `attachments` are dropped when it reads the lead.
- The key goes only to `api.formcarry.com`. The GitHub token never goes there.

## Settings: Lead form

- A card in Settings. Without a setup, it shows the steps:
  1. Make a Formcarry account (the Free plan needs no card) and one form.
  2. Make an API key with the scopes `submissions:read` and `submissions:write`, limited to that form.
  3. Enter the form ID and the key here.
- Fields: Form ID, API key (a password field, `autocomplete="off"`). "Save and check" runs `check`. A failure shows its sentence and saves nothing.
- After a good check, the card shows:
  - the link to the form page: `<this site>/lead.html#form=<form ID>`;
  - the HTML snippet, with a "Copy snippet" button;
  - "Remove lead form", which clears the setup from this device and changes nothing on Formcarry.
- A note says that Formcarry may delete leads after a time that the form's retention setting gives, so the owner should add or discard leads in time.
- The setup is stored on this device only while the connection is remembered, the same rule as the theme and the columns (spec 12). Disconnect removes it, from the browser and from memory. GitCRM loads a stored setup only when a saved connection exists. The key is never in the page address, in a log, or in a message to GitHub.

## Leads page

- A "Leads" tab appears in the main navigation, after Pipeline, only when a lead form is set up on this device. The route is `#/leads`. Without a setup, that address shows "No lead form is set up on this device" and a link to Settings.
- The page checks Formcarry when it opens and when the owner selects "Check for leads". It never checks by itself in the background (ADR-006).
- A table with Received (local time), From (the name, else the email), Email, Phone, and Message (the first 120 characters), and two buttons per row: "Add as contact" and "Discard".
  - The visible words stay short, and a screen reader hears the lead too: "Add as contact for Ava Bennett", "Discard lead from Ava Bennett", "Confirm discard for Ava Bennett".
  - "Discard" asks first: "Confirm discard" and "Cancel". Focus moves to "Confirm discard"; "Cancel" returns it to "Discard". It deletes the lead from Formcarry for good. After a discard, focus moves to "Check for leads".
- States: checking, loaded, empty ("No new leads."), failed (one sentence and "Check for leads"). A status line says how many leads show, how many could not be read, and "Showing the oldest 500" when `more` is true.
- With a read-only GitHub token, "Add as contact" is disabled with the standard read-only message. "Discard" still works.

## Add as contact

1. The contact:
   - Name: the field `name`; if blank, the email; if blank, "New lead".
   - Email: the field `email`, when it is a valid address. Phone: the field `phone`.
   - Source: "Lead form". No company, no tags. Because Source is a record version 2 field (ADR-028), a contact from a lead is a version 2 file: an older copy of GitCRM cannot read it (R-14, R-16).
2. The note (kind `note`, related to the contact):
   - `occurredAt` is the time the lead arrived.
   - The body is the field `message`. Then a blank line, and one line "Label: value" for every other field the form sent, such as a company name, in the order they came. An email that was not valid stays here.
   - With no message and no other field, the body is "Lead form entry with no message."
3. Field keys match without case: `Name` and `name` are the same.
4. IDs: the contact ID and the note ID come from a SHA-256 hash of the service, the form ID, the lead ID, and the word `contact` or `note`, written as a version 4 UUID. A second try for the same lead makes the same IDs.
5. Order: save the contact, save the note, then `remove` the lead from Formcarry. Each save is one commit (spec 06).
6. A record that already exists with the same ID counts as saved: GitCRM checks its snapshot first, and a save that meets the same record on GitHub counts as done. So a second try after a partial failure does not make a second contact.
7. Row states: adding, added (the row stays, with a link to the contact, until the next check for leads), and failed (one sentence, the lead stays, the buttons return). A discarded row goes at once.
   - If the contact is saved and the note fails, the row says "Contact added, note not saved." and the reason, such as "GitHub had an error. Try again later."
   - If both records are saved and `remove` fails, the row says "Added. Formcarry still has this lead." and the reason. The next try only removes the lead: GitCRM sees both records in its snapshot and saves nothing again.
8. Not copied into the contact or the note: IP address, country, browser, referring page, and attachments.

## The form page

- `lead.html`, in the same build, at `<this site>/lead.html#form=<form ID>`. The form ID must match `[A-Za-z0-9_-]{4,64}`; otherwise the page says "This form link is not valid." and shows no form.
- Fields: Name (required), Email (required, valid), Phone, Message. A hidden honeypot field `_gotcha` that stays empty (Formcarry marks a lead that fills it as spam).
- A visitor sends the form with a `fetch` POST of the form data to `https://formcarry.com/s/<form ID>` with `Accept: application/json`.
  - Success: "Thank you. We received your message." Focus moves to this message. The form clears.
  - Failure: one sentence, and the entries stay in the fields.
- The page names where the answers go, in small text under the form: "Sent through Formcarry, form <form ID>." A visitor can see that a crafted link points to another form (R-16).
- The page uses no storage, no cookies, and no GitCRM code. It follows the visitor's light or dark setting. It passes the accessibility checks in both.
- The page has its own Content Security Policy (ADR-029): scripts and styles from `self`; `connect-src https://formcarry.com`; no frames, no other site.

## The snippet

```html
<form action="https://formcarry.com/s/FORM_ID" method="post" accept-charset="UTF-8">
  <label>Name <input type="text" name="name" required></label>
  <label>Email <input type="email" name="email" required></label>
  <label>Phone <input type="tel" name="phone"></label>
  <label>Message <textarea name="message"></textarea></label>
  <input type="text" name="_gotcha" style="display:none" tabindex="-1" autocomplete="off">
  <button type="submit">Send</button>
</form>
```

The owner sets the thank-you page in Formcarry. The snippet needs no script and no CORS.

## Security

- The app's `connect-src` becomes `https://api.github.com https://api.formcarry.com`. The build audit checks this exact value, and checks the form page's policy too.
- The audit fails the build if the form page's bundle names `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, or `api.github.com`.
- Tests prove that no GitHub request carries the Formcarry key, and no Formcarry request carries the GitHub token.
- The form ID is public, because it is in the link and in the snippet. The key is the secret.
- A link can point to any Formcarry form (R-16). The page cannot tell whose form it is.

## Accessibility

- The Leads table has a caption name "Leads". Buttons name the lead. A status line announces counts and results (`role="status"`).
- The form page labels every field, marks required fields, and moves focus to the result message. Errors are text, not only colour.

## Out of scope

Other adapters (an own relay comes later); checking for leads in the background; opportunities from a lead; finding a contact with the same email; file uploads; changing the form's fields or its look; more than one form; moving leads between the Formcarry inbox and spam.

## Acceptance criteria

```gherkin
Scenario: Set up the lead form
  Given a connected workspace
  When I enter a form ID and a key in Settings, "Lead form", and select "Save and check"
  Then the card shows the link to the form page and the snippet
  And the main navigation has a "Leads" tab

Scenario: A key that cannot delete
  Given a key with only the scope "submissions:read"
  When I select "Save and check"
  Then the card says which scopes the key needs
  And nothing is saved

Scenario: See new leads
  Given Formcarry holds two leads, one marked as spam
  When I open the Leads page
  Then the table shows the one lead that is not spam

Scenario: Add a lead as a contact
  Given a lead from "Ava Bennett" with an email, a phone, a company, and a message
  When I select "Add as contact for Ava Bennett"
  Then a contact "Ava Bennett" exists with Source "Lead form"
  And a note on that contact has the message and the line "Company: Northwind"
  And the lead is gone from Formcarry
  And the row says "Added" with a link to the contact, until the next check for leads

Scenario: A lead with no name
  Given a lead with only an email
  When I add it
  Then the contact is named by the email

Scenario: A second try does not make a second contact
  Given the note fails to save the first time
  When I select "Add as contact for Ava Bennett" again
  Then the workspace has one contact for the lead, one note, and no lead on Formcarry

Scenario: Discard a lead
  When I select "Discard lead from Ava Bennett" and "Confirm discard for Ava Bennett"
  Then the lead is gone from Formcarry
  And no contact exists

Scenario: Nothing is checked in the background
  Given the Leads page is not open
  Then no request goes to Formcarry

Scenario: Formcarry asks me to wait
  Given Formcarry answers 429 with Retry-After 30
  When I check for leads
  Then the page says to wait 30 seconds
  And the page sends no second request by itself

Scenario: The key stays on a remembered device
  Given the connection is remembered
  When I load GitCRM again
  Then the "Leads" tab still shows

Scenario: Disconnect removes the setup
  When I disconnect and connect again
  Then the "Leads" tab does not show, and the browser holds no lead setting

Scenario: The key goes only to Formcarry
  Then no request to api.github.com carries the key
  And no request to Formcarry carries the GitHub token

Scenario: A visitor sends the form
  Given the link "lead.html#form=exampleForm1"
  When a visitor enters a name and an email and selects "Send"
  Then Formcarry receives the fields name and email
  And the page says "Thank you. We received your message."
  And the page says "Sent through Formcarry, form exampleForm1."

Scenario: A bad form link
  Given the link "lead.html#form=%3Cscript%3E"
  Then the page says "This form link is not valid." and shows no form

Scenario: The honeypot
  Given a bot fills the hidden field
  Then the field is sent as filled, and Formcarry marks the lead as spam
```

## Test gate

Unit tests: the Formcarry adapter against a fake Formcarry (pages, the 500 cap, every error kind, the schema, no extra fields kept); lead to contact and note (the name rules, the email check, the extra lines, the empty message, the IDs); the stored setup. Build audit tests for both policies. E2E: set up, add, discard, the retry after a partial failure, the 429, remembered and forgotten, the two secrets that stay apart, the form page (send, bad link, honeypot), and accessibility on the Leads page, the Settings card, and the form page in both themes.
