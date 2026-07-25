# Artifact Markdown Preview Diagnosis

## Symptom

Artifacts preview displayed Markdown artifacts as raw text instead of rendered Markdown.

## Cause

`ArtifactsPage` always rendered artifact content inside a `<pre>` block. The renderer package does not currently include a Markdown rendering dependency.

## Fix

Added a lightweight, safe React Markdown preview path for `.md` artifacts without using `dangerouslySetInnerHTML`.

Supported Markdown blocks:

- headings;
- paragraphs;
- unordered and ordered lists;
- blockquotes;
- fenced code blocks;
- simple pipe tables;
- inline code and bold text.

Non-Markdown artifacts continue to render as raw text/JSON.

## Verification

Command:

```powershell
.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit
```

Result: exit code 0.

