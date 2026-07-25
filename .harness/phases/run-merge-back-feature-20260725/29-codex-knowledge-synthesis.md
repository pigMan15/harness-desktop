# Codex Knowledge Synthesis

## Goal

Upgrade the shared knowledge repository feature from a static draft generator to a real Codex-assisted synthesis workflow.

## Implemented behavior

- Accepted Knowledge candidates remain the data source.
- Harness builds a Codex prompt from the selected accepted candidates.
- Codex runs with the shared knowledge repository as its working directory.
- Codex is instructed to read and follow the shared repository's own rules/templates before updating documents.
- File changes require Codex app-server approval events, surfaced in the Knowledge module.
- When Codex exits, Harness collects the shared repository Git diff and shows it as the preview.
- Push remains explicit. The user can:
  - push through the app, which stages/commits/pushes the current shared repository working tree;
  - or copy the manual Git command and push independently.

## Safety notes

- Codex synthesis is blocked when the shared knowledge repository has pre-existing local changes, so app push does not mix unrelated edits with generated changes.
- Codex is instructed not to commit or push.
- Existing static `Prepare Draft` remains as a fallback/debug path.

## Validation

- `py -3 -m py_compile runtime\src\harness_runtime\knowledge\shared_repo.py runtime\src\harness_runtime\api\app.py`
- `.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit`
- `pnpm.cmd --filter @harness/desktop typecheck`
