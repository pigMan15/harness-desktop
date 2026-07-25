# Worktree Harness metadata sync

## Change

Run worktree creation now copies missing Harness guidance files from the authoritative project root into the run worktree.

## Rationale

`git worktree add` checks out committed `HEAD` only. Import-time staged or untracked `.harness`, `AGENTS.md`, and `CLAUDE.md` files are not present in newly created run worktrees, so terminal sessions launched in those worktrees cannot see Harness workflow instructions.

## Implementation

- Added `_sync_harness_metadata(source_root, target_root)` in `runtime/src/harness_runtime/runs/worktrees.py`.
- After creating or reusing a run worktree, ensure these entries exist in the worktree:
  - `.harness`
  - `AGENTS.md`
  - `CLAUDE.md`
- Existing target entries are preserved.
- Source symlinks are rejected.

## Validation

- `py -3 -m py_compile runtime\src\harness_runtime\runs\worktrees.py`
- `py -3 -m pytest runtime\tests\runs\test_worktree_manager.py --basetemp test-results\pytest-worktree-harness-sync`

Result: 3 passed.
