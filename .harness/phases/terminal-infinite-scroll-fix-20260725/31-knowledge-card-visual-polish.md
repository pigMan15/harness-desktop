# Knowledge Card Visual Polish

## Request

The Knowledge page card layout and button styling looked visually poor.

## Change

Renderer:

- moved review actions from the cramped card header to a bottom action bar;
- widened card columns and increased spacing;
- turned status tabs into a compact segmented control;
- added consistent card spacing, border, shadow, and typography;
- clamped summaries to four lines to keep cards scannable;
- kept keyword chips visible below the title;
- kept View Details as a secondary action and Accept/Reject as review actions.

## Verification

Command:

```powershell
.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit
```

Result: exit code 0.

