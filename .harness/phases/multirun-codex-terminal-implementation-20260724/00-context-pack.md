# Context Pack

## Task Source

- RunId: `multirun-codex-terminal-implementation-20260724`
- Intent / Risk: `FEATURE / HIGH` (fixed by the user-created run)
- Product specification: `.harness/phases/multirun-codex-terminal-workflow-20260724/19-knowledge-promotion.md`
- Architecture inputs: `doc/desktop-architecture.md`, `doc/desktop-implementation-plan.md`
- Requested delivery: implement all specified capabilities, commit source and packaged Windows software to GitHub.
- Date: 2026-07-24

## Requirement Summary

Harness Desktop must become a multi-run workbench where each run owns an authoritative snapshot, revision, phase directory, isolated worktree, Codex PTY terminal, and run-scoped Workflow/Gate/Artifact views. Electron Main owns the PTY and Codex discovery; the sandboxed renderer only uses typed preload APIs. Runtime remains the authority for run lifecycle, node completion and confirmation, dynamic gates, workflow compile/import/export/versioning, and session projections. Existing runs retain frozen routes while new workflow versions affect only new runs. The complete 20-item acceptance set in the source specification is one release scope.

## Relevant Business Knowledge

| Topic | Summary | Source |
| --- | --- | --- |
| Run authority | `.harness/runs/<run_id>/state.json` is authoritative; root state is only the selected-run projection. | Product specification ADR-3 |
| Terminal model | Run-bound native Codex TUI through node-pty/ConPTY, not app-server, is the primary execution path. | Product specification ADR-1 |
| Process boundary | Electron Main owns spawn, cwd and executable selection; renderer stays sandboxed. | Product specification ADR-2 |
| Worktree safety | Every code-changing run requires an isolated worktree or becomes BLOCKED. | Product specification ADR-4 |
| Node lifecycle | Terminal exit never completes a Harness node; explicit complete/confirm plus artifact and revision validation is required. | Product specification ADR-5 |
| Workflow semantics | v1 remains linear; compile/apply must validate system minimum rules and atomically version changes. | `.harness/workflow.yaml`, workflow compiler |

## Relevant Historical Experience

| Type | Conclusion | Source |
| --- | --- | --- |
| audit | Current app-server integration does not provide the requested native Codex terminal experience. | `.harness/phases/feature-audit-codex-integration-20260724/19-knowledge-promotion.md` |
| pitfall | A failing WindowsApps Codex candidate must not stop discovery of a usable Hermes/PATH executable. | Product specification section 6 |
| pitfall | Package output inside the Desktop source tree can recursively inflate app.asar. | `README.md` packaging notes |
| decision | Existing project-import/bootstrap changes are preserved as user work and treated as the compatibility baseline. | Current working tree |
| decision | Existing app-server executor remains diagnostic code but is removed from the primary Execution UI. | Product specification section 14 |

## Current Code Anchors and Gaps

- Contracts: `packages/contracts/src/rpc.ts` currently exposes active-run and app-server execution APIs; it needs run-scoped lifecycle, node, workflow, gate waiver, artifact hash, terminal projection and diagnostics contracts.
- Desktop Main/Preload: `apps/desktop/src/main/index.ts`, `runtime-supervisor.ts`, and preload files have no TerminalManager, Codex settings or bounded terminal event IPC.
- Renderer: `WorkspaceContext.tsx` stores one `activeRun`; `ExecutionPage.tsx` is an app-server event log; no xterm or Codex Settings page exists.
- Runtime: `api/app.py` lacks archive/executionContext, node complete/confirm/reject, workflow import/export/versions/restore, gate waive and diagnostics APIs.
- Run layer: `runs/service.py` lists independent snapshots but selection and mutation coverage is incomplete; worktree isolation is only lazily applied in the legacy execution path.
- Workflow/Gate persistence: compiler, drafts, versioning, zip I/O and gate engine provide reusable foundations but are not fully surfaced through business APIs and the renderer.
- Packaging: Desktop has no native PTY dependency/rebuild/unpack configuration and current packaging evidence predates this feature.

## Business Invariants

- Preserve `.harness` v1 compatibility and frozen `required_nodes` for existing runs.
- Never infer or overwrite user-selected intent/risk.
- All business APIs carry explicit `projectId + runId` when operating on run state.
- Root `.harness/state.json` mirrors only the selected run and never overwrites another run snapshot.
- Renderer cannot access Node, arbitrary shell, filesystem, raw executable or cwd controls.
- G3-G8 remain verifier-only; terminal activity cannot bypass confirmation or gate authority.
- Workflow apply is validate-then-atomic and cannot partially modify project files.
- Existing user changes and release artifacts are not reverted or silently discarded.

## Questions Resolved by the Request

- Scope phasing: no deferral; all work packages and all 20 acceptance criteria are in this release.
- Primary Codex transport: native PTY/TUI.
- Target platform: Windows x64 installer plus unpacked application evidence.
- Git delivery: commit and publish source plus package assets to the repository's GitHub destination.
- Existing app-server: retain for diagnostics only, do not use from the primary UI.

## Risk Judgment

- Recorded Intent: FEATURE
- Recorded Risk: HIGH
- Risk drivers: native module ABI and packaging; concurrent run/worktree state; PTY process ownership; filesystem and spawn security; large cross-layer RPC migration; state compatibility; release upload size and GitHub limits.

## Knowledge Sources

- Harness run: `.harness/phases/multirun-codex-terminal-workflow-20260724/19-knowledge-promotion.md`
- Architecture: `doc/desktop-architecture.md`, `doc/desktop-implementation-plan.md`
- Code: Runtime API/run/workflow/gate services, Desktop Main/Preload, Renderer workspace/execution/workflow pages, shared contracts, packaging scripts.
- Current tree: existing uncommitted project-import/bootstrap work and previously generated package outputs.
