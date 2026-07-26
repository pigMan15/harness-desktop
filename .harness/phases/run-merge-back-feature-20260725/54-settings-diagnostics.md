# Settings diagnostics follow-up

## Scope

- Continue the module optimization pass by turning Settings into a cleaner provider and diagnostics control center.

## Implemented

- Rewrote Settings visible copy with ASCII-safe UI text to avoid mojibake on Windows.
- Added Diagnostics section:
  - Runtime health
  - Codex CLI discovery
  - Claude Code CLI discovery
- Diagnostics run in parallel and display compact state, label, and detail rows.
- Provider cards continue to support choose/discover/default actions.
- Profiles, Policy Engine, and GitHub Release defaults remain in the grouped settings layout.

## Validation

- `pnpm.cmd --filter @harness/renderer typecheck` passed.
- `pnpm.cmd --filter @harness/renderer test` passed: 7 files, 23 tests.
- `pnpm.cmd --filter @harness/renderer build` passed.
- Existing Vite chunk-size warning remains.
