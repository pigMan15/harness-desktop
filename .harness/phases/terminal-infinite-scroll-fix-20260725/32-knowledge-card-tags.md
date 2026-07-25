# Knowledge Card Tags

## Request

Clarify the metadata shown on Knowledge cards and add color styling when fields are presented as tags.

## Change

- Replaced the mixed metadata chip row with explicit tags:
  - blue type tag, e.g. `Case`;
  - neutral source run tag, e.g. `Run terminal-infinite-scroll-fix-20260725`.
- Moved review state into a separate top-right status badge:
  - yellow `Pending`;
  - green `Accepted`;
  - red `Rejected`.
- Removed source filename from the main card tag row; it remains visible in View Details.

## Verification

Command:

```powershell
.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit
```

Result: exit code 0.

