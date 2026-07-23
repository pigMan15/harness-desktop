# Implementation Plan

## Goal

Implement the accepted full-scope multi-run, native Codex terminal, workflow lifecycle, gate/artifact, recovery, and Windows release capabilities as testable vertical slices while preserving existing project import/bootstrap changes and `.harness` v1 compatibility.

## Assumptions

- Node, pnpm, Python, Git, Codex CLI, PyInstaller, and Electron dependencies are available locally or can be installed with approved network access.
- GitHub remote/auth can be inspected before publication; binaries will use GitHub release assets when normal Git limits make source commits inappropriate.
- A missing signing certificate or clean VM is reported as a release waiver/blocker, never inferred as passing.
- The existing dirty tree is user-owned. New edits are reviewed additively and no existing changes are reverted.

## Task List

### 1. Contracts and authoritative run lifecycle

- Tests first: extend `runtime/tests/runs/test_run_service.py`, `test_worktree_manager.py`, API tests, and `packages/contracts/tests/rpc.test.ts` for three runs, selected projection, archive, execution context, explicit ids, revisions, and mandatory worktrees.
- Edit: `packages/contracts/src/rpc.ts`, `schemas/rpc.schema.json`, `runtime/src/harness_runtime/runs/service.py`, `runs/worktrees.py`, `persistence/state_store.py`, `api/app.py`.
- Verify: `python -m pytest runtime/tests/runs runtime/tests/api -q`; `pnpm --filter @harness/contracts test`; `pnpm --filter @harness/contracts typecheck`.

### 2. Node completion and confirmation

- Tests first: add `runtime/tests/nodes/test_service.py` and API tests for missing/empty/escaping artifacts, stale revision, confirmation decisions, Dispatcher advance, audit, and terminal-exit independence.
- Edit: new `runtime/src/harness_runtime/nodes/service.py`, `nodes/__init__.py`; update dispatcher/state store/audit/API and contracts.
- Verify: `python -m pytest runtime/tests/nodes runtime/tests/workflow/test_dispatcher.py runtime/tests/api -q`.

### 3. Dynamic gates, artifacts, workflow API/version I/O

- Tests first: extend gate/workflow/artifact tests for project `gates.yaml`, custom gates, waiver metadata, retry max, full-route preview, invalid atomicity, ZIP manifest/hash, import/export, versions, and restore.
- Edit: `gates/engine.py`, `protocol/loader.py`, `artifacts/service.py`, `workflow/drafts.py`, `versioning.py`, `zip_io.py`, `api/app.py`, `persistence/database.py`, contracts/schema.
- Verify: `python -m pytest runtime/tests/gates runtime/tests/artifacts runtime/tests/workflow runtime/tests/api -q`.

### 4. Codex settings and discovery

- Tests first: add `apps/desktop/tests/codex-discovery.test.ts` for user/env/Hermes/PATH order, inaccessible candidate continuation, version validation, and persistence.
- Edit: new `apps/desktop/src/main/codex-discovery.ts` and settings store; update `index.ts`, preload declarations, renderer declarations, contracts.
- Verify: `pnpm --filter @harness/desktop test -- codex-discovery`; `pnpm --filter @harness/desktop typecheck`.

### 5. TerminalManager and native packaging

- Install/pin `node-pty`; tests first in new `apps/desktop/tests/terminal-manager.test.ts` for ownership, duplicate sessions, limits, write/resize/stop/restart, sequence, exit, shutdown interruption, scrollback and redaction.
- Edit: new `apps/desktop/src/main/terminal-manager.ts`; update `index.ts`, preload API/index, `apps/desktop/package.json`, `forge.config.ts`, Vite configs and lockfile.
- Verify: Desktop focused tests/typecheck, Electron rebuild, a local echo-shell PTY smoke, then packaged PTY smoke.

### 6. Multi-run workspace and Terminal UI

- Install/pin xterm core/fit/search and Lucide. Tests first: update `WorkspaceContext.test.ts`, Execution tests, and add terminal hook tests for independent sessions and selection.
- Edit: `WorkspaceContext.tsx`, `RunsPage.tsx`, new `features/terminal/TerminalPage.tsx` and `useTerminalSession.ts`, new `features/settings/CodexSettingsPage.tsx`, `App.tsx`, `Sidebar.tsx`, `styles.css`, renderer package/lockfile.
- Migrate Workflow/Gates/Artifacts pages to explicit selected run and retain a temporary derived `activeRun` compatibility selector.
- Verify: `pnpm --filter @harness/renderer test`; `pnpm --filter @harness/renderer typecheck`; `pnpm --filter @harness/renderer build`.

### 7. Node controls and complete Workflow Studio

- Tests first: extend workflow draft tests and add component tests for inspector, all routes, recovery/rules/YAML/version tabs, undo/redo, confirmation controls, import/export and restore.
- Edit: `features/workflow-studio/**`, `features/workflow/WorkflowPage.tsx`, `features/gates/GatesPage.tsx`, `features/artifacts/ArtifactsPage.tsx`, terminal header/actions, preload/contracts.
- Verify: Renderer focused/full tests plus Runtime workflow/gate tests.

### 8. Recovery, terminal projection, diagnostics

- Tests first: Runtime database/recovery tests and Desktop terminal tests for durable summaries, active-session uniqueness, interrupted shutdown, bounded/redacted exports.
- Edit: `persistence/database.py`, recovery service, new diagnostics service, API, TerminalManager and settings UI.
- Verify: focused Runtime/Desktop tests with injected secret values and crash/shutdown cases.

### 9. ATDD and E2E

- Add/update Playwright scenarios under `tests/e2e/` for runs A/B/C, concurrent terminals, switching/stopping ownership, node completion, workflow import/apply/frozen routes, invalid hash stability, and interruption.
- Run a real configured `codex --version` and native PTY smoke; record executable source/version without secrets.
- Verify: `pnpm test:e2e` plus dedicated scripts placed in this run's phase_dir when scenario orchestration is release-specific.

### 10. Full build, package, evidence, and GitHub delivery

- Run Python full tests, all pnpm tests/typechecks/build, Runtime PyInstaller, Desktop Forge/Squirrel package, unpacked Runtime health, package resource hashes, and packaged Terminal smoke.
- Update `README.md`, `README_en.md`, user guide, workflow guide, troubleshooting, architecture, implementation plan, changelog, and package scripts only for delivered behavior.
- Write `12-compile.md`, `13-unit-test.md`, `14-atdd.md`, `15-evidence.json`, prerelease/interface reports and acceptance mapping under this phase_dir.
- Create a scoped commit preserving existing user changes, push the current branch, create/update GitHub release, upload Setup/NUPKG/RELEASES and checksums, and verify remote assets.

## Verification Plan

- Focused red/green commands are listed per task and must record the initial expected failure when practical.
- Compile gate: Python compile/import smoke, TypeScript typecheck, renderer build, Electron Forge package.
- Unit gate: full `python -m pytest runtime/tests -q` and `pnpm test` with zero unexplained failures.
- ATDD gate: concurrent run/PTTY, workflow atomicity/frozen routes, real Codex and packaged-app scenarios.
- Release gate: Runtime executable hash, packaged embedded Runtime hash, Setup/NUPKG/RELEASES hashes, app startup/health, terminal smoke, and GitHub asset verification.
- Security: Electron webPreferences, IPC allowlist, arbitrary spawn/cwd rejection, path containment, ZIP security, session ownership, and redaction.

## Rollback Plan

- Keep feature commits cohesive and preserve a feature flag for the Terminal route until packaged smoke passes.
- Roll back UI/IPC without deleting additive SQLite data or authoritative `.harness` snapshots.
- Restore workflow only through validated stored versions; never directly overwrite from renderer.
- Stop/mark sessions interrupted before downgrade; legacy diagnostic executor remains available.
- Withdraw bad GitHub assets, publish corrected hash-addressed assets, or revert the feature commit while retaining release evidence.

## G2 Evaluation

- `03-solution-design.md`: identifies architecture, interfaces, modules, compatibility, and rollback.
- `05-pre-mortem.md`: identifies high-risk failures, detection, rollback, gates, and stop conditions.
- `06-implementation-plan.md`: names exact files/modules and focused/full verification commands.
- Result: PASS.
