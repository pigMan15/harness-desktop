# Workflow Studio Guide

## Purpose

Workflow Studio is the UI and Runtime surface for editing `.harness/workflow.yaml` without weakening `.harness` v1.0 constraints.

## Current Scope

- Load the current project workflow.
- Compile routes for a chosen Intent/Risk.
- Produce diagnostics for invalid workflow definitions.
- Compare workflow YAML through semantic diff support.
- Apply workflow updates through Runtime APIs.
- Keep active run routing frozen: changing `workflow.yaml` affects new runs, not an already-started run.

## Safety Model

Workflow changes must preserve system minimum rules:

- Code-changing routes include `COMPILE`, `UNIT_TEST`, and `EVIDENCE_CAPTURE`.
- `HIGH` routes include confirmation and pre-mortem nodes.
- `HIGH` or `DEPLOYMENT` routes include pre-release and interface checks.
- G3-G8 gate status changes stay in the verifier permission domain.
- Custom workflows remain linear for v1; DAGs, parallel execution, and dynamic branches are future protocol work.

## Typical Flow

1. Open Workflow.
2. Select Intent and Risk.
3. Compile or simulate the route.
4. Review diagnostics.
5. Edit or import YAML.
6. Review semantic diff.
7. Apply with the expected workflow hash.

## Known Gaps

- Renderer-level Workflow Studio Vitest files are not present yet.
- Full Playwright E2E coverage for custom workflow editing is not present yet.
- Activity migration for already-started runs should remain a CHANGE_REQUEST workflow, not an implicit route rewrite.
