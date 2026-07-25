# Knowledge Right Rail Layout

## Problem

The Knowledge page stacked repository controls, local preview diff, Codex synthesis logs, tabs, and candidate cards vertically. The two execution panels consumed too much page height and made the candidate review workflow awkward.

## Change

- Introduced a two-column workbench layout.
- Left column:
  - shared knowledge repository configuration/actions
  - candidate tabs
  - review cards
- Right column:
  - `Local preview diff`
  - `Codex synthesis`
- The right execution rail is sticky on wide screens and collapses back into a single column on narrower screens.
- Codex log formatting uses ASCII status markers to avoid bullet mojibake in Windows-rendered text.

## Validation

- `.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit`
- `pnpm.cmd --filter @harness/desktop typecheck`
