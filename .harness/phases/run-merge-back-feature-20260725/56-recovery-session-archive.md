# Recovery Session Archive Follow-up

## Scope

- Keep the completed Harness run in `KNOWLEDGE_PROMOTION` without resetting gates.
- Add a safe operation for stale Recovery records that currently can only be viewed.

## Implementation

- Added `recovery.archive` across runtime RPC, Electron IPC, preload, and renderer types.
- Only executor sessions in `orphan / lost` and terminal sessions in `interrupted` can be archived.
- Archiving changes only the rebuildable SQLite projection; it does not kill processes, remove worktrees, or alter Harness run state.
- Added an explicit confirmation and Archive action to stale Recovery rows.
- Added API coverage proving an archived executor session disappears from later recovery scans.

## Verification Plan

- `python -m pytest runtime/tests/recovery/test_recovery.py runtime/tests/api/test_execution_api.py -q` - PASS, 8 tests.
- `pnpm.cmd --filter @harness/desktop typecheck` - PASS.
- `pnpm.cmd --filter @harness/renderer typecheck` - PASS.
- `pnpm.cmd --filter @harness/desktop test` - PASS, 33 tests.
- `pnpm.cmd --filter @harness/renderer test` - PASS, 26 tests.
- `pnpm.cmd --filter @harness/renderer build` - PASS.
- Desktop packaging was not repeated because its `build` command creates installers; the desktop TypeScript and IPC contract compiled successfully through typecheck.
