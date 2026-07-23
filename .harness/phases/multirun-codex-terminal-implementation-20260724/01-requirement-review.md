# Requirement Review

## Goal

Deliver Harness Desktop as a production-ready Windows multi-run AI coding workbench. Users can create and switch independent Harness runs, run the native Codex TUI in a secure run-bound PTY, complete and confirm workflow nodes under Runtime authority, fully edit/version/import/export linear workflows, inspect run-scoped gates and artifacts, recover interrupted sessions, and install the packaged application without system Python or Node dependencies.

## Scope

- Authoritative per-run snapshots, revisions, phase directories, selected-run projection, pause/resume/archive, and explicit run context on every page and business API.
- Mandatory isolated Git worktrees for code-changing runs, with safe branch/path creation, conflicts, diagnostics, and cleanup protections.
- Codex executable discovery from user setting, `HARNESS_CODEX_PATH`, Hermes locations, and PATH; every candidate is directly probed with `--version`.
- Electron Main `TerminalManager` using node-pty/ConPTY, one active session per run/node, bounded concurrency, ownership checks, write/resize/stop/restart, scrollback, interruption state, and redacted diagnostics.
- Sandboxed typed preload terminal/settings APIs and an xterm.js Execution workspace supporting ANSI, Chinese input, paste, resize, Ctrl+C, clear, search, copy, stop, and restart.
- Runtime APIs for run lifecycle/execution context, node complete/confirm/reject, workflow compile/preview/diff/apply/import/export/versions/restore, gates/evaluate/waive, artifacts/read/hash, terminal projections, and diagnostics export.
- Complete linear Workflow Studio covering nodes, roles, artifacts, gates, all routes, hard/effective rules, failure recovery, YAML, semantic diff, import/export, undo/redo, versions, and restore.
- Dynamic gate required-artifact evaluation, custom gates, auditable waivers, retry routing, and BLOCKED closure.
- Runtime, Desktop, Renderer, E2E, real Codex, concurrent-run, workflow, packaged-app, and Windows installer verification with recorded evidence.
- Source commit, Windows installer/unpacked deliverables, GitHub push, and release asset publication where repository permissions support it.

## Non-Goals

- Codex `app-server --stdio` as the primary execution path or structured ToolCall/ApprovalRequested integration for the PTY.
- Reimplementing Codex's native TUI approval screens, authentication, or credential storage.
- A general provider gateway, MCP/ACP registry, autonomous multi-agent collaboration, DAG workflows, loops, or conditional expressions.
- Reattaching raw PTY processes after application restart; only durable summaries and a new session in the same run are required.
- Automatic physical deletion of authoritative run directories or worktrees without a distinct confirmed destructive workflow.

## Acceptance Criteria

- [ ] AC-01: Creating runs A, B, and C yields distinct `runs/<run_id>/state.json`, `phase_dir`, and revision values; list APIs return all three.
- [ ] AC-02: Every code-changing run has a distinct canonical worktree and branch; creation failure returns a diagnostic BLOCKED state and never falls back to the shared project root.
- [ ] AC-03: Selecting any run updates only the selected-run projection and persisted UI selection; refresh restores it without mutating other run snapshots.
- [ ] AC-04: Workflow, Gates, Artifacts, Runs, and Terminal views display and call APIs with the same explicit projectId/runId context.
- [ ] AC-05: Codex PTY sessions for run A and run B can be running concurrently with separate cwd, input, output, sequence, and session identifiers.
- [ ] AC-06: Switching selected run does not stop, rebind, or mix an existing session; stopping run A leaves run B running.
- [ ] AC-07: A second active Codex session for the same project/run/node is rejected, while configured project/global limits are enforced independently.
- [ ] AC-08: Discovery continues after an inaccessible WindowsApps candidate and selects a later valid user/environment/Hermes/PATH candidate whose `codex --version` exits 0.
- [ ] AC-09: In the packaged app, Codex TUI renders ANSI, accepts Chinese/paste, resizes, handles Ctrl+C, and supports stop/restart with correct terminal status.
- [ ] AC-10: Security tests prove renderer sandboxing, typed IPC allowlists, Runtime-derived cwd/executable ownership, and rejection of arbitrary spawn/path/session access.
- [ ] AC-11: `node.complete` rejects stale revisions, missing/empty/escaping artifacts and invalid current nodes; valid completion advances the first incomplete required node atomically.
- [ ] AC-12: Confirmation nodes require accept/reject/defer metadata; terminal exit never completes a node; G3-G8 cannot be marked by a non-verifier.
- [ ] AC-13: Gate required artifacts come from project gate configuration; custom gates and waivers with scope/reason/owner/time are listed and evaluated.
- [ ] AC-14: Gate failure increments retry count and follows configured recovery; the third failure beyond a max of two returns BLOCKED with a recorded reason.
- [ ] AC-15: Workflow Studio creates/edits/copies/reorders custom nodes and edits role, safe artifact, gates, and every supported intent/risk route.
- [ ] AC-16: Recovery and rules views edit max retries and gate targets, show effective hard rules, and support stable undo/redo without corrupting the draft.
- [ ] AC-17: YAML/ZIP import, YAML/ZIP export, semantic diff, apply, version list, and restore work end-to-end with manifest/hash and referenced role/gate files.
- [ ] AC-18: Invalid workflows and unsafe ZIP entries do not change workflow hash; valid apply is atomic and affects only runs created afterward.
- [ ] AC-19: Desktop/Runtime shutdown marks active terminal projections interrupted, preserves bounded/redacted diagnostics, and never advances the Harness node.
- [ ] AC-20: focused and full Runtime/Desktop/Renderer tests, concurrent-run and workflow E2E, real Codex smoke, packaged smoke, installer artifact checks, and available clean-Windows validation are recorded with command, exit code, output, hashes, and explicit waivers/risks.

## Open Questions

- Resolved: all specification work packages are one release scope; no P0/P1/P2 deferral is authorized.
- Resolved: native Codex PTY is primary; app-server remains diagnostic-only.
- Resolved: existing uncommitted project-import/bootstrap work must be preserved and included only where compatible.
- Release credentials, GitHub release permissions, code-signing certificate, and a clean Windows VM are environmental dependencies. Missing access must be recorded as an explicit release risk; it does not permit fabricating evidence.

## Risk Notes

- Native node-pty ABI and Squirrel packaging can fail late; verify rebuild/unpack and packaged ConPTY early and again at release.
- Cross-layer API migration can create mixed old/new run semantics; contracts and ownership tests must land before UI migration.
- Existing dirty-tree changes overlap Runtime/Desktop files; edits must be additive and reviewed by diff, never reverted.
- Raw terminal logs may contain secrets; diagnostics require bounded storage and redaction tests.
- GitHub file-size and release-asset limits can prevent committing binary packages directly; release assets are the preferred publication channel, with hashes committed as evidence.

## G1 Evaluation

- Required artifact `01-requirement-review.md`: present and non-empty.
- Goal and in/out scope: explicit.
- Acceptance criteria: 20 observable criteria with concrete state, API, UI, security, packaging, and evidence outcomes.
- Open questions: product decisions resolved; external release dependencies explicitly recorded.
- Result: PASS.
