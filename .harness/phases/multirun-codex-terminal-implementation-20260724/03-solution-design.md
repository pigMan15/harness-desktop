# Solution Design

## Current Context

The repository already has a three-process boundary: sandboxed React renderer, Electron Main/typed preload, and a token-protected Python Runtime. Runtime has authoritative run snapshots, optimistic revisions, atomic writes, a workflow compiler, draft validation, version primitives, ZIP security checks, gate evaluation, and initial Git worktree support. The incomplete path is vertical integration: UI still models one `activeRun`, Execution uses Runtime's Codex app-server adapter, Electron has no PTY manager/settings, node lifecycle RPCs are missing, workflow features are only partially surfaced, gate artifacts are hardcoded, and native packaging has no node-pty rebuild/unpack path.

## Recommended Design

### ADR-1: Run-bound native PTY

- Status: accepted
- Decision: Electron Main spawns the configured absolute Codex executable through `node-pty`; xterm.js renders the native TUI. Runtime never proxies terminal byte streams.
- Ownership key: `projectId + runId + nodeId`; one active Codex session per key.
- Security: Main requests `run.executionContext`, uses its canonical worktree/cwd, and accepts only a session id plus bounded input/resize operations from preload.

### ADR-2: Run snapshot authority

- Status: accepted
- Decision: every run mutation reads/writes `.harness/runs/<run_id>/state.json` under optimistic revision. Root state is updated only when that run is selected.
- Selection is a UI/project-registry concern and does not stop sessions or mutate other snapshots.

### ADR-3: Explicit workflow transitions

- Status: accepted
- Decision: `node.complete`, `node.confirm`, and `node.reject` validate expected revision, current node, role/confirmation semantics, and the configured artifact inside phase_dir before atomically advancing through Dispatcher logic.
- PTY exit updates only terminal projection; it never advances a node.

### ADR-4: Atomic workflow versioning

- Status: accepted
- Decision: all structured/YAML/ZIP edits become a full YAML draft, compile with project agents/gates and system minimum rules, show semantic diff, confirm against expected hash under project lock, atomically replace workflow.yaml, and save the previous/new versions. Existing run routes remain frozen.

## Affected Modules

- Shared contracts/schema: `packages/contracts/src/rpc.ts`, `schemas/rpc.schema.json`.
- Runtime API/services: `runtime/src/harness_runtime/api/app.py`, `runs/service.py`, `runs/worktrees.py`, new `nodes/service.py`, `workflow/drafts.py`, `workflow/versioning.py`, `workflow/zip_io.py`, `gates/engine.py`, `artifacts/service.py`, `persistence/database.py`, recovery/diagnostics services.
- Electron Main: new `terminal-manager.ts`, `codex-discovery.ts`, settings store/probe helpers; update `index.ts`, `runtime-supervisor.ts`, Forge/Vite packaging.
- Preload: typed terminal/settings/run/node/workflow/gate/diagnostic APIs and event unsubscribe handles.
- Renderer state/routes: `WorkspaceContext` becomes `selectedRunId + runsById + terminalSessionsById`; routes carry project/run context.
- Renderer features: Runs lifecycle and badges; xterm Terminal page; Codex Settings; Workflow/Gates/Artifacts run context; complete/confirm/reject controls; full Workflow Studio inspector/routes/rules/recovery/YAML/versions/import/export.
- Tests: Runtime service/API/security tests, Desktop discovery/TerminalManager/IPC tests, Renderer state/terminal/studio tests, Playwright multi-run/workflow scenarios, packaged smoke scripts.
- Dependencies: `node-pty`, `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-search`, Lucide icons; Electron rebuild and asar unpack settings.

## Data Flow

1. Renderer selects project/run and calls typed preload with explicit ids.
2. Main forwards business calls to Runtime; Runtime resolves the registered project root and authoritative run snapshot.
3. Terminal create asks Runtime for execution context, validates Codex settings/probe, enforces ownership/concurrency, and spawns node-pty directly in the returned canonical cwd.
4. Main emits typed terminal data/status/exit events containing session/project/run/node/sequence; renderer ignores nonmatching ownership and retains summaries for all runs.
5. Node completion/confirmation goes through Runtime, validates artifact and revision, updates snapshot atomically, refreshes selected projection if applicable, writes audit, and returns the new revision.
6. Workflow apply validates the complete content twice, performs semantic diff and expected-hash locking, atomically writes, versions, and broadcasts; existing snapshots are untouched.

## Compatibility

- Keep `.harness` schema_version 1.0 and tolerate absent new state fields, database tables, settings, terminal projections, and version metadata.
- Add database columns/tables idempotently; projections are rebuildable.
- Retain legacy app-server executor and old API methods for diagnostic/backward compatibility, but remove primary UI calls.
- Maintain `activeRun` as a temporary derived selector while new components use `selectedRunId/runsById`; remove it only after consumers migrate.
- Preserve existing project import/bootstrap changes and current packaged Runtime wiring.
- Existing runs retain `required_nodes`; only newly created runs compile against an applied workflow version.

## Rollback

- Feature flag the PTY/Terminal route; reverting the renderer route returns to the legacy diagnostic Execution page without changing run state.
- New SQLite data is additive and rebuildable; rollback ignores new tables/columns rather than deleting them.
- Workflow apply stores versions and current hash; restore uses the same validation/atomic apply path.
- Terminal shutdown stops children and records interruption before process exit; no node state rollback is needed because terminal and node state are separate.
- Source rollback reverts the release commit; packaged release assets remain hash-addressed and can be withdrawn without editing project `.harness` data.

## Rejected Alternatives

- Codex app-server as primary execution: rejects native TUI, login, ANSI, Ctrl+C, resize, and user-requested terminal semantics.
- Renderer-controlled spawn/cwd: violates sandbox and ownership boundaries.
- Shared project-root execution for convenience: creates unacceptable cross-run overwrite risk.
- Automatic node completion on process exit: bypasses artifacts, confirmation, revisions, and gate authority.
- Replacing linear v1 workflow with a DAG engine: outside scope and incompatible with the existing protocol.
- One large generic IPC `invoke(method,args)`: weakens allowlisting and exposes capabilities the renderer must not own.

## Design Gate Readiness

Affected modules, interfaces, compatibility, and rollback are explicit. G2 remains NOT_RUN until `05-pre-mortem.md` and `06-implementation-plan.md` are completed.
