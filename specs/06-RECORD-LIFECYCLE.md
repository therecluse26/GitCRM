# Spec 06 - Archive, Delete, Restore, and Future Purge

**Priority:** Archive and current-snapshot delete in MVP; full history purge explicitly later.

## User stories

As a user, I want records to stop cluttering the active workspace. If I decide to remove one, I want the product to clearly distinguish deleting it from the current state versus permanently erasing its historical content.

## MVP lifecycle

- **Archive:** set `archivedAt` to UTC timestamp; retain same file and UUID; default lists hide it.
- **Restore from archive:** set `archivedAt` to `null` using SHA-aware update.
- **Delete from current state:** remove the single file using GitHub Contents API `DELETE` and its expected SHA. Show the exact warning that historical commits may still contain it.
- **Undo current-state delete:** not an instantaneous transactional undo. Restore by retrieving a historical file version through Git history (explicit manual/advanced future feature). A newly created replacement must not accidentally reuse a deleted ID without deliberate restoration.
- **Inbound relations:** block current-state delete of a record with existing active linked records unless those relations are explicitly cleared first.

## Acceptance criteria

```gherkin
Scenario: Archive and restore
  Given an active company
  When I archive it
  Then the file remains with archivedAt set
  And the company leaves default lists
  When I restore it
  Then archivedAt is null and its UUID is unchanged

Scenario: Delete from current snapshot
  Given an unreferenced contact
  When I confirm Delete
  Then the contact's JSON file is removed from main by a commit
  And the dialog previously warned that old Git commits are not erased

Scenario: Prevent broken references
  Given an opportunity links to a company
  When I try deleting the company
  Then the app blocks the operation with linked record details
  And offers navigation to resolve the links

Scenario: Concurrent deletion
  Given another user edited the contact after I loaded it
  When I try to delete using a stale blob SHA
  Then the app shows a conflict
  And does not delete the newer record without fresh confirmation
```

## Future `purge-history` utility (NOT MVP)

A separately installed local CLI could:

1. Verify the target stable path and list all references to the record, including activity content.
2. Require explicit full repo backup, clone/collaborator inventory, and destructive confirmation.
3. Run `git-filter-repo --sensitive-data-removal --invert-paths --path <record_path>` against a fresh local clone, for all affected refs/paths.
4. Verify intended objects are unreachable from rewritten refs before a coordinated force-push.
5. Explain required collaborator re-clones/rebases and GitHub Support/cache limitations.

It must **never promise guaranteed universal erasure** of private clones, forks, exported files, or caches. See `docs/07-SECURITY-PRIVACY-AND-DELETION.md` and GitHub's referenced documentation.
