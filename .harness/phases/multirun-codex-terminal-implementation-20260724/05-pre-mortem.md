# Pre-Mortem

## Failure Modes

| Failure mode | Cause | Prevention | Detection | Rollback |
| --- | --- | --- | --- | --- |
| Native terminal works in dev but not packaged | node-pty ABI mismatch, asar packing, missing ConPTY helper | Pin compatible versions, Electron rebuild, asarUnpack native files, package early | Packaged PTY smoke runs input/output/resize/Ctrl+C | Disable PTY feature flag and withdraw package |
| Codex discovery stops at WindowsApps alias | First candidate error treated as terminal | Enumerate and probe every source independently | Unit test inaccessible first candidate then valid Hermes/PATH candidate | User-selected absolute path; revert discovery module |
| Session output appears under another run | UI selection used as ownership or missing ids/sequence | Immutable session ownership and ids on every event | Concurrent A/B event interleaving tests and renderer filtering | Stop sessions, disable terminal route, retain summaries |
| Two agents edit shared root | worktree failure silently falls back | Runtime requires canonical worktree for code-changing routes | Worktree failure test asserts BLOCKED and no spawn | Block run; never launch in project root |
| Root projection overwrites another run | run mutation reads root state | All run APIs use authoritative run snapshot and selected-only projection | Three-run revision and snapshot hash tests | Restore snapshot from run directory/audit |
| Terminal exit completes a node | process and workflow state coupled | Separate terminal projection from node service | Exit-0 test asserts current node unchanged | Restore run snapshot; disable completion UI |
| Node completion bypasses artifact/role/revision | trust renderer parameters | Runtime derives node/role and validates artifact containment and revision | Missing/empty/escape/stale/non-verifier tests | Reject mutation; retry from authoritative snapshot |
| Workflow editor corrupts project config | partial writes or incomplete validation | Full compile, expected hash, project lock, atomic replace, versions | Invalid YAML/ZIP leaves hash unchanged; restore E2E | Restore prior validated workflow version |
| Gate behavior differs from project config | standard artifact map remains hardcoded | Load gates.yaml dynamically with custom gate support | Custom gate/required artifact/waiver/retry tests | Revert gate service and restore state snapshot |
| Terminal logs expose secrets | raw scrollback copied to diagnostics | bounded local storage and redaction allowlist/deny patterns | tests with Authorization/token/secret env samples | Delete diagnostic export and rotate exposed credential |
| Existing import/bootstrap fix regresses | overlapping edits or broad refactor | Preserve current diffs and add focused regression tests | existing project import suite plus packaged scenarios | Revert only new integration changes |
| Installer published without required runtime | stale resource copied or nested package output | clean output outside source tree; compare source/resource/package hashes | unpacked resource hash and startup smoke | Withdraw release assets and republish corrected build |
| Unit tests pass but real Codex cannot run | mocks miss TUI/login/Windows environment | real configured Codex smoke and packaged smoke | version/TUI/input/interrupt evidence | record BLOCKED, do not claim AC-09/20 |
| GitHub delivery fails | credentials, file limits, network, or release permission | inspect remote/auth/limits before publish; use release assets for binaries | git push and GitHub release command outputs | keep local commit/packages and report exact blocker |

## Test Strategy

- Runtime unit/API: authoritative snapshots, selected projection, archive/context, worktrees, node lifecycle, dynamic gates/waivers/retries, workflow imports/versions, artifacts/hashes, diagnostics.
- Desktop unit: discovery ordering, direct probes, settings persistence, TerminalManager ownership/concurrency/lifecycle/redaction, IPC allowlists and teardown.
- Renderer unit: selected run persistence, independent session summaries, event filtering, terminal controls, node decisions, workflow draft undo/redo and global editors.
- Contract/type/build: Python tests, TypeScript tests, typecheck, renderer build, Electron Forge package.
- ATDD/E2E: three runs, two concurrent PTYs, explicit node progression, workflow import/apply/frozen route, shutdown interruption.
- Release: real Codex smoke, packaged Runtime health, packaged PTY smoke, installer file/hash inspection; clean Windows VM only when environment exists.

## Gate Expectations

- G1_REQUIREMENTS: PASS, backed by `01-requirement-review.md`.
- G2_DESIGN: PASS only after solution, pre-mortem, and implementation plan include files, rollback, and commands.
- G3_COMPILE: verifier records exact typecheck/build/package commands and exit codes.
- G4_UNIT_TEST: verifier records focused and full Python/Vitest results with no unexplained failure.
- G5_ATDD: verifier records multi-run, workflow, real Codex, and packaged scenarios; unavailable external environments require explicit waiver/blocker.
- G6_EVIDENCE: JSON contains changed files, commands, artifacts, hashes, gates, waivers, and residual risks.
- G7_PRERELEASE: package environment/version and smoke/interface results are both present.
- G8_ACCEPTANCE: maps all 20 criteria to evidence and does not overstate unavailable validation.

## Rollback Expectations

- Keep schema migrations additive and new projection data rebuildable.
- Preserve prior workflow versions and package hashes.
- Stop PTYs before Desktop shutdown and never use node-state mutation as cleanup.
- Keep legacy diagnostic executor available behind a nonprimary route during migration.
- Revert the feature commit or disable Terminal routes without rewriting user run snapshots.

## Stop Conditions

- Any code-changing run can execute in the shared project root after worktree creation fails.
- Renderer can choose an executable/cwd or access a session owned by another project/run/node.
- Terminal exit or renderer input can mark G3-G8 or complete a confirmation node.
- Workflow validation failure changes the on-disk workflow hash.
- Cross-run event mixing, revision overwrite, secret leakage, or destructive cleanup is observed.
- Build/test/package failures remain unexplained after two harness-directed retries.
- Required GitHub or external environment access is absent and no honest waiver/blocker can satisfy the acceptance contract.
