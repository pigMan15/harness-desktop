# Coding Design Confirmation

## Recommended Implementation

Build the feature as five vertical slices, each with contract tests before implementation:

1. Runtime authority: run archive/execution context, mandatory worktree preparation, node complete/confirm/reject, dynamic gates/waivers, artifact hash, workflow import/export/version restore, terminal projections, diagnostics.
2. Main process: Codex settings/discovery and a run-bound `TerminalManager` using node-pty.
3. Typed boundary: explicit preload methods and ownership-bearing terminal events; no generic invoke/spawn API.
4. Renderer: normalized multi-run workspace, xterm terminal/settings, run-scoped pages and node controls.
5. Workflow Studio/release: full linear editor, recovery/rules/YAML/versions/import/export, E2E, package and GitHub assets.

Each slice follows red test -> minimum implementation -> focused test -> broader test. Legacy app-server code stays available only as diagnostic compatibility code.

## Architecture Style

- Preserve the existing layered architecture: React Renderer -> typed Preload -> Electron Main -> authenticated Runtime for business state.
- Runtime is a modular monolith with small domain services; `.harness/runs/<run_id>/state.json` remains authoritative.
- Electron Main is an OS capability adapter, not a second business-rule engine.
- Renderer uses a normalized store (`selectedRunId`, `runsById`, `terminalSessionsById`) and derives compatibility selectors.
- Keep workflow v1 linear and data-driven; do not introduce DAG abstractions.

## Design Patterns

- Command service for `node.complete/confirm/reject`, run mutations, gate waiver/evaluate, and workflow apply so validation and atomic mutation remain one boundary.
- Registry pattern for `TerminalManager`: `Map<sessionId, PtySession>` plus an ownership index keyed by project/run/node; explicit lifecycle state machine.
- Adapter pattern for node-pty and Codex discovery so tests inject fake processes/probes without exposing arbitrary spawn.
- Repository/projection pattern for rebuildable SQLite terminal/workflow metadata while `.harness` files remain authoritative.
- Optimistic concurrency via expected revision/hash; no distributed transaction abstraction.

## Module Boundaries

- `runtime/runs`: create/list/select/pause/resume/archive/executionContext and worktree requirements.
- `runtime/nodes`: artifact/confirmation validation, Dispatcher advance, audit, selected projection.
- `runtime/gates`: project gate config, permissions, waiver metadata, failure recovery and retry limits.
- `runtime/workflow`: full draft compile/diff/apply/import/export/version/restore.
- `runtime/artifacts`, `recovery`, `diagnostics`, `persistence`: safe reads/hashes and rebuildable projections.
- `desktop/main/codex-discovery.ts`: candidate enumeration/probe/settings only.
- `desktop/main/terminal-manager.ts`: PTY lifecycle, limits, ownership, sequence, scrollback/redaction, shutdown.
- Preload: named allowlisted methods and event subscriptions with unsubscribe functions.
- Renderer workspace: project/run/session normalization and selection persistence.
- Renderer pages: terminal/settings/runs/workflow/gates/artifacts consume only workspace ids and typed APIs.

## Frontend/Backend Contracts

- Every run business call includes `projectId` and `runId`; mutations include `expectedRevision`.
- `run.executionContext` returns authoritative node/role/phase/worktree/branch and terminal allow/block fields; renderer cannot override cwd or executable.
- Terminal create accepts only projectId/runId/kind/size; Main derives node/cwd/executable. Events always include sessionId/projectId/runId/nodeId/sequence/status or data.
- Node decisions carry decision/comment/revision; Runtime derives whether confirmation is required.
- Workflow apply/restore carries expected hash; import returns a preview/diff and never writes immediately.
- Gate waiver requires scope/reason/owner/time; G3-G8 permissions remain Runtime-derived.

## Existing Code Reuse

- Reuse `read_run_state`, `write_run_state`, `write_selected_run_projection`, project locks, atomic files and audit events.
- Extend `ensure_run_worktree` rather than adding a second Git manager.
- Reuse compiler/system minimum rules, `validate_draft_content`, semantic diff, workflow version service and ZIP security checks.
- Replace gate artifact hardcoding with data loaded through the existing protocol loader.
- Reuse Electron `runtimeCall`, secure BrowserWindow preferences and project import dialog patterns.
- Preserve current WorkspaceContext consumers with a derived `activeRun` during migration.

## Rejected Approaches

- Generic IPC/RPC passthrough: expands renderer authority and weakens validation.
- Runtime-proxied terminal bytes or app-server primary execution: does not deliver native TUI behavior.
- A new global state framework: Zustand already exists, but Context plus normalized records is sufficient and matches the current application.
- Duplicated workflow model in Renderer: Runtime compiler remains the semantic authority.
- Automatic worktree fallback, node completion on exit, or renderer-supplied role/gate status: violates required safety rules.
- Physical run/worktree deletion in this change: archive is the default lifecycle operation.

## Chinese Comment Strategy

- Add short Chinese comments only around business invariants: authoritative run snapshot versus selected projection, worktree no-fallback rule, terminal ownership/concurrency, Runtime-derived cwd/executable, node/artifact/confirmation authority, workflow atomicity, gate permission/retry behavior, shutdown interruption, and diagnostics redaction.
- Do not narrate ordinary assignments, React rendering, straightforward adapters, or test setup.
- Record the final commented files and the invariant explained in `11-development.md`.

## Risks and Rollback

- node-pty ABI/package risk: pin/rebuild/unpack, test early; keep a Terminal feature flag until packaged smoke passes.
- State migration risk: additive optional fields/tables and derived compatibility selectors; rollback ignores projections without deleting data.
- Cross-run leakage: immutable ownership on all session operations/events and concurrency tests; stop all sessions and disable route on failure.
- Workflow corruption: double validation, expected hash, lock, atomic replace and stored versions; restore through the same path.
- Existing changes: keep work isolated in the dedicated worktree and do not stage old generated outputs from the main worktree.
- Release failure: retain local commit/packages/checksums and report the exact GitHub/signing/VM blocker without claiming a pass.

## User Confirmation Required

Please confirm this coding design before implementation. Confirmation authorizes the five vertical slices and the named contract changes, but does not authorize code signing, destructive run deletion, force-push, or fabricated external-environment evidence.

## Confirmation Record

- Decision: ACCEPT
- Confirmed by: user response `继续`
- Date: 2026-07-24
- Authorized scope: all five vertical slices and named contract changes above.
