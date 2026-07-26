# Knowledge executor and AI provider follow-up

## Scope

- Continue the Settings/Terminal/Workflow/Recovery optimization pass.
- Stabilize Knowledge synthesis UI and add the backend protocol seam for future Claude Code CLI support.

## Implemented

- Knowledge synthesis executor:
  - cleaned visible executor copy to remove mojibake text
  - added log auto-follow pause/resume behavior
  - added visible follow state and Follow action
  - kept feedback and approval controls in the right-side executor rail
- AI CLI provider protocol:
  - added `AiCliProvider` and `TerminalKind` types
  - added optional `provider` to terminal create requests and terminal session summaries
  - TerminalManager now forwards provider to executable resolution
  - current Codex behavior remains compatible
  - Claude Code provider requests now have an explicit backend seam and currently fail with `CLAUDE_UNAVAILABLE` until discovery/launch support is implemented
- Added a desktop unit test for provider forwarding.

## Validation

- `pnpm.cmd --filter @harness/desktop typecheck` passed.
- `pnpm.cmd --filter @harness/renderer typecheck` passed.
- `pnpm.cmd --filter @harness/desktop test` passed: 5 files, 33 tests.
- `pnpm.cmd --filter @harness/renderer test` passed: 7 files, 23 tests.
- `pnpm.cmd --filter @harness/renderer build` passed.
- Existing Vite chunk-size warning remains.
