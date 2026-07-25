# Knowledge Visual Polish

## Goal

Improve the Knowledge module layout beyond simply moving execution panels to the right.

## Changes

- Added a hero/header card with a concise workflow description and selected-count badge.
- Improved right-side executor cards with clearer titles, descriptions, rounded cards, and stronger visual hierarchy.
- Replaced inline red-only messages with semantic message styles:
  - info
  - success
  - error
- Success states no longer render as red error banners.
- Kept the two-column layout and responsive fallback from the previous iteration.

## Validation

- `.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit`
- `pnpm.cmd --filter @harness/desktop typecheck`
