# GitHub Release Workflow Follow-up

## Scope

- Keep the completed run in `KNOWLEDGE_PROMOTION`; do not reset gates.
- Turn release defaults into an operational, user-confirmed GitHub Release workflow.

## Implementation

- Added GitHub CLI and repository capability probing for the selected project.
- Added native multi-file asset selection, release tag/title/notes, draft and overwrite controls.
- Added create and update flows using argument-array `gh` execution without shell interpolation.
- Existing releases use edit plus optional asset upload; new releases use create with `HEAD` as target.
- Release publishing is protected by the authoritative `gitPush` policy.
- Added tag validation, regular-file asset validation, status display, and release URL handoff.

## Verification Plan

- GitHub release tag/argument unit tests - PASS.
- Desktop and renderer typechecks and tests - PASS.
- Renderer production build - PASS.
- Live publish was not executed because no user-selected target tag/assets were supplied and `gh` is not installed on this host; the Probe state reports this explicitly.
