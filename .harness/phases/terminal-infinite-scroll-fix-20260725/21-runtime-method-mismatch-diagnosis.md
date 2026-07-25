# Runtime Method Mismatch Diagnosis

## Symptom

The local Terminal module reported:

```text
Unknown method: run.executionContext
```

## Cause

The worktree runtime source already registers `run.executionContext` in `runtime/src/harness_runtime/api/app.py`, but the development Electron process starts Python with:

```text
py -3 -m harness_runtime.main
```

without forcing the current worktree's `runtime/src` onto `PYTHONPATH`. On Windows this can import an older installed/local runtime package, so desktop and runtime method sets drift apart.

## Fix

`RuntimeSupervisor.spawn()` now prepends:

```text
<projectRoot>\runtime\src
```

to `PYTHONPATH` before launching the development runtime.

## Verification

Command:

```powershell
$env:PYTHONPATH='G:\Project\ai\harness-desktop\.worktrees\multirun-codex-terminal-implementation-20260724\runtime\src'; py -3 -c "import inspect, harness_runtime.api.app as app; print(app.__file__); print('run.executionContext' in inspect.getsource(app))"
```

Result:

```text
G:\Project\ai\harness-desktop\.worktrees\multirun-codex-terminal-implementation-20260724\runtime\src\harness_runtime\api\app.py
True
```

