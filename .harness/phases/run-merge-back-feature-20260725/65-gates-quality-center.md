# Gates Quality Decision Center Follow-up

## Scope

Upgrade Gates from a flat status table into a quality decision center without changing Harness gate IDs, evaluation rules, permissions, or recovery semantics.

## Implementation

- Overall completion, status counts, blocking gate, and run context.
- Ordered G1-G8 timeline and grouped gate cards.
- Evidence completeness derived from the active run artifact list.
- Detail drawer with definition, latest evaluation, evidence links, pass conditions, waiver record, and recovery guidance.
- Sequential evaluation of pending/failed gates, stopping on the first FAIL or BLOCKED result.
- Waiver input moved into the selected gate detail drawer.

## Verification

Pending renderer typecheck, tests, and production build.

- `pnpm.cmd --filter @harness/renderer typecheck`: PASS.
- `pnpm.cmd --filter @harness/renderer test`: PASS, 10 files / 33 tests.
- `pnpm.cmd --filter @harness/renderer build`: PASS.
- Existing Vite bundle-size warning remains informational.
- Runtime gate definitions and evaluation semantics were not changed.

## Encoding And Layout Correction

- Replaced code-page-damaged Chinese literals with ASCII-safe Unicode escapes.
- Reworked quality groups into three balanced columns with stacked cards.
- Medium widths use one group per row with auto-fit cards; narrow widths use one card per row.
- Continuous-question-mark scan is clean; renderer tests and production build pass.
