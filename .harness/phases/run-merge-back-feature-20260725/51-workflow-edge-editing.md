# Workflow edge editing follow-up

## Scope

- Continue the module optimization pass by improving Workflow Studio edge interactions.

## Implemented

- Added draft edge state to `useWorkflowDraft`.
- Route nodes now initialize sequential visual edges when loaded.
- Node add, duplicate, remove, rename, reorder, undo, and redo keep visual edges coherent.
- Workflow canvas now supports:
  - snap-to-grid node dragging
  - dragging from handles to add a connection
  - clicking a connection to delete it after confirmation
  - highlighted styling for custom connections
  - visible interaction hint below the canvas
- Workflow preview sends `visualEdges` as extra context while preserving the existing linear route array.

## Notes

- Persisted workflow routes remain linear arrays for backward compatibility.
- Custom visual edges are prepared for future backend/schema support and are passed to preview context.

## Validation

- `pnpm.cmd --filter @harness/renderer typecheck` passed.
- `pnpm.cmd --filter @harness/renderer test` passed: 7 files, 23 tests.
- `pnpm.cmd --filter @harness/renderer build` passed.
- Existing Vite chunk-size warning remains.
