# Change Request

- Change id: `multirun-codex-terminal-implementation-20260724`
- Type / risk: `FEATURE / HIGH` (authoritative state; unchanged)
- Approved scope: complete multi-run, worktree, native Codex PTY, node lifecycle, Workflow Studio, dynamic gate/artifact, recovery/diagnostics, testing, packaging, and GitHub delivery specification.
- Source branch: `main` at `25f40ac918c3880c07d8d116fcd1eef000ae46cf`.
- Target branch: `codex/multirun-codex-terminal`.
- Existing changes: preserve project-import/bootstrap source/tests, regenerated Runtime binary/build metadata, historical phase/run evidence, and prior package directories. Do not revert or delete them.
- Commit scope: include the pre-existing source changes where they are part of the current working baseline, all new feature source/tests/docs, current run artifacts/snapshot, and final checksums. Exclude obsolete generated build trees and prior package directories unless required as the final release artifact.
- Release target: `origin` (`git@github.com:pigMan15/harness-desktop.git`), with binary packages preferably uploaded as GitHub release assets.
- Rollback: revert the feature commit and withdraw release assets; do not rewrite authoritative run snapshots or delete user worktrees.
- Status: approved by the user's explicit implementation and publication request.

## Delivery update (2026-07-25)

- The user explicitly selected release version `0.2.0` and requested that the completed Harness route and G3-G8 PASS decisions remain intact.
- Package, Forge, Runtime client metadata, changelog, and packaging docs must report `0.2.0`; the rebuilt assets receive supplemental release verification before merge and publication.
- The user explicitly declined another test run for this metadata-only adjustment; the interrupted supplemental pnpm processes were stopped, and the previously recorded G3-G8 evidence remains the acceptance basis.
- Delivery uses a fast-forward update of `main` from the isolated branch so the dirty main worktree is not checked out or overwritten.
