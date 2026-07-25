# Knowledge Codex Log Rendering

## Problem

Codex app-server streams output as small delta events. The Knowledge page rendered every delta as a separate line, making Chinese output appear as one word/character per line and making raw tool-call JSON unreadable.

## Change

- Consecutive `output` events are aggregated before rendering.
- Tool calls, approval events, preview, exit, and errors are rendered as concise status lines.
- Codex synthesis log panel now uses wrapping text instead of forcing a horizontal/raw JSON layout.

## Validation

- `.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit`
- `pnpm.cmd --filter @harness/desktop typecheck`
