# Recovery Auto Scan

## Request

Recovery should load session data automatically when entering the page. The scan button should be defined as manual refresh.

## Change

Renderer Recovery page now:

- runs `scanRecovery(...)` on mount and selected project changes;
- keeps the button as a manual refresh action;
- renames the button from `Scan sessions` to `Refresh sessions`.

## Verification

Command:

```powershell
.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit
```

Result: exit code 0.

