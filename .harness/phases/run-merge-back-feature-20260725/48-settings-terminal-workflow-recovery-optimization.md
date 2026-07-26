# Settings, Terminal, Workflow, and Recovery optimization

## Scope

- Start the broader product optimization pass requested after reviewing existing modules.
- Keep the completed Harness run in `DONE / KNOWLEDGE_PROMOTION` and append an incremental record.

## Implemented

- Reworked Settings into grouped cards:
  - AI CLI Providers
  - Profiles
  - Policy Engine
  - GitHub Release defaults
- Added a first-class Claude Code provider slot in Settings so the UI can grow beyond Codex without renaming the whole settings surface later.
- Added local profile and policy persistence through `localStorage`.
- Improved Terminal:
  - multi-line paste confirmation
  - copy all output
  - copy recent output
  - explicit follow mode control
  - provider, PID, last output time, follow status, and session status in the context strip
- Improved Workflow canvas:
  - snap-to-grid dragging
  - explicit duplicate-node drop choice instead of silent no-op
  - smoother route edge behavior retained through React Flow
- Improved Recovery:
  - recovery reason text per session
  - copy session JSON action

## Deferred

- Full backend AI CLI provider registry for Claude Code.
- Knowledge synthesis log rendering rewrite.
- Editable non-linear workflow edges persisted into workflow YAML.
- Release policy enforcement wired into backend actions.

## Validation

- `pnpm.cmd --filter @harness/renderer typecheck` passed.
- `pnpm.cmd --filter @harness/renderer test` passed: 7 files, 23 tests.
- `pnpm.cmd --filter @harness/renderer build` passed.
- Existing Vite chunk-size warning remains.
