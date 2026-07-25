# Terminal text paste fix

## Change

Terminal keyboard paste now routes text clipboard contents into the PTY instead of sending paste shortcut control characters to the running Codex CLI.

## Rationale

Pressing `Ctrl+V` inside xterm was forwarded as terminal input. Codex CLI interpreted that shortcut as an image paste command, producing:

`Failed to paste image: no image on clipboard`

## Implementation

- Added `writeTerminalText` and `pasteClipboardText` helpers.
- Intercepts:
  - `Ctrl+V`
  - `Cmd+V`
  - `Shift+Insert`
- Handles browser `paste` events with `text/plain`.
- Reuses the same logic for the toolbar Paste button.

## Validation

- `.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit`
- `pnpm.cmd --filter @harness/renderer test -- TerminalPage.test.ts`

Result: renderer typecheck passed; Vitest reported 5 files / 18 tests passed.
