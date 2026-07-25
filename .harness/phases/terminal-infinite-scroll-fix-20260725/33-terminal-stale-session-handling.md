# Terminal Stale Session Handling

## Symptom

Renderer logged unhandled errors:

```text
TERMINAL_SESSION_NOT_FOUND
Error invoking remote method 'terminal:scrollback'
Error invoking remote method 'terminal:resize'
```

## Cause

After dev reloads or navigation, the renderer can still hold a durable terminal session summary while Electron Main's in-memory `TerminalManager` no longer owns that session. Calls such as scrollback, resize, or write then reject with `TERMINAL_SESSION_NOT_FOUND`.

## Fix

`TerminalPage` now treats `TERMINAL_SESSION_NOT_FOUND` as stale session state:

- clears the current session;
- refreshes the terminal session list;
- suppresses unhandled promise errors for scrollback, resize, and write operations;
- reports non-stale terminal errors as page messages.

Follow-up: durable session summaries could immediately re-select the same stale session after it was cleared, causing infinite `terminal:scrollback` retries. The page now tracks stale session IDs and excludes them from automatic matching for the current page lifecycle.

Follow-up: the first stale `terminal:scrollback` call still made Electron log a handler error before the renderer could mark it stale. `TerminalManager.readScrollback(...)` now returns `{ missing: true }` for missing sessions instead of throwing. `write(...)` and `resize(...)` no-op for missing sessions, while owner mismatches still throw.

Additional verification:

```powershell
.\node_modules\.bin\tsc.CMD --project apps\desktop\tsconfig.json --noEmit
.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit
```

Results: both exit code 0.

## Verification

Command:

```powershell
.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit
```

Result: exit code 0.
