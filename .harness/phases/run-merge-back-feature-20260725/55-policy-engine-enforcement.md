# Policy Engine Enforcement Follow-up

## Scope

- Keep the completed run in `KNOWLEDGE_PROMOTION`; do not reroute or reset gates.
- Turn the renderer policy settings into guards for real user actions.

## Implementation

- Added a shared settings and policy module so every feature reads the same storage key, defaults, and `allow / ask / block` semantics.
- Applied `commandExecution` to Terminal session launch and Codex knowledge synthesis.
- Applied `gitCommit` to run worktree merge-back.
- Applied `gitPush` to shared knowledge repository push.
- Applied `dirtyWorktree` to the explicit dirty-repository synthesis override.
- Applied `repeatKnowledgePush` before synthesis and push when selected candidates were already published.
- Made the Terminal primary AI action follow the configured default provider while retaining the alternate provider as a secondary action.
- Exposed each run's branch and worktree metadata directly in the Runs table.
- Added focused unit coverage for stored-setting merging, invalid storage fallback, and policy decisions.

## Verification Plan

- `pnpm.cmd --filter @harness/renderer typecheck` - PASS.
- `pnpm.cmd --filter @harness/renderer test` - PASS, 8 files / 26 tests.
- `pnpm.cmd --filter @harness/renderer build` - PASS.
- Focused `git diff --check` for new policy and Harness artifact files - PASS.
- Full touched-file `git diff --check` remains noisy because `KnowledgePage.tsx` already contains mixed CRLF/LF line endings; no whitespace-only rewrite was performed.
