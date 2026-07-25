# Knowledge Codex Dirty Repository Override

## Problem

Users can hit `KNOWLEDGE_REPO_DIRTY` when the shared knowledge repository already has local changes. A hard block is safe, but too rigid when the user intentionally wants Codex to continue against the current local repository state.

## Change

- Codex synthesis still blocks dirty shared repositories by default.
- Runtime accepts an explicit `allowDirty` flag for `knowledge.repo.codex.start`.
- Knowledge UI shows `Run Anyway` after a dirty-repo block.
- `Run Anyway` starts Codex with `allowDirty=true`, making the risk an explicit user choice.

## Validation

- `py -3 -m py_compile runtime\src\harness_runtime\knowledge\shared_repo.py runtime\src\harness_runtime\api\app.py`
- `.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit`
- `pnpm.cmd --filter @harness/desktop typecheck`
