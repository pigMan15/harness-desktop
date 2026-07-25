# Revision Conflict Long Paths Diagnosis

## Symptom

Terminal page displayed `REVISION_CONFLICT`, and the error details included repeated Git checkout failures:

```text
Filename too long
fatal: Could not reset index file to revision 'HEAD'.
```

## Cause

Runtime worktree creation uses `git worktree add` through `runtime/src/harness_runtime/runs/worktrees.py`. On Windows, this repository contains deeply nested fixture paths, and generated run worktree paths can exceed Git for Windows' default path handling.

The failed checkout leaves the run worktree in a blocked/partial state. Later UI actions can then compare against a stale revision and surface `REVISION_CONFLICT`.

## Fix

The runtime `_git(...)` wrapper now invokes Git as:

```text
git -c core.longpaths=true ...
```

so all worktree-related Git commands in this module use long path support.

The Terminal page notice area also now wraps and scrolls long errors so large Git stderr output is readable instead of being hidden behind bottom controls.

Terminal context loading now retries once without `expectedRevision` when `run.executionContext` returns `REVISION_CONFLICT`. Follow-up node completion uses the latest `context.revision` when available, because worktree preparation can legitimately update run state and advance the revision.

## Verification

Command:

```powershell
$env:PYTHONPATH='G:\Project\ai\harness-desktop\.worktrees\multirun-codex-terminal-implementation-20260724\runtime\src'; py -3 -c "from harness_runtime.runs.worktrees import _git; import inspect; print('core.longpaths=true' in inspect.getsource(_git))"
```

Result:

```text
True
```

Renderer type check:

```powershell
.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit
```

Result: exit code 0.
