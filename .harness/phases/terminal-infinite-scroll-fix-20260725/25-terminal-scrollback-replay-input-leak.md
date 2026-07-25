# Terminal Scrollback Replay Input Leak

## Symptom

After switching away from the Terminal page and returning, the live Codex prompt received raw terminal control responses such as:

```text
[?1;2c]10;rgb:e8e8/eaea/eded\]11;rgb:1111/1313/1515\
```

Codex then treated those bytes as pasted user input.

## Cause

When the Terminal page remounts, it replays saved scrollback with `terminal.write(replay.data)`. Some historical output contains terminal capability/color query escape sequences. xterm correctly responds to those queries through `onData`, but the page forwarded every `onData` payload to the live PTY via `writeTerminal(...)`.

During scrollback replay, generated terminal responses are not real user input and must not be sent back to the session.

## Fix

`TerminalPage` now tracks `replayingScrollback`:

- `onData` is still registered for real keyboard input;
- while scrollback or session summary is being replayed, `onData` payloads are ignored;
- replay mode is cleared after xterm finishes processing the write callback and the next animation frame runs;
- cleanup marks the terminal as disposed so late async scrollback reads do not write into a destroyed terminal.

## Verification

Command:

```powershell
.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit
```

Result: exit code 0.

