# Claude provider backend and Knowledge follow-up

## Scope

- Continue the broader optimization pass with provider-aware terminal discovery and final Knowledge executor cleanup.

## Implemented

- Added provider-aware AI CLI discovery and settings storage in `apps/desktop/src/main/codex-discovery.ts`.
- Kept Codex discovery compatible while adding Claude Code discovery, selection, and version probing seams.
- Wired main process IPC for:
  - `codex-settings:*`
  - `claude-settings:*`
- Updated preload and renderer harness API types for provider-aware settings.
- Updated Settings UI so Claude Code can be selected and discovered from the same screen.
- Kept Knowledge executor readable with follow state, preview diff, approval feedback, and no mojibake text in the visible executor content.

## Validation

- `pnpm.cmd --filter @harness/desktop typecheck` passed.
- `pnpm.cmd --filter @harness/renderer typecheck` passed.
- `pnpm.cmd --filter @harness/desktop test` passed: 5 files, 33 tests.
- `pnpm.cmd --filter @harness/renderer test` passed: 7 files, 23 tests.
- `pnpm.cmd --filter @harness/renderer build` passed.
- Existing Vite chunk-size warning remains.
