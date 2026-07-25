# Root guide merge update

## Change

User clarified that existing root guide files must not be skipped. If `AGENTS.md` or `CLAUDE.md` already exists, bootstrap should preserve custom project content while updating the Harness guidance delta.

## Implementation

- Added a managed root guide block bounded by `HARNESS ROOT GUIDE START/END`.
- Fresh bootstrap creates root guide files with the managed block.
- Existing root guide files are merged:
  - existing custom content is preserved;
  - an existing managed block is replaced with the latest template;
  - if no managed block exists, the latest block is appended.
- `list_missing_files` now reports existing guide files that need a managed-block update.
- `apply_bootstrap` now reports `updatedRootFiles` in addition to `createdRootFiles`.
- Failed bootstrap rolls back root guide updates made during the failed operation.

## Validation

- `py -3 -m py_compile runtime\src\harness_runtime\projects\bootstrap.py`
- `py -3 -m pytest runtime\tests\projects\test_bootstrap.py --basetemp test-results\pytest-bootstrap-root-guide`

Result: 8 passed, 1 skipped.
