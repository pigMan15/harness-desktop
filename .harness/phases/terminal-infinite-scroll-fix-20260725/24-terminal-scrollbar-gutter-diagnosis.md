# Terminal Scrollbar Gutter Diagnosis

## Symptom

The Codex input line inside the Terminal page visually conflicted with the vertical scrollbar. The terminal content used the full available width while the native scrollbar occupied the right edge.

## Cause

The xterm root element was sized to `height: 100%` but did not reserve horizontal space for the xterm viewport scrollbar. Fit calculations could therefore allocate terminal columns under the scrollbar area.

## Fix

`apps/renderer/src/app/styles.css` now applies:

```css
.terminal-host .xterm { min-height: 0; height: 100%; box-sizing: border-box; padding-right: 16px; }
.terminal-host .xterm-viewport { scrollbar-gutter: stable; }
```

This reserves a stable right gutter for the scrollbar and keeps the terminal input/content area from running underneath it.

