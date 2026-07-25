# Knowledge Codex Human Feedback

## Problem

Knowledge Codex synthesis produced local repository changes, but the UI only exposed tool approvals and final push. Users had no way to type human review feedback when the generated content was not acceptable.

## Change

- Added `CodexAppServer.send_message()` for follow-up turns in the same Codex thread.
- Added runtime method `knowledge.repo.codex.feedback`.
- Added Electron/preload APIs for feedback.
- Added a feedback textarea in the Knowledge right-side Codex executor.
- Users can now:
  - approve final content by using `Push via App` or manual Git push;
  - reject/request revisions by typing feedback and sending it back to Codex for another local update pass.

## Validation

- `py -3 -m py_compile runtime\src\harness_runtime\executors\codex\app_server.py runtime\src\harness_runtime\api\app.py`
- `.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit`
- `pnpm.cmd --filter @harness/desktop typecheck`
