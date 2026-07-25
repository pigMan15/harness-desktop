# Knowledge Codex Session Restore

## Problem

Switching away from the Knowledge module unmounted the React page and lost local `codexSessionId`, logs, and running state. The backend Codex app-server session could still be running, but the UI no longer knew which session to poll when returning.

## Change

- Runtime now exposes `knowledge.repo.codex.active`.
- Electron IPC/preload exposes the active session lookup.
- Knowledge page calls the active session lookup on mount/project change.
- If an active session is found, the page restores `codexSessionId`, marks Codex as running, and resumes polling.
- Buffered backend events are then displayed when the page returns.

## Validation

- `py -3 -m py_compile runtime\src\harness_runtime\api\app.py`
- `.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit`
- `pnpm.cmd --filter @harness/desktop typecheck`
