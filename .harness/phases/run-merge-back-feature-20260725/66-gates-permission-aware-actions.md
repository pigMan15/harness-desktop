# Gates Permission-Aware Actions Follow-up

## Problem

The Gates detail drawer exposed Evaluate and Create waiver actions even when the active run role could not operate verifier-only gates, or when a terminal status such as NOT_REQUIRED did not need a waiver.

## Implementation

- Mirror the Runtime verifier-only set for G3-G8 in the renderer.
- Disable evaluation before IPC when the current nextRole is not verifier.
- Preflight ordered batch evaluation and stop before making an unauthorized request.
- Show Create waiver only for NOT_RUN, FAIL, or BLOCKED gates with sufficient role permission.
- Hide waiver actions for PASS, WAIVED, and NOT_REQUIRED.
- Display the current role and a concise permission/status explanation in the detail drawer.
- Retain Runtime permission validation as the authoritative security boundary.

## Verification

- pnpm.cmd --filter @harness/renderer typecheck: PASS.
- pnpm.cmd --filter @harness/renderer test: PASS, 10 files / 33 tests.
- pnpm.cmd --filter @harness/renderer build: PASS.
