# Spec 03 - Opportunities and Pipeline

**Priority:** MVP

## User story

As a solo founder, I want to track opportunities across a small set of stages and see what needs attention without a sophisticated sales platform.

## In scope

- Create opportunity: title (required), stage, amount (optional), currency, expected close date, associated company, associated contacts.
- Show a Kanban board and an accessible list-view alternative.
- Move between configured stages; changes persist as a record commit.
- Defaults: Lead, Qualified, Proposal, Won, Lost.
- Show active pipeline (excluding Won/Lost by default when user chooses Open filter) and optional archived items.
- No complex forecast probabilities, tax calculation, product catalog, or quote generation.

## Acceptance criteria

```gherkin
Scenario: Create opportunity
  Given workspace stages are valid
  When I create "Website rebuild" in Proposal with value $2500.00 USD
  Then its document stores stageId "proposal" and valueMinor 250000
  And it appears in the Proposal column

Scenario: Move stage
  Given an opportunity is in Lead
  When I move it to Qualified
  Then exactly that opportunity's document is updated in main
  And its new stage persists after refresh

Scenario: Move via keyboard
  Given I cannot use drag and drop
  When I use the opportunity's Move to stage menu
  Then I can select an allowed stage without a mouse

Scenario: Missing relation
  Given I select a contact UUID that is not in the workspace
  When I try to save
  Then the association is rejected with a clear validation message

Scenario: Financial values
  When I enter a value with decimal currency units
  Then the app converts to integer minor units using currency-aware rules
  And preserves exact value through save and export
```

## Error handling

Invalid pipeline stage, stale record SHA, rate limit, and outdated company/contact relations cannot silently mutate data. Keep unsaved stage movement visible as pending until committed; restore the previous position on failure.

## Test gate

Money conversion edge cases, negative values rejected, stage membership checks, drag + keyboard paths, concurrent stage edit conflicts.
