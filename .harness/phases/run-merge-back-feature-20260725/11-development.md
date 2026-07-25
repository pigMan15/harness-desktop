# Development

## Runtime

- Added `merge_run_back(...)` in `runtime/src/harness_runtime/runs/service.py`.
- Added `run.mergeBack` dispatch in `runtime/src/harness_runtime/api/app.py`.

## Desktop Bridge

- Added `run:merge-back` IPC handler.
- Added `mergeRunBack(...)` to preload APIs and renderer type declarations.

## Renderer

- Added a guarded Merge Back action to the Runs table for runs with branch/worktree metadata.
- The action confirms with the user, calls runtime, updates active run metadata, and reloads runs.

