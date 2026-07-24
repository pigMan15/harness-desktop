# Changelog

## v0.2.0 (2026-07-25)

- Added authoritative multi-Run selection, archive, execution context, revisions, and mandatory isolated Git worktrees.
- Added native Codex and shell terminals with node-pty/ConPTY, Codex discovery/settings, per-Run ownership, concurrency limits, restart, resize, and redacted durable summaries.
- Added explicit node complete/confirm/reject APIs; terminal exit remains independent from workflow progression.
- Added dynamic Gate definitions/artifacts, custom Gates, audited waivers, configured retry recovery, and BLOCKED closure.
- Completed Workflow Studio routes, node inspector, recovery/rules/YAML tabs, import/export, semantic diff, versions, and restore.
- Added multi-Run renderer state, run-scoped Terminal/Workflow/Gates/Artifacts, diagnostics export, focused tests, and Playwright ATDD.

## v0.0.0-dev (unreleased)

### M1 — Desktop Foundation
- pnpm workspace + Electron Forge + React + FastAPI skeleton
- .harness v1.0 compatibility fixtures (1 valid + 8 invalid)
- TypeScript + Python RPC contracts
- Runtime health check with token authentication
- Secure Electron shell (contextIsolation, sandbox, CSP)

### M2 — Core State Machine
- Protocol Adapter (Pydantic models + YAML/JSON loader + 17-rule validator)
- SQLite project registry + atomic state store with project lock
- Workflow compiler with SYSTEM_MINIMUM_RULES
- Run lifecycle service + dispatcher with human confirmations
- Gate engine (deterministic checks, permissions, retry→BLOCKED)
- Artifact service (safe path, SHA-256, preview)

### M3 — Workflow Studio
- Workflow draft service (SQLite-backed, compile→diff→apply)
- Version history + ZIP import/export (Zip Slip protection)
- React Flow visual canvas + Node Catalog + Route Editor + Diagnostics Panel

### M4 — Codex & Approval
- Executor adapter contract (probe/start/stream/respond/cancel/recover)
- Fake executor for integration testing
- Codex adapter (subprocess, event parser, graceful cancel)
- Approval policy (8 categories, forbidden prefixes, second confirmation)

### M5 — Recovery & Release
- Audit projection + request idempotency
- Recovery service (crash recovery, orphan cleanup, temp file cleanup)
- Knowledge promotion (draft→review→accept/reject)
- Windows packaging (PyInstaller + Electron Forge Squirrel)
- User guide + troubleshooting docs
