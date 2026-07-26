# Settings Language Switch Follow-up

## Requirement

Add a persistent application language selector to Settings. Switching language must apply immediately and survive application restart, settings import/export, and reset.

## Design

- Add normalized `language` to renderer and Main-process settings schemas.
- Default to Simplified Chinese and support `zh-CN` / `en-US`.
- Provide a dependency-free React language context with typed translation keys.
- Translate the global navigation, workspace header, and Settings surface.
- Keep provider names, CLI output, repository data, and protocol status values unchanged.

## Verification

- `pnpm.cmd --filter @harness/renderer typecheck`: PASS.
- `pnpm.cmd --filter @harness/desktop typecheck`: PASS.
- `pnpm.cmd --filter @harness/renderer test`: PASS, 9 files / 31 tests after button coverage follow-up.
- `pnpm.cmd --filter @harness/desktop test`: PASS, 7 files / 40 tests.
- `pnpm.cmd --filter @harness/renderer build`: PASS.
- Existing Vite bundle-size warning remains informational.

## Acceptance Result

- Settings exposes Simplified Chinese and English choices.
- The selected language immediately updates Settings, global navigation, and the workspace header.
- Language is persisted in both local renderer storage and the atomic Main-process settings file.
- Existing settings without a language field normalize to Simplified Chinese.
- Settings import, export, and reset preserve or reapply the language.

## Button Coverage Follow-up

- Localized visible action buttons and icon-button tooltips in Projects, Runs, Terminal, Workflow, Gates, Artifacts, Knowledge, AI Execution, Recovery, and Workflow Studio.
- Preserved Harness node IDs, gate IDs, intent/risk values, provider names, YAML/ZIP format names, and runtime status payloads as protocol data.
- Added a source-contract test requiring every primary module to consume the language context for actions.
