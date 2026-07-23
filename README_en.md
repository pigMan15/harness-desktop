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

## Packaging

Preferred commands:

```powershell
.\scripts\package-runtime.ps1
.\scripts\package-desktop.ps1
```

If Windows PowerShell 5 cannot run PowerShell 7 syntax in `scripts/package-runtime.ps1`, or Electron Forge fails during download/package work with `read ECONNRESET`, use this verified fallback path.

```powershell
# 1. Rebuild Runtime from source
cd runtime
python -m pip install -e ".[dev]"
python -m PyInstaller harness-runtime.spec --clean --noconfirm
cd ..

# 2. Copy the fresh Runtime into desktop resources
New-Item -ItemType Directory -Force -Path dist,apps\desktop\resources | Out-Null
Copy-Item runtime\dist\harness-runtime.exe dist\harness-runtime.exe -Force
Copy-Item runtime\dist\harness-runtime.exe apps\desktop\resources\harness-runtime.exe -Force

# 3. Use local Electron dist to create a clean unpacked desktop app
$env:ELECTRON_OVERRIDE_DIST_PATH = (Resolve-Path "node_modules\electron\dist").Path
pnpm exec electron-packager apps\desktop "Harness Desktop" `
  --platform=win32 `
  --arch=x64 `
  --electron-version=31.7.7 `
  --out=dist\desktop-unpacked `
  --overwrite `
  --asar `
  --extra-resource=apps\desktop\resources\harness-runtime.exe `
  --executable-name="Harness Desktop" `
  --ignore=out `
  --ignore=out-fresh `
  --ignore=node_modules

# 4. Build the Squirrel.Windows installer
node -e "const { createWindowsInstaller } = require('electron-winstaller'); createWindowsInstaller({ appDirectory: 'dist/desktop-unpacked/Harness Desktop-win32-x64', outputDirectory: 'dist/desktop-installer', authors: 'Harness Desktop', exe: 'Harness Desktop.exe', setupExe: 'Harness Desktop-0.0.0 Setup.exe', noMsi: true, name: 'harness-desktop' }).then(() => console.log('installer ok')).catch((err) => { console.error(err); process.exit(1); });"
```

Successful outputs:

- `dist/desktop-installer/Harness Desktop-0.0.0 Setup.exe`
- `dist/desktop-installer/harness-desktop-0.0.0-full.nupkg`
- `dist/desktop-installer/RELEASES`
- `dist/desktop-unpacked/Harness Desktop-win32-x64/Harness Desktop.exe`

Do not place the fresh package output under `apps/desktop`; old `out/` directories can be packed into `app.asar` and inflate the installer. After packaging, verify `dist/desktop-unpacked/Harness Desktop-win32-x64/resources/harness-runtime.exe` size and timestamp to ensure it came from the fresh Runtime build.

## Documentation

- Architecture: `doc/desktop-architecture.md`
- Implementation plan: `doc/desktop-implementation-plan.md`
- User guide: `docs/user-guide.md`
- Workflow Studio guide: `docs/workflow-studio.md`
- Troubleshooting: `docs/troubleshooting.md`
- Changelog: `CHANGELOG.md`

## Verification Boundaries

The repository contains unit, contract, security, and runtime tests. Some release-level requirements still need external evidence, especially clean Windows VM install/upgrade/uninstall validation, real code signing, update infrastructure, and full Playwright E2E scenarios.
