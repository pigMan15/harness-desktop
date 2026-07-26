# AI CLI Manual Path Follow-up

## Scope

- Keep the completed Harness run in `KNOWLEDGE_PROMOTION` without resetting gates.
- Make manually entered AI CLI paths configure the executable actually used by Terminal.

## Implementation

- Added provider-aware `set-path` IPC handlers for Codex and Claude Code.
- Extended preload and renderer contracts with `setAiCliExecutable(provider, executablePath)`.
- Added editable Codex and Claude Code path fields with explicit Save path actions.
- Saving a path probes the executable version first; invalid paths are rejected and do not replace the last working main-process configuration.
- Settings now hydrate both path fields from the application-level provider store.

## Verification Plan

- `pnpm.cmd --filter @harness/desktop typecheck` - PASS.
- `pnpm.cmd --filter @harness/renderer typecheck` - PASS.
- `pnpm.cmd --filter @harness/desktop test` - PASS, 34 tests.
- `pnpm.cmd --filter @harness/renderer test` - PASS, 26 tests.
- `pnpm.cmd --filter @harness/renderer build` - PASS.
