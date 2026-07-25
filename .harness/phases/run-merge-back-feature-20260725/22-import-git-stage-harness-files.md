# Import git staging for Harness files

## Change

Project import/repair now stages Harness-managed files in Git after bootstrap/validation succeeds.

## Rationale

When `.harness`, `AGENTS.md`, and `CLAUDE.md` are created or updated during import but remain untracked, later `git worktree add` runs do not include them. Terminal sessions launched inside those run worktrees then cannot see the Harness guidance and may not follow the required workflow.

## Implementation

- Added `_stage_harness_files(root)` in `runtime/src/harness_runtime/projects/service.py`.
- On successful import or repair, if the target root is inside a Git repository, run:
  - `git add -f -- .harness AGENTS.md CLAUDE.md`
- The feature stages files only; it does not create commits.
- Non-Git projects are skipped with `GIT_REPOSITORY_REQUIRED`.
- Stage failures are returned in `gitStage` rather than creating a commit or hiding the issue.
- Updated the valid Harness fixture with root guide files so it represents a complete importable project.

## Validation

- `py -3 -m py_compile runtime\src\harness_runtime\projects\service.py runtime\src\harness_runtime\projects\bootstrap.py`
- `py -3 -m pytest runtime\tests\projects\test_project_service.py runtime\tests\projects\test_bootstrap.py --basetemp test-results\pytest-project-import-git-stage`

Result: 27 passed, 1 skipped.
