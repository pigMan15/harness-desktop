# Merge dirty diagnostics

## Change

Merge-back dirty worktree errors now include the first dirty file status lines.

## Rationale

The previous `TARGET_WORKTREE_DIRTY` / `RUN_WORKTREE_DIRTY` error did not explain which files blocked the merge. Users had to leave the app and run `git status` manually to understand the next action.

## Implementation

- Target dirty check now uses `git status --short`.
- Run worktree dirty check now uses `git status --short`.
- Error message format:
  - `TARGET_WORKTREE_DIRTY:\n<status lines>`
  - `RUN_WORKTREE_DIRTY:\n<status lines>`
- Output is capped at 20 lines with an overflow count.

## Validation

- `py -3 -m py_compile runtime\src\harness_runtime\runs\service.py`
- `py -3 -m pytest runtime\tests\runs\test_run_service.py --basetemp test-results\pytest-merge-dirty-message`

Result: 22 passed.
