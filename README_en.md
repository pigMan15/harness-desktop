<p align="center">
  <a href="README.md">中文</a> &nbsp;|&nbsp;
  <a href="README_en.md">English</a>
</p>

# Harness Desktop

> A desktop workbench that turns `.harness` engineering constraints into observable, approvable, recoverable, and auditable AI Coding workflows.

**Current version: 0.2.0** · Windows first · Electron + React + Python Runtime · Native Codex Terminal

Harness Desktop is designed for projects that use AI coding agents continuously. It does not replace Codex or hide governance rules inside a prompt. It makes projects, runs, worktrees, nodes, gates, artifacts, approvals, recovery, and knowledge promotion visible in one desktop application.

The project `.harness/` directory remains the source of truth. Desktop SQLite data is a rebuildable local projection.

## Why Harness Desktop

Long-running AI Coding work commonly suffers from missing project instructions, shared-workspace conflicts, unsynchronized workflow state, invisible approvals, unrecoverable sessions, and knowledge trapped in chat history. Harness Desktop maps those concerns to explicit engineering objects and deterministic Runtime operations.

## Main Capabilities

| Area | Current capability |
| --- | --- |
| **Projects** | Import `.harness` projects; initialize or repair `.harness`, `AGENTS.md`, and `CLAUDE.md` in ordinary Git repositories; merge managed guidance and Git-stage it without committing. |
| **Runs** | Create, select, pause, resume, and archive Runs while preserving user-defined Intent/Risk; development Runs use isolated Git branches and worktrees. |
| **Merge Back** | Merge a Run branch into the current project branch from the UI with clean-worktree and fast-forward safety checks. |
| **Terminal** | Independent Codex/Shell PTY per Run with ANSI, Unicode, paste, search, resize, scrollback, Ctrl+C, stop, and restart. |
| **Workflow** | Inspect and edit nodes, roles, artifacts, gates, routes, recovery, and YAML; import/export, semantic diff, and version restore. |
| **Gates** | View G1-G8; enforce verifier-only G3-G8 decisions; structured waivers, retries, and BLOCKED routing. |
| **Artifacts** | Read phase artifacts safely from the authoritative Run/worktree, render Markdown, preview text, and calculate hashes. |
| **Knowledge** | Card-based review, shared Git knowledge repositories, Chinese Codex synthesis, local diff preview, queued approvals, human feedback, in-app push, and pushed-count labels. |
| **Recovery** | Automatically scan recoverable Codex/Terminal sessions when entering the page, with manual refresh, stop, and orphan cleanup. |
| **Settings** | Discover or select Codex CLI without storing Codex account tokens. |

## Typical Workflow

```text
Import project
  -> initialize/repair Harness files and Git-stage them
  -> create a Run with Intent and Risk
  -> create an isolated branch/worktree for development
  -> run Codex in the native Terminal
  -> create the required phase artifact
  -> explicitly complete/confirm the node
  -> validate revision, artifact, and gates in Runtime
  -> merge the clean Run branch back
  -> review knowledge candidates and update a shared knowledge repository
```

A terminal process exiting never advances a Harness node. Dispatcher progress only happens after an explicit operation passes Runtime validation.

## Git Worktrees and Merge Back

Runs that require DEVELOPMENT receive an isolated directory under:

```text
.<repository>-harness-worktrees/<run-id>/
```

Harness metadata and root guidance files are synchronized into the worktree so Codex continues to follow `.harness`, `AGENTS.md`, and `CLAUDE.md`.

Merge Back requires both the target workspace and Run worktree to be clean. Missing branches, detached HEAD, and missing worktrees are rejected. The default strategy is fast-forward only; diverged branches must be rebased and conflicts resolved on the Run branch first.

## Shared Knowledge Repository

The Knowledge module can promote accepted records into a separate Git repository:

1. Configure Local Path, Remote URL, and Branch.
2. Pull or clone the shared repository.
3. Select accepted knowledge candidates.
4. Run Codex Synthesis. Codex reads the repository's own rules and templates first.
5. Review Chinese execution logs, queued approvals, and the local Git diff.
6. Send human feedback for another revision or accept the result.
7. Push through the app or use Git manually.

A successful **Push via App** adds a `Pushed` label. Repeated promotion increments the count while the candidate remains Accepted and selectable.

The page uses an adaptive layout: candidates use the full width while idle, and the execution rail opens automatically when Codex or a preview is active.

## Architecture

```text
React Renderer
  -> typed contextBridge API
Electron Main
  -> Runtime Supervisor, IPC, dialogs, node-pty
Python Runtime
  -> protocol, state, runs, gates, executors, recovery, knowledge
Project .harness/
```

- Renderer has no direct Node, shell, or filesystem authority.
- Electron Main owns OS integration, PTY sessions, and Runtime lifecycle.
- Python Runtime is the controlled write path for Harness state, with path validation, locks, revisions, atomic writes, and snapshots.
- Packaged builds use the bundled `harness-runtime.exe`; development builds let Electron start `py -3 -m harness_runtime.main` automatically.

## Install

Download the Windows installer for version 0.2.0 from [GitHub Releases](https://github.com/pigMan15/harness-desktop/releases).

The current installer is intended for development distribution and may be unsigned. Production distribution still requires code-signing and clean-VM install, upgrade, and uninstall evidence.

## Development

Requirements:

- Windows 10/11
- Node.js 18+
- pnpm 8+
- Python 3.11+
- Git
- Codex CLI for Terminal and Knowledge synthesis

```powershell
pnpm install
py -3 -m pip install -e "runtime[dev]"
pnpm --filter @harness/desktop dev
```

Electron automatically creates the Runtime token, starts the Python Runtime, reads its loopback port, and performs the authenticated handshake.

## Verification

```powershell
pnpm typecheck
pnpm test
py -3 -m pytest runtime/tests -q
pnpm test:e2e
```

The repository includes Runtime unit tests, protocol contract tests, security tests, concurrent terminal tests, and Playwright scenarios. The README intentionally does not freeze a test-count number.

## Packaging

Preferred commands:

```powershell
.\scripts\package-runtime.ps1
.\scripts\package-desktop.ps1
```

Or run Electron Forge directly:

```powershell
pnpm --filter @harness/desktop package
```

Expected Windows outputs include the 0.2.0 Setup executable, full NuGet package, `RELEASES`, and an unpacked executable. Do not place fresh package output inside `apps/desktop`, because stale `out/` directories can be included in `app.asar`. See [Troubleshooting](docs/troubleshooting.md) for Electron download fallback and Runtime rebuild steps.

## Repository Layout

```text
harness-desktop/
├─ apps/desktop/          Electron Main, Preload, PTY, Runtime Supervisor
├─ apps/renderer/         React UI, Workflow, Terminal, Knowledge
├─ runtime/               Python Runtime and tests
├─ packages/contracts/    shared TypeScript contracts
├─ schemas/               frozen state and RPC schemas
├─ fixtures/harness-v1/   valid and invalid protocol fixtures
├─ scripts/               Runtime and Desktop packaging
├─ docs/                  user-facing documentation
└─ .harness/              this repository's authoritative workflow state
```

## Security Boundaries

- Runtime listens only on `127.0.0.1` and uses an Electron-generated one-time token.
- Renderer cannot directly execute shell or filesystem operations.
- Project, artifact, and ZIP paths are normalized and checked for escape attempts.
- Codex approvals are classified into command, file, network, deploy, delete, permission, and Git categories.
- Generic shell or Python prefixes cannot become persistent approval rules.
- Codex credentials stay with Codex CLI; Harness Desktop does not store account tokens.

## Current Boundaries

- Windows is the primary supported platform.
- Code signing, auto-update infrastructure, and clean-VM installer lifecycle validation remain release-level work.
- Git pushes performed outside the app do not automatically increment Knowledge pushed-count labels.
- Workflow Studio targets `.harness` v1.0 linear routes and gates; it is not a general DAG orchestrator.

## Documentation

- [User Guide](docs/user-guide.md)
- [Workflow Studio](docs/workflow-studio.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Desktop Architecture](doc/desktop-architecture.md)
- [Implementation Plan](doc/desktop-implementation-plan.md)
- [Changelog](CHANGELOG.md)

## License

[MIT](LICENSE) © 2026 pigMan
