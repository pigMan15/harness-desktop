# Troubleshooting

## Runtime Unavailable

Symptoms:

- Home page shows `Runtime unavailable`.
- Electron IPC returns `Runtime not started`.

Checks:

```powershell
$env:HARNESS_RUNTIME_TOKEN = "dev-token"
python -m harness_runtime.main
```

Confirm that the Runtime prints a loopback port and that Electron is using the same token.

## Protocol Or Project Validation Fails

Checks:

- `.harness/state.json` exists and is valid JSON.
- `.harness/workflow.yaml` exists and has valid node, role, gate, route, and recovery references.
- `state.phase_dir` resolves inside `.harness/phases/<run-id>`.
- `completed_nodes` is a subset of `required_nodes`.

Use the Projects page or Runtime project validation API to inspect diagnostics.

## Gate Cannot Pass

Common causes:

- Required artifact is missing, empty, or outside `phase_dir`.
- `15-evidence.json` is not valid JSON or misses required fields.
- G3-G8 was evaluated by a non-verifier role.
- A waiver lacks scope, reason, owner, or time.

Do not manually force a PASS in project state. Fix the artifact/evidence or record a valid waiver.

## Execution Or Approval Issues

Checks:

- Fake executor is available for local integration tests.
- Codex adapter returns an actionable diagnostic when Codex is missing.
- Dangerous deploy/delete/Git actions require second confirmation.
- Broad shell or Python prefixes must not be approved as reusable policy.

## Packaging Issues

Checks:

```powershell
.\scripts\package-runtime.ps1
pnpm --filter @harness/desktop package
```

Unsigned artifacts can be used for development packaging checks, but they do not prove release signing, update, or clean Windows VM installation success.
