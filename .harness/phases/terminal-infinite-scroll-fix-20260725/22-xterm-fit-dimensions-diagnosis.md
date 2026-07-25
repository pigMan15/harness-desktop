# Xterm Fit Dimensions Diagnosis

## Symptom

Renderer console reported:

```text
Uncaught TypeError: Cannot read properties of undefined (reading 'dimensions')
```

## Cause

`@xterm/addon-fit` reads the private xterm render service field `_core._renderService.dimensions`. The Terminal page called `fitAddon.fit()` immediately after `terminal.open(...)`, which can happen before xterm has initialized render dimensions.

## Fix

`TerminalPage` now:

- waits until the next animation frame before the first fit;
- verifies the host element has positive dimensions;
- verifies xterm render dimensions exist before calling `fitAddon.fit()`;
- retries initial fitting for a few frames while xterm initializes;
- catches fit errors and displays a page message instead of letting the renderer crash.

## Verification

Command:

```powershell
.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit
```

Result: exit code 0.

Attempted renderer tests:

```powershell
pnpm.cmd --filter @harness/renderer test
```

Result: blocked by local execution environment with `Error: spawn EPERM` while Vite/Vitest tried to start esbuild.

