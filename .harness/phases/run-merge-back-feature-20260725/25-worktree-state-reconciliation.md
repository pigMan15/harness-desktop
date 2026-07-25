# Worktree state reconciliation

## Change

The runtime now reconciles newer run state written inside a run worktree back to the authoritative project run snapshot when the outer UI reads the run.

## Rationale

Terminal Codex sessions run inside the isolated worktree and may update:

- `.harness/state.json`
- `.harness/runs/<run_id>/state.json`
- `.harness/phases/<run_id>/*`

The outer UI reads the project root snapshot. Without reconciliation, Runs/Gates/Artifacts/Knowledge can remain stuck at the original node even after the terminal completed the workflow in the worktree.

## Implementation

- `read_run_state()` checks `worktree_path` for a newer matching run state.
- If the worktree state is newer, it is written back to:
  - project `.harness/runs/<run_id>/state.json`
  - project `.harness/state.json` when that run is selected
- Existing main-only metadata such as `branch_name`, `worktree_path`, and `worktree_status` is preserved if the worktree state lacks it.
- Artifact and gate phase resolution now falls back to the worktree phase directory when the project-root phase is empty.

## Validation

- `py -3 -m py_compile runtime\src\harness_runtime\persistence\state_store.py runtime\src\harness_runtime\api\app.py`
- `py -3 -m pytest runtime\tests\persistence\test_state_store.py runtime\tests\api\test_artifact_api.py runtime\tests\runs\test_run_service.py --basetemp test-results\pytest-worktree-state-reconcile`

Result: 36 passed.
