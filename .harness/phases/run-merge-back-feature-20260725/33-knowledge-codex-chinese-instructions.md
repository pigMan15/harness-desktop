# Knowledge Codex Chinese Instructions

## Scope

Codex synthesis in the Knowledge module should analyze and respond in Chinese by default.

## Change

- Runtime developer instructions for Knowledge Codex sessions now require Chinese analysis/replies.
- Shared knowledge synthesis prompt is rewritten in Chinese.
- The prompt still tells Codex to follow the shared repository's own rules/templates and only leave local working tree changes for preview.

## UI semantics

- `Codex synthesis` panel shows the running analysis/status/output stream.
- `Local preview diff` shows the actual Git diff after Codex has generated or updated files in the shared knowledge repository.

## Validation

- `py -3 -m py_compile runtime\src\harness_runtime\knowledge\shared_repo.py runtime\src\harness_runtime\api\app.py`
- `.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit`
- `pnpm.cmd --filter @harness/desktop typecheck`
