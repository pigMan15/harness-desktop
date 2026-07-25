# Shared Knowledge Repository Feature

## Scope

- Add Git-backed shared knowledge repository configuration for the Knowledge module.
- Allow users to pull/clone the shared repository into a local path.
- Allow users to select accepted knowledge candidates and generate a local preview artifact inside the shared repository.
- Preview the resulting Git diff before publishing.
- Keep push explicit: the app exposes a Push action, and also shows a manual Git command so users can push themselves.

## Implementation notes

- Runtime API methods added:
  - `knowledge.repo.status`
  - `knowledge.repo.configure`
  - `knowledge.repo.pull`
  - `knowledge.repo.synthesize`
  - `knowledge.repo.push`
- Shared repository settings are stored in SQLite table `knowledge_repo_configs`.
- Generation currently writes a Codex-ready update draft under `harness-inbox/<project>/<timestamp>-knowledge-update.md`.
- The generated draft includes shared repo rule excerpts from `AGENTS.md`, `CLAUDE.md`, `README.md`, `knowledge-rules.md`, and known `.harness/` rule files when present.
- The app never pushes automatically after synthesis; push requires a user action. When the user chooses app push, Harness stages and commits the generated `harness-inbox/` content before `git push`.

## Validation

- `py -3 -m py_compile runtime\src\harness_runtime\knowledge\shared_repo.py runtime\src\harness_runtime\api\app.py`
- `.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit`
- `pnpm.cmd --filter @harness/desktop typecheck`
- Direct smoke validation confirmed an accepted candidate plus shared repo `AGENTS.md` rule generates a local `harness-inbox/` preview diff.
