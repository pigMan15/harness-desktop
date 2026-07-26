# Provider-aware Managed Execution Follow-up

## Scope

- Keep the completed run in `KNOWLEDGE_PROMOTION`; do not reset gates.
- Remove Codex-only assumptions from managed Execution and Knowledge protocol boundaries.

## Implementation

- Added provider selection to managed Execution probe/start IPC and runtime RPC.
- Persisted executor provider in session projections and routed poll/respond/cancel through the owning adapter.
- Added provider selection to Knowledge synthesis start requests.
- Added a Claude Code stream-json adapter with managed Execution, Knowledge synthesis, cancellation, and resumed feedback.
- Claude events are normalized into shared output/tool/exited events; capability metadata explicitly reports non-interactive `acceptEdits` semantics and lack of Codex-style per-tool approvals.
- Replaced misleading Codex-only page language with provider-aware labels and controls.
- Applied authoritative `commandExecution` policy to managed Execution start.

## Verification Plan

- Runtime Claude event conversion and provider-routing tests - PASS.
- Runtime full suite - PASS, 257 passed / 1 skipped.
- Desktop and renderer typechecks/tests - PASS.
- Renderer production build - PASS.
- Live Claude subprocess smoke was not possible because `claude` is not installed on this host; configured-path probing remains available in Settings.
