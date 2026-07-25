# Version bump to 0.2.1

## Scope

- Bump the desktop release version from `0.2.0` to `0.2.1`.
- Keep package metadata, Forge packaging metadata, Runtime Supervisor version, packaging alignment test, and README release references consistent.

## Files changed

- `apps/desktop/package.json`
- `apps/desktop/forge.config.ts`
- `apps/desktop/src/main/runtime-supervisor.ts`
- `apps/desktop/tests/packaging-config.test.ts`
- `README.md`

## Notes

- This is an incremental record appended to the completed `run-merge-back-feature-20260725` run.
- The existing Harness run remains in `DONE / KNOWLEDGE_PROMOTION`; no gates were reset.

## Validation

- `pnpm.cmd --filter @harness/desktop test` passed: 5 files, 32 tests.
- `pnpm.cmd --filter @harness/desktop typecheck` passed.
- `pnpm.cmd package` passed and generated Electron Forge Squirrel artifacts under `apps/desktop/out/make`.
