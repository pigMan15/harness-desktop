# Terminal Chinese IME Input Follow-up

## Problem

Chinese IME composition could not reliably reach the managed PTY. The renderer discarded all xterm `onData` events while restoring scrollback, so a composition committed during that window was lost. The custom keyboard hook also did not explicitly leave IME composition keystrokes to xterm.

## Implementation

- Preserve `isComposing`, `Process`, and Windows virtual key `229` events for xterm's native composition helper.
- Buffer terminal input received during scrollback restoration and flush it to the active PTY after replay completes.
- Focus the hidden xterm textarea after creation and replay so it remains the active IME target.
- Add Windows Chinese font fallbacks so composition and PTY echo are visibly rendered.
- Add a renderer source-contract test covering composition handling and replay buffering.

## Scope

The Main-process PTY bridge already writes JavaScript strings directly to `node-pty` and validates size using UTF-8 byte length, so no encoding conversion was added there.

## Verification

- `pnpm.cmd --filter @harness/renderer typecheck`: PASS.
- `pnpm.cmd --filter @harness/renderer test -- TerminalPage.test.ts`: PASS, 8 files / 27 tests.
- `pnpm.cmd --filter @harness/renderer build`: PASS.
- Live Windows Chinese IME interaction remains a manual Electron smoke check because automated tests cannot drive the host IME candidate window.
