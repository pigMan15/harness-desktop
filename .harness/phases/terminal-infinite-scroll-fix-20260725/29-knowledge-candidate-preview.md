# Knowledge Candidate Preview

## Symptom

Knowledge candidates could only be accepted or rejected. Users could not preview the full source details before review.

## Cause

`knowledge.list` returned database rows containing title, summary, and source path, but not the source artifact content. The Knowledge page did not expose an expansion or preview action.

## Fix

Runtime:

- `list_candidates_with_content(...)` reads each candidate source file when available;
- `knowledge.list` now returns `content` and `contentType` for candidates.

Renderer:

- Knowledge cards now include a Preview/Hide button;
- Preview displays source path and rendered Markdown content;
- Accept/Reject remain available for draft candidates.

## Verification

Commands:

```powershell
py -3 -m py_compile runtime\src\harness_runtime\knowledge\service.py runtime\src\harness_runtime\api\app.py
.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit
```

Results: both exit code 0.

