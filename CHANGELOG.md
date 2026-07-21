# Changelog

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
