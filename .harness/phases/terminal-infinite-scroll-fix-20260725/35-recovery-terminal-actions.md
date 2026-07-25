# Recovery Terminal Actions

## Request

Recovery scan showed session data but only allowed viewing. Users need available recovery actions.

## Change

Renderer Recovery page now provides Terminal session actions:

- `Open Terminal` for terminal sessions, navigating to the Terminal module;
- `Stop` for recoverable terminal sessions, invoking `terminal:stop`, then rescanning.

Executor session recovery remains view-only for now because proper attach/resume requires a separate executor protocol.

## Verification

Command:

```powershell
.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit
```

Result: exit code 0.

