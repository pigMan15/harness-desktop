# Recovery Terminal Session Scan

## Symptom

Recovery > Scan sessions returned no data even while the Terminal module had a running Codex session.

## Cause

Recovery scan only queried `executor_sessions`. Terminal module sessions are stored separately in `terminal_sessions`, so they were invisible to Recovery.

## Fix

Runtime recovery scan now includes both:

- `executor_sessions` for Codex app-server/execution recovery;
- active `terminal_sessions` for Terminal module recovery visibility.

Terminal sessions are reported with `session_type = terminal:<kind>`, PID, run/node, cwd as worktree path, and recoverable/orphan status based on process liveness. Orphan terminal projections are marked `interrupted`.

Renderer Recovery page now displays the session type and message.

## Verification

Commands:

```powershell
py -3 -m py_compile runtime\src\harness_runtime\recovery\service.py
.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit
```

Results: both exit code 0.

