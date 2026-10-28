# UI and UX Specification

## Experience

Professional, minimal, and fast. Users should see CRM concepts, not Git internals. The UI must not require entering raw JSON. GitHub connectivity is setup and diagnostics, not the main user experience.

## Navigation

Primary: Home, Contacts, Companies, Pipeline, Tasks, Search, Settings. A unified record view includes tabs/sections for details, linked records, activities, and related tasks.

## Screen behaviors

### Home

- Counts for active contacts/companies/opportunities.
- Open opportunities by stage (compact summary, no advanced forecasting).
- Due/overdue tasks and recent manual activity.
- Connection status and refresh affordance.

### Contacts and companies

- Searchable sortable list, create/edit form, detail view.
- Contact may belong to a company; company detail shows associated contacts/opportunities.
- A notes/activity timeline, adding each note as a new activity record.

### Opportunities

- Kanban columns from workspace pipeline config; drag/drop and accessible menu/button move.
- Opportunity card shows title, linked company/contact, amount when present.
- Detail form edits stage, amount, expected close date, relations.
- Terminal stages visually distinct; no automatic downstream workflow.

### Tasks

- List grouped by overdue, upcoming, complete.
- Manual create/edit/complete and related entity linking.
- Date-aware visibility when the UI is open; no background reminders promised.

### Search

- Search across all loaded current records with entity-type filter.
- Keyboard-accessible results; never show archived records unless requested.

### Settings

- Workspace name, connected GitHub repo, private status, connection health.
- Export complete snapshot / CSV.
- Disconnect and token safety guidance.
- Pipeline stage editor: rename, reorder, add, and remove-when-unused; Won and Lost always present (ADR-019).

## Important system states

| State | UX requirement |
| --- | --- |
| No repo | Explain connection steps and privacy requirement |
| Loading | Progress, cancellation affordance where possible |
| Unsaved form | Clearly identify unsaved edits and warn before navigation |
| Saving | Disable duplicate submit; optimistic visual changes only with rollback |
| Committed | Show quiet success and optionally a GitHub commit link |
| Conflict | Show local vs current remote values; user decides retry/discard/merge |
| Rate limited | Explain delay; retain user changes |
| Invalid record | Explicit diagnostic, no silent omission from exported dataset |
| Disconnected | Clear loaded private data from UI, require reconnect |

## Accessibility

- All actions available with keyboard; accessible drag/drop alternative.
- Label inputs and validation errors; focus management on dialogs.
- Sufficient contrast; honor reduced motion; avoid color-only stage cues.
- Provide a list view alternative to Kanban for keyboard users and narrow screens.

## Copywriting tone

- "Save contact" not "Commit blob".
- "Your data is stored in a private GitHub repository" in onboarding.
- "Delete removes this record from current data; previous Git versions remain" in delete confirmation. The dialog also lists every related task and activity it deletes and every record it unlinks (ADR-021).
- Avoid exaggerated privacy, compliance, or guaranteed-free marketing claims.
