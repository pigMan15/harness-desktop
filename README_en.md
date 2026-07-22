<p align="center">
  <a href="README.md">中文</a> &nbsp;|&nbsp;
  <a href="README_en.md">English</a>
</p>

# Harness Desktop

Harness Desktop is a desktop workbench for governing AI Coding workflows. It turns `.harness` v1.0 constraints into a workflow that is observable, approvable, recoverable, and auditable.

Windows first · Strict `.harness` v1.0 compatibility · Drives Codex and other external Coding Agents

## Architecture

```text
React Renderer
  -> typed preload API
Electron Main
  -> localhost runtime with one-time token
Python Harness Runtime
  -> project .harness/
```

- Renderer has no Node, shell, or direct filesystem authority.
- Electron Main owns OS integration and Runtime lifecycle, but does not implement workflow business logic.
- Python Runtime is the only business write path for `.harness` state, gates, artifacts, and snapshots.

## Quick Start

```powershell
pnpm install
python -m pip install -e "runtime[dev]"

$env:HARNESS_RUNTIME_TOKEN = "dev-token"
python -m harness_runtime.main

pnpm --filter @harness/desktop dev
```

Useful checks:

```powershell
python -m pytest runtime/tests -q
pnpm typecheck
pnpm test
```

## Project Structure

```text
harness-desktop/
  apps/
    desktop/          Electron Forge main/preload shell
    renderer/         React renderer pages and workflow UI
  runtime/
    src/harness_runtime/
      api/            FastAPI health and JSON-RPC endpoints
      protocol/       .harness v1.0 loader and validator
      workflow/       compiler, dispatcher, drafts, versioning
      runs/           run lifecycle service
      gates/          deterministic gate engine and permissions
      artifacts/      safe artifact reader
      executors/      fake, Bridle, and Codex adapters
      approvals/      approval policy
      recovery/       recovery checks and cleanup
      knowledge/      promotion review flow
      persistence/    SQLite, audit, locking, atomic state store
  packages/contracts/ shared TypeScript contracts
  schemas/            frozen state and RPC schemas
  doc/                architecture and implementation plan
  docs/               user-facing guides
```

## Current Capability

| Area | Current implementation |
| --- | --- |
| Projects and Runs | Import/list/validate projects; create/list runs with user supplied intent/risk. |
| Workflow | Read, compile, diff, apply, simulate, draft, version, and ZIP workflow support. |
| Gates and Artifacts | Deterministic gate checks, verifier-only G3-G8 policy, safe artifact preview. |
| Execution | Runtime execution API with Fake, Bridle, and Codex adapter foundations. |
| Approvals | Policy classification for file, command, network, deploy, delete, permission, and Git actions. |
| Recovery and Knowledge | Recovery scans/cleanup and reviewed knowledge promotion. |
| Packaging | PyInstaller spec, runtime packaging script, Electron Forge Squirrel maker. |

## Documentation

- Architecture: `doc/desktop-architecture.md`
- Implementation plan: `doc/desktop-implementation-plan.md`
- User guide: `docs/user-guide.md`
- Workflow Studio guide: `docs/workflow-studio.md`
- Troubleshooting: `docs/troubleshooting.md`
- Changelog: `CHANGELOG.md`

## Verification Boundaries

The repository contains unit, contract, security, and runtime tests. Some release-level requirements still need external evidence, especially clean Windows VM install/upgrade/uninstall validation, real code signing, update infrastructure, and full Playwright E2E scenarios.
