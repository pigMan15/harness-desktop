# Harness Desktop User Guide

## Overview

Harness Desktop is a local desktop workbench for `.harness` v1.0 projects. It helps users import projects, create runs with explicit Intent/Risk, inspect workflow state, evaluate gates, review artifacts, run external executors, recover interrupted sessions, and review knowledge candidates.

The project `.harness/` directory remains the source of truth. Desktop-side SQLite data is a rebuildable projection and does not replace project state.

## Start The Runtime

For development:

```powershell
pnpm install
python -m pip install -e "runtime[dev]"
$env:HARNESS_RUNTIME_TOKEN = "dev-token"
python -m harness_runtime.main
pnpm --filter @harness/desktop dev
```

Packaged builds should start the bundled Runtime through Electron Main.

## Main Areas

| Area | Purpose |
| --- | --- |
| Home | Shows Runtime connectivity and protocol version. |
| Projects | Import, list, and validate `.harness` projects. |
| Runs | Create and list runs. Intent/Risk must be explicitly supplied by the user. |
| Workflow | Inspect and compile the active workflow for a selected Intent/Risk. |
| Gates | View and evaluate gate status through Runtime APIs. |
| Artifacts | List and preview phase artifacts from the active `phase_dir`. |
| Execution | Start/poll/cancel executor sessions and respond to approval requests. |
| Knowledge | Review, accept, or reject knowledge promotion candidates. |
| Recovery | Scan and clean recoverable runtime/session state. |

## Operating Rules

- Do not edit `.harness/state.json` outside the Runtime path when using Desktop.
- Do not mark G3-G8 gates as passed unless verifier-domain evidence exists.
- Treat Windows installer, upgrade, uninstall, and signing claims as release evidence items; they require explicit command output, artifacts, and hashes.
- If the Runtime reports a revision conflict, refresh the project state before retrying the operation.

## Evidence

Completed runs should contain:

- phase artifacts under `.harness/phases/<run-id>/`
- a snapshot at `.harness/runs/<run-id>/state.json`
- `15-evidence.json` with commands, gates, artifacts, waivers, and residual risks
- `18-acceptance-report.md` summarizing scope and verification
