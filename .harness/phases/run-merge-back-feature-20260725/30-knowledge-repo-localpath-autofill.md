# Knowledge Repository Local Path Autofill

## Scope

When users fill the shared knowledge repository `Local path`, Harness should detect whether the path is an existing Git repository and automatically fill repository metadata.

## Implementation

- Added runtime `knowledge.repo.inspectLocal`.
- Added desktop IPC/preload methods for local path inspection.
- `configure_repo` also auto-detects `origin` remote URL and current branch when the local path is already a Git repository and the user leaves fields blank.
- Knowledge page calls inspection on local path blur and fills:
  - normalized local path
  - remote URL from `git remote get-url origin`
  - branch from `git branch --show-current`

## Validation

- `py -3 -m py_compile runtime\src\harness_runtime\knowledge\shared_repo.py runtime\src\harness_runtime\api\app.py`
- `.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit`
- `pnpm.cmd --filter @harness/desktop typecheck`
