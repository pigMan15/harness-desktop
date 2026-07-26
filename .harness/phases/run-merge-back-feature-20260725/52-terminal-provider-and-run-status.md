# Terminal provider launch and run status readability

## Scope

- Continue the module optimization pass by connecting AI CLI provider selection into Terminal and improving Projects/Runs state readability.

## Implemented

- Terminal:
  - added `Start Claude` action
  - sends `kind: ai` and `provider: claude` through the provider-aware terminal protocol
  - keeps `Start Codex` backward compatible
- Projects:
  - added readable health hints for healthy, readonly, and degraded projects
  - shows the hint below the health badge
- Runs:
  - added user-friendly explanations for common `TARGET_WORKTREE_DIRTY`, `RUN_WORKTREE_DIRTY`, and `REVISION_CONFLICT` failures
  - added merge-back status badges
  - added a new-run preview block showing the derived branch name and bootstrap expectation

## Validation

- `pnpm.cmd --filter @harness/renderer typecheck` passed.
- `pnpm.cmd --filter @harness/renderer test` passed: 7 files, 23 tests.
- `pnpm.cmd --filter @harness/renderer build` passed.
- Existing Vite chunk-size warning remains.
