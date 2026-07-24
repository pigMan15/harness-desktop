# Workflow Studio Guide

## Purpose

Workflow Studio is the UI and Runtime surface for editing `.harness/workflow.yaml` without weakening `.harness` v1.0 constraints.

## Current Scope

- Edit every supported Intent/Risk route without changing active runs' frozen routes.
- Create, duplicate, reorder, remove, and edit custom nodes, roles, safe artifact names, and gates.
- Edit failure recovery retry limits and targets; compare project and effective hard rules.
- Edit complete YAML with Runtime validation.
- Produce diagnostics for invalid workflow definitions.
- Import YAML or manifest/hash-verified ZIP, and export YAML or ZIP through native dialogs.
- Compare semantic diff, apply with an expected hash, list versions, and restore through the same validated atomic path.
- Keep active run routing frozen: changing `workflow.yaml` affects new runs, not an already-started run.

## Safety Model

Workflow changes must preserve system minimum rules:

- Code-changing routes include `COMPILE`, `UNIT_TEST`, and `EVIDENCE_CAPTURE`.
- `HIGH` routes include confirmation and pre-mortem nodes.
- `HIGH` or `DEPLOYMENT` routes include pre-release and interface checks.
- G3-G8 gate status changes stay in the verifier permission domain.
- Custom workflows remain linear for v1; DAGs, parallel execution, and dynamic branches are future protocol work.

## Typical Flow

1. Open Workflow Studio and select a global tab.
2. In Routes, choose Intent/Risk and edit the linear timeline. Use Inspector for role, artifact, and gate fields.
3. Review Recovery and Rules, or edit the complete YAML.
4. Select Preview and resolve all Runtime diagnostics.
5. Review semantic diff and select Apply. The expected hash prevents stale writes.
6. Use Versions to restore a previous version; restore is validated and creates a new version record.

Already-started runs are intentionally never migrated by Workflow apply. Route migration remains an explicit CHANGE_REQUEST workflow.
