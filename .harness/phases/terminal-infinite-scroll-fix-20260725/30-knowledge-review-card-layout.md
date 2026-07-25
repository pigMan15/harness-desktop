# Knowledge Review Card Layout

## Request

Knowledge candidates should use a card layout. Each card should show a title and keywords, allow direct review actions, and open details only when requested.

## Change

Renderer:

- converted the Knowledge list into a responsive card grid;
- each card shows title, keyword chips, and summary;
- draft cards show Accept and Reject without requiring preview;
- details are opened via View Details / Hide Details;
- expanded details render the source Markdown content.

## Verification

Command:

```powershell
.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit
```

Result: exit code 0.

