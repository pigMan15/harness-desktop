# Artifacts pin and compare follow-up

## Scope

- Continue the module optimization pass by improving artifact review ergonomics.

## Implemented

- Added per-run pinned artifact names stored in `localStorage`.
- Pinned artifacts are sorted to the top of the artifact browser.
- Added a pin/unpin action in the artifact reader toolbar.
- Added artifact-to-artifact comparison:
  - select another artifact from the reader toolbar
  - load its content through the existing artifact read API
  - show a simple line diff in the reader
- Switching the active artifact clears comparison mode.
- Added compact compare select styling.

## Validation

- `pnpm.cmd --filter @harness/renderer typecheck` passed.
- `pnpm.cmd --filter @harness/renderer test` passed: 7 files, 23 tests.
- `pnpm.cmd --filter @harness/renderer build` passed.
- Existing Vite chunk-size warning remains.
