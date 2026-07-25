# Knowledge Phase Candidate Sync

## Symptom

The active run had completed `KNOWLEDGE_PROMOTION` and contained `19-knowledge-promotion.md`, but the Knowledge module did not show it.

Example artifact path:

```text
.harness/phases/multirun-codex-terminal-implementation-20260724
```

inside the run worktree.

## Cause

The Knowledge page calls `knowledge.list`, which reads the `knowledge_candidates` database table. Existing `19-knowledge-promotion.md` phase artifacts were never imported into that table because `promote_candidate(...)` was not called anywhere.

The runtime API also ignored the selected `projectId` when listing knowledge candidates.

## Fix

`knowledge.list` now:

- receives `project_id` and `project_root`;
- scans `.harness/runs/*/state.json`;
- finds runs that reached `KNOWLEDGE_PROMOTION`;
- imports existing `19-knowledge-promotion.md` artifacts from either the selected project root phase dir or the run's isolated `worktree_path` phase dir;
- de-duplicates by `(project_id, run_id, source)`;
- returns candidates filtered by selected project and requested status.

## Verification

Commands:

```powershell
py -3 -m py_compile runtime\src\harness_runtime\knowledge\service.py runtime\src\harness_runtime\api\app.py
.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit
```

Results: both exit code 0.
