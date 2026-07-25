"""FastAPI application for Harness Desktop Runtime."""

import json
import hashlib
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .auth import PROTOCOL_VERSION, RUNTIME_VERSION, check_protocol_version, get_runtime_token, verify_token

app = FastAPI(title="Harness Desktop Runtime", version=RUNTIME_VERSION, docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:*", "http://localhost:*", "file://"],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type", "X-Harness-Desktop-Version"],
)

PROJECT_ROOT = Path(os.environ.get("HARNESS_PROJECT_ROOT", os.getcwd()))

# Initialize database on startup (idempotent)
try:
    from ..persistence.database import init_db
    init_db()
except Exception:
    pass

from ..executors.codex.adapter import CodexAdapter
from ..executors.codex.app_server import CodexAppServer

_codex_adapter = CodexAdapter(os.environ.get("HARNESS_CODEX_PATH", "codex"))
_knowledge_codex_sessions: dict[str, dict[str, Any]] = {}


@app.get("/health")
async def health(
    _token_ok: None = Depends(verify_token),
    _version_ok: None = Depends(check_protocol_version),
) -> dict[str, Any]:
    return {
        "status": "healthy",
        "runtime_version": RUNTIME_VERSION,
        "protocol_version": PROTOCOL_VERSION,
        "pid": os.getpid(),
        "python_version": os.sys.version,
    }


@app.post("/api")
async def api_rpc(
    request: Request,
    _token_ok: None = Depends(verify_token),
    _version_ok: None = Depends(check_protocol_version),
) -> dict[str, Any]:
    """JSON-RPC dispatcher for all Runtime methods."""
    body = await request.json()
    method = body.get("method", "")
    params = body.get("params", {}) or {}
    req_id = body.get("id", "")

    try:
        result = await _dispatch(method, params)
        return {"jsonrpc": "2.0", "result": result, "id": req_id}
    except Exception as e:
        return {"jsonrpc": "2.0", "error": {"code": "INTERNAL", "message": str(e)}, "id": req_id}


async def _dispatch(method: str, params: dict) -> Any:
    if method == "project.list":
        return _project_list()
    if method == "project.import":
        return _project_import(params.get("path", ""), params.get("decision"))
    if method == "project.validate":
        return _project_validate(params.get("path", ""))
    if method == "project.unregister":
        return _project_unregister(params.get("projectId", ""))
    if method == "project.repair":
        return _project_repair(params.get("projectId", ""))
    if method == "project.relocate":
        return _project_relocate(params.get("projectId", ""), params.get("path", ""))
    project_id, project_root = _require_project(params)
    if method == "run.list":
        return _run_list(project_root)
    if method == "run.create":
        return _run_create(
            project_id,
            project_root,
            params.get("intent", "FEATURE"),
            params.get("risk", "MEDIUM"),
            params.get("runId", ""),
            params.get("expectedRevision"),
        )
    if method == "run.switch":
        return _run_switch(
            project_id, project_root, params.get("runId", ""), params.get("expectedRevision")
        )
    if method == "run.pause":
        return _run_pause(
            project_root, params.get("runId", ""), params.get("expectedRevision")
        )
    if method == "run.resume":
        return _run_resume(
            project_root, params.get("runId", ""), params.get("expectedRevision")
        )
    if method == "run.archive":
        return _run_archive(
            project_id, project_root, params.get("runId", ""), params.get("expectedRevision")
        )
    if method == "run.mergeBack":
        return _run_merge_back(
            project_root, params.get("runId", ""), params.get("expectedRevision")
        )
    if method == "run.executionContext":
        return _run_execution_context(
            project_root, params.get("runId", ""), params.get("expectedRevision")
        )
    if method == "node.complete":
        return _node_complete(
            project_id, project_root, params.get("runId", ""), params.get("expectedRevision")
        )
    if method == "node.confirm":
        return _node_confirm(project_id, project_root, params)
    if method == "node.reject":
        return _node_reject(project_id, project_root, params)
    if method == "workflow.get":
        return _workflow_get(project_root, params.get("runId"))
    if method == "workflow.compile":
        return _workflow_compile(
            project_root, params.get("intent", "FEATURE"), params.get("risk", "MEDIUM")
        )
    if method == "workflow.preview":
        return _workflow_preview(project_root, params)
    if method == "workflow.diff":
        return _workflow_diff(project_root, params.get("yaml", ""))
    if method == "workflow.apply":
        return _workflow_apply(
            project_id,
            project_root,
            params.get("yaml", ""),
            params.get("hash", ""),
            params.get("author", "user"),
            params.get("summary", ""),
        )
    if method == "workflow.import":
        return _workflow_import(project_root, params)
    if method == "workflow.export":
        return _workflow_export(project_root, params.get("format", "yaml"))
    if method == "workflow.versions":
        return _workflow_versions(project_id)
    if method == "workflow.restore":
        return _workflow_restore(project_id, project_root, params)
    if method == "gate.list":
        return _gate_list(project_root, params.get("runId", ""))
    if method == "gate.evaluate":
        return _gate_evaluate(
            project_root,
            params.get("runId", ""),
            params.get("gateId", ""),
            params.get("expectedRevision"),
        )
    if method == "gate.waive":
        return _gate_waive(project_root, params)
    if method == "artifact.list":
        return _artifact_list(project_root, params.get("runId", ""))
    if method == "artifact.read":
        return _artifact_read(project_root, params.get("runId", ""), params.get("filename", ""))
    if method == "artifact.hash":
        return _artifact_hash(project_root, params.get("runId", ""), params.get("filename", ""))
    if method == "terminal.session.update":
        return _terminal_session_update(project_id, params.get("session", {}))
    if method == "terminal.session.list":
        return _terminal_session_list(project_id, params.get("runId"))
    if method == "diagnostics.export":
        return _diagnostics_export(project_id, project_root)
    if method == "knowledge.list":
        return _knowledge_list(project_id, project_root, params.get("status", "draft"))
    if method == "knowledge.review":
        return _knowledge_review(params.get("candidateId", 0), params.get("decision", "accepted"))
    if method == "knowledge.repo.status":
        return _knowledge_repo_status(project_id)
    if method == "knowledge.repo.configure":
        return _knowledge_repo_configure(
            project_id,
            params.get("localPath", ""),
            params.get("remoteUrl", ""),
            params.get("branch", ""),
        )
    if method == "knowledge.repo.inspectLocal":
        return _knowledge_repo_inspect_local(params.get("localPath", ""))
    if method == "knowledge.repo.pull":
        return _knowledge_repo_pull(project_id)
    if method == "knowledge.repo.synthesize":
        return _knowledge_repo_synthesize(project_id, project_root, params.get("candidateIds", []))
    if method == "knowledge.repo.codex.start":
        return await _knowledge_repo_codex_start(
            project_id,
            project_root,
            params.get("candidateIds", []),
            bool(params.get("allowDirty", False)),
        )
    if method == "knowledge.repo.codex.active":
        return _knowledge_repo_codex_active(project_id)
    if method == "knowledge.repo.codex.poll":
        return _knowledge_repo_codex_poll(project_id, params.get("sessionId", ""))
    if method == "knowledge.repo.codex.respond":
        return await _knowledge_repo_codex_respond(project_id, params.get("sessionId", ""), params.get("decision", {}))
    if method == "knowledge.repo.codex.feedback":
        return await _knowledge_repo_codex_feedback(project_id, params.get("sessionId", ""), params.get("feedback", ""))
    if method == "knowledge.repo.codex.cancel":
        return await _knowledge_repo_codex_cancel(project_id, params.get("sessionId", ""))
    if method == "knowledge.repo.push":
        return _knowledge_repo_push(project_id)
    if method == "execution.probe":
        return await _execution_probe()
    if method == "execution.start":
        return await _execution_start(
            project_id, project_root, params.get("runId", ""), params.get("expectedRevision")
        )
    if method == "execution.poll":
        return _execution_poll(project_id, params.get("runId", ""), params.get("sessionId", ""))
    if method == "execution.respond":
        return await _execution_respond(
            project_id, params.get("runId", ""), params.get("sessionId", ""), params.get("decision", {})
        )
    if method == "execution.cancel":
        return await _execution_cancel(project_id, params.get("runId", ""), params.get("sessionId", ""))
    if method == "recovery.scan":
        return _recovery_scan(project_id)
    if method == "recovery.cleanup":
        return _recovery_cleanup(project_root)
    raise ValueError(f"Unknown method: {method}")


def _require_project(params: dict) -> tuple[str, Path]:
    """Resolve every business request through the explicit project registry id."""
    from ..projects.service import resolve_project_root

    project_id = params.get("projectId", "")
    if not project_id:
        raise ValueError("PROJECT_ID_REQUIRED: select a project first")
    return project_id, resolve_project_root(project_id)


def _project_list() -> list[dict]:
    from ..projects.service import import_project, list_projects
    try:
        projects = list_projects()
        if projects:
            return projects
    except Exception:
        pass
    # 开发模式可注册启动目录，但注册成功后仍通过真实 projectId 访问，绝不返回伪 ID。
    root = PROJECT_ROOT
    harness = root / ".harness"
    if harness.is_dir():
        try:
            return [import_project(str(root))]
        except Exception:
            pass
    return []


def _project_import(path: str, decision: str | None = None) -> dict:
    from ..projects.service import import_project
    actual_path = path if path and path != '.' else str(PROJECT_ROOT)
    return import_project(actual_path, decision=decision)


def _project_validate(path: str) -> dict:
    from ..projects.service import validate_project
    return validate_project(path)


def _project_unregister(project_id: str) -> dict:
    from ..projects.service import unregister_project

    if not project_id:
        raise ValueError("PROJECT_ID_REQUIRED: select a project first")
    return {"unregistered": unregister_project(project_id), "projectId": project_id}


def _project_repair(project_id: str) -> dict:
    from ..projects.service import repair_project

    return repair_project(project_id)


def _project_relocate(project_id: str, path: str) -> dict:
    from ..projects.service import relocate_project

    return relocate_project(project_id, path)


def _run_list(project_root: Path) -> list[dict]:
    from ..runs.service import list_runs

    return list_runs(project_root)


def _run_create(
    project_id: str,
    project_root: Path,
    intent: str,
    risk: str,
    run_id: str,
    expected_revision: str | None,
) -> dict:
    from ..projects.service import update_active_run
    from ..runs.service import create_run_and_activate

    state, revision = create_run_and_activate(
        project_root, intent, risk, run_id, expected_revision=expected_revision
    )
    update_active_run(project_id, run_id)
    return {"run": state, "revision": revision}


def _run_switch(
    project_id: str,
    project_root: Path,
    run_id: str,
    expected_revision: str | None,
) -> dict:
    from ..projects.service import update_active_run
    from ..runs.service import switch_run

    state, revision = switch_run(project_root, run_id, expected_revision=expected_revision)
    update_active_run(project_id, run_id)
    return {"run": state, "revision": revision}


def _run_pause(project_root: Path, run_id: str, expected_revision: str | None) -> dict:
    from ..runs.service import pause_active_run

    state, revision = pause_active_run(project_root, run_id, expected_revision=expected_revision)
    return {"run": state, "revision": revision}


def _run_resume(project_root: Path, run_id: str, expected_revision: str | None) -> dict:
    from ..runs.service import resume_active_run

    state, revision = resume_active_run(project_root, run_id, expected_revision=expected_revision)
    return {"run": state, "revision": revision}


def _run_archive(
    project_id: str, project_root: Path, run_id: str, expected_revision: str | None
) -> dict:
    from ..runs.service import archive_run
    from ..terminals.projections import list_sessions

    # 活动 PTY 的权威投影在 SQLite；Run state 不嵌入 Main 管理的进程状态。
    if any(
        session.get("status") in {"starting", "running"}
        for session in list_sessions(project_id, run_id)
    ):
        raise RuntimeError("RUN_ARCHIVE_ACTIVE_SESSION")

    state, revision = archive_run(project_root, run_id, expected_revision)
    return {"run": state, "revision": revision}


def _run_merge_back(project_root: Path, run_id: str, expected_revision: str | None) -> dict:
    from ..runs.service import merge_run_back

    state, revision, merge = merge_run_back(project_root, run_id, expected_revision)
    return {"run": state, "revision": revision, "merge": merge}


def _run_execution_context(
    project_root: Path, run_id: str, expected_revision: str | None
) -> dict:
    from ..runs.service import get_execution_context

    return get_execution_context(project_root, run_id, expected_revision)


def _node_complete(
    project_id: str,
    project_root: Path,
    run_id: str,
    expected_revision: str | None,
) -> dict:
    from ..nodes.service import complete_node
    from ..persistence.audit import record_event

    result = complete_node(project_root, run_id, expected_revision)
    completed = result["run"].get("completed_nodes", [])
    node_id = completed[-1] if completed else None
    # 节点快照是权威状态；审计表仅在快照成功后记录可重建的操作投影。
    record_event(
        project_id,
        run_id,
        "node_completed",
        node_id=node_id,
        summary=f"Completed {node_id}; routed to {result['run'].get('current_node', '')}.",
    )
    return result


def _node_confirm(project_id: str, project_root: Path, params: dict) -> dict:
    from ..nodes.service import decide_node

    result = decide_node(
        project_root,
        params.get("runId", ""),
        params.get("decision", ""),
        params.get("comment", ""),
        params.get("confirmedBy", "user"),
        params.get("expectedRevision"),
    )
    _record_node_decision(project_id, params, result)
    return result


def _node_reject(project_id: str, project_root: Path, params: dict) -> dict:
    from ..nodes.service import reject_node

    result = reject_node(
        project_root,
        params.get("runId", ""),
        params.get("comment", ""),
        params.get("confirmedBy", "user"),
        params.get("expectedRevision"),
    )
    _record_node_decision(project_id, params, result)
    return result


def _record_node_decision(project_id: str, params: dict, result: dict) -> None:
    from ..persistence.audit import record_event

    confirmations = result["run"].get("confirmations", {})
    node_id = next(reversed(confirmations), None)
    confirmation = confirmations.get(node_id, {}) if node_id else {}
    decision = confirmation.get("decision", params.get("decision", "rejected"))
    actor = confirmation.get("confirmed_by", params.get("confirmedBy", "user"))
    comment = confirmation.get("comment", params.get("comment", ""))
    # 人工确认不能只存在于界面返回值，审计投影必须保留节点、决策和操作者。
    record_event(
        project_id,
        params.get("runId", ""),
        {
            "accepted": "node_confirmed",
            "rejected": "node_rejected",
            "deferred": "node_deferred",
        }.get(decision, "node_decided"),
        node_id=node_id,
        summary=f"Decision {decision} by {actor}: {comment}".rstrip(": "),
    )


def _workflow_get(project_root: Path, run_id: str | None = None) -> dict:
    from ..protocol.loader import load_gate_config, load_workflow
    from ..workflow.system_policy import get_effective_rules
    wf = load_workflow(project_root)
    workflow_path = project_root / ".harness" / "workflow.yaml"
    workflow_yaml = workflow_path.read_text(encoding="utf-8")
    if run_id:
        from ..persistence.state_store import read_run_state
        state, _ = read_run_state(project_root, run_id)
        if not state:
            raise ValueError(f"RUN_NOT_FOUND: {run_id}")
    else:
        state = json.loads((project_root / ".harness" / "state.json").read_text(encoding="utf-8"))
    agents_dir = project_root / ".harness" / "agents"
    roles = sorted(path.stem for path in agents_dir.glob("*.md") if path.is_file())
    gate_config = load_gate_config(project_root)
    return {
        "nodes": [{"id": n.id, "role": n.role, "artifact": n.artifact, "gates": n.gates} for n in wf.nodes],
        "routes": wf.routes,
        "state": {
            "run_id": state.get("run_id"),
            "status": state.get("status"),
            "intent": state.get("intent"),
            "risk": state.get("risk"),
            "current_node": state.get("current_node"),
            "completed_nodes": state.get("completed_nodes", []),
            "required_nodes": state.get("required_nodes", []),
        },
        "gate_meanings": wf.gate_meanings,
        "gate_definitions": gate_config["gates"],
        "roles": roles,
        "hard_rules": wf.hard_rules,
        "effective_hard_rules": get_effective_rules(wf.hard_rules),
        "failure_recovery": wf.failure_recovery,
        "yaml": workflow_yaml,
        "hash": hashlib.sha256(workflow_yaml.encode("utf-8")).hexdigest(),
    }


def _workflow_compile(project_root: Path, intent: str, risk: str) -> dict:
    from ..protocol.loader import load_workflow
    from ..workflow.compiler import simulate
    wf = load_workflow(project_root)
    return simulate(wf, intent, risk)


def _workflow_preview(project_root: Path, params: dict) -> dict:
    from ..workflow.drafts import preview_structured_draft

    return preview_structured_draft(
        project_root,
        params.get("nodes", []),
        params.get("intent", "FEATURE"),
        params.get("risk", "MEDIUM"),
        params.get("route", []),
        params.get("routes"),
        params.get("hardRules"),
        params.get("failureRecovery"),
        params.get("gateMeanings"),
    )


def _workflow_diff(project_root: Path, new_yaml: str) -> dict:
    from ..workflow.drafts import semantic_diff
    wf_path = project_root / ".harness" / "workflow.yaml"
    old_yaml = wf_path.read_text(encoding="utf-8") if wf_path.is_file() else ""
    return semantic_diff(old_yaml, new_yaml)


def _workflow_apply(
    project_id: str,
    project_root: Path,
    yaml: str,
    expected_hash: str,
    author: str,
    summary: str,
) -> dict:
    from ..workflow.drafts import apply_draft
    from ..workflow.versioning import save_version

    result = apply_draft(project_root, yaml, expected_hash if expected_hash else None)
    if result.get("success"):
        result["version"] = save_version(
            project_id, yaml, author=author, summary=summary or "Applied workflow"
        )
    return result


def _workflow_import(project_root: Path, params: dict) -> dict:
    import base64

    from ..workflow.drafts import semantic_diff, validate_draft_content
    from ..workflow.zip_io import import_workflow_zip

    fmt = params.get("format", "yaml")
    if fmt == "zip":
        encoded = params.get("content", "")
        try:
            package = import_workflow_zip(base64.b64decode(encoded, validate=True))
        except Exception as exc:
            return {"success": False, "error": str(exc)}
        candidate = package["workflow_yaml"]
    elif fmt == "yaml":
        candidate = params.get("content", "")
        package = {"agent_files": {}, "gate_yaml": None, "manifest": None}
    else:
        return {"success": False, "error": f"WORKFLOW_IMPORT_FORMAT: {fmt}"}
    validation = validate_draft_content(candidate, project_root)
    current = (project_root / ".harness" / "workflow.yaml").read_text(encoding="utf-8")
    structured = yaml.safe_load(candidate) if validation.get("success") else None
    return {
        **validation,
        "yaml": candidate,
        "base_hash": hashlib.sha256(current.encode("utf-8")).hexdigest(),
        "diff": semantic_diff(current, candidate),
        "agentFiles": sorted(package.get("agent_files", {})),
        "hasGateConfig": bool(package.get("gate_yaml")),
        "manifest": package.get("manifest"),
        "structured": structured,
    }


def _workflow_export(project_root: Path, fmt: str) -> dict:
    import base64

    from ..workflow.zip_io import export_workflow_zip

    workflow = (project_root / ".harness" / "workflow.yaml").read_text(encoding="utf-8")
    if fmt == "yaml":
        content = workflow.encode("utf-8")
        filename = "workflow.yaml"
    elif fmt == "zip":
        agents_dir = project_root / ".harness" / "agents"
        agents = {
            path.name: path.read_text(encoding="utf-8")
            for path in agents_dir.glob("*.md")
            if path.is_file() and not path.is_symlink()
        }
        gates_path = project_root / ".harness" / "evals" / "gates.yaml"
        content = export_workflow_zip(
            workflow,
            agents,
            gates_path.read_text(encoding="utf-8") if gates_path.is_file() else None,
        )
        filename = "harness-workflow.zip"
    else:
        return {"success": False, "error": f"WORKFLOW_EXPORT_FORMAT: {fmt}"}
    return {
        "success": True,
        "format": fmt,
        "filename": filename,
        "content": base64.b64encode(content).decode("ascii"),
        "sha256": hashlib.sha256(content).hexdigest(),
    }


def _workflow_versions(project_id: str) -> list[dict]:
    from ..workflow.versioning import list_versions

    return list_versions(project_id)


def _workflow_restore(project_id: str, project_root: Path, params: dict) -> dict:
    from ..workflow.versioning import restore_version

    return restore_version(
        project_id,
        project_root,
        int(params.get("versionId", 0)),
        params.get("hash", ""),
        params.get("author", "user"),
    )


def _gate_list(project_root: Path, run_id: str) -> dict:
    from ..persistence.state_store import read_run_state
    from ..protocol.loader import load_gate_config

    state, revision = read_run_state(project_root, run_id)
    if not state:
        raise ValueError(f"RUN_NOT_FOUND: {run_id}")
    config = load_gate_config(project_root)
    configured = config["gates"]
    statuses = {
        gate_id: state.get("gates", {}).get(gate_id, "NOT_RUN")
        for gate_id in configured
    }
    return {
        "runId": state.get("run_id", ""),
        "currentNode": state.get("current_node", ""),
        "nextRole": state.get("next_role", ""),
        "phaseDir": state.get("phase_dir", ""),
        "revision": revision,
        "gates": statuses,
        "definitions": configured,
        "waivers": state.get("waivers", {}),
    }


def _gate_evaluate(
    project_root: Path,
    run_id: str,
    gate_id: str,
    expected_revision: str | None,
) -> dict:
    from ..gates.engine import evaluate_gate
    from ..gates.permissions import check_gate_permission
    from ..persistence.state_store import read_run_state, write_run_state
    from ..protocol.loader import load_gate_config, load_workflow

    state, current_revision = read_run_state(project_root, run_id)
    if not state:
        raise ValueError(f"RUN_NOT_FOUND: {run_id}")
    gate_config = load_gate_config(project_root)
    if gate_id not in gate_config["gates"]:
        raise ValueError(f"GATE_NOT_FOUND: {gate_id}")
    state.setdefault("gates", {}).setdefault(gate_id, "NOT_RUN")

    # Gate 权限来自目标 Run 的当前角色，Renderer 不能通过请求参数冒充 verifier。
    caller_role = state.get("next_role", "")
    permission_error = check_gate_permission(gate_id, caller_role)
    if permission_error:
        raise PermissionError(f"{permission_error}: {gate_id} requires verifier")

    phase_dir = _get_phase_dir(project_root, run_id)
    if not phase_dir:
        raise ValueError("PHASE_DIR_MISSING")

    workflow = load_workflow(project_root)
    result = evaluate_gate(
        gate_id,
        state,
        phase_dir,
        caller_role=caller_role,
        gate_meanings=workflow.gate_meanings,
        failure_recovery=workflow.failure_recovery,
        required_artifacts={
            configured_id: definition.get("required_artifacts", [])
            for configured_id, definition in gate_config["gates"].items()
        },
    )
    state.setdefault("gates", {})[gate_id] = result["status"]

    # 失败门禁按 workflow 的恢复路由回退；角色同样由节点定义派生。
    retry_target = result.get("retry_target")
    if retry_target:
        node = next((item for item in workflow.nodes if item.id == retry_target), None)
        state["current_node"] = retry_target
        state["next_role"] = node.role if node else "dispatcher"
        state["status"] = "IN_PROGRESS"
    elif result["status"] == "BLOCKED":
        state["status"] = "BLOCKED"
    state["notes"] = f"{gate_id}: {result['reason']}"

    revision = write_run_state(
        project_root,
        run_id,
        state,
        expected_revision=(
            expected_revision if expected_revision is not None else current_revision
        ),
    )
    return {
        **result,
        "runId": state["run_id"],
        "currentNode": state.get("current_node", ""),
        "nextRole": state.get("next_role", ""),
        "revision": revision,
        "gates": state["gates"],
    }


def _gate_waive(project_root: Path, params: dict) -> dict:
    from datetime import datetime, timezone

    from ..gates.permissions import check_gate_permission
    from ..persistence.state_store import read_run_state, write_run_state
    from ..protocol.loader import load_gate_config

    run_id = params.get("runId", "")
    gate_id = params.get("gateId", "")
    state, revision = read_run_state(project_root, run_id)
    if not state:
        raise ValueError(f"RUN_NOT_FOUND: {run_id}")
    expected = params.get("expectedRevision")
    if expected is not None and expected != revision:
        raise RuntimeError("REVISION_CONFLICT")
    if gate_id not in load_gate_config(project_root)["gates"]:
        raise ValueError(f"GATE_NOT_FOUND: {gate_id}")
    permission = check_gate_permission(gate_id, state.get("next_role", ""))
    if permission:
        raise PermissionError(f"{permission}: {gate_id} requires verifier")
    metadata = {
        "scope": str(params.get("scope", "")).strip(),
        "reason": str(params.get("reason", "")).strip(),
        "owner": str(params.get("owner", "")).strip(),
        "time": datetime.now(timezone.utc).isoformat(),
    }
    if not all(metadata[field] for field in ("scope", "reason", "owner")):
        raise ValueError("GATE_WAIVER_METADATA_REQUIRED")
    # 豁免是可审计决策，不是隐式 PASS；状态和元数据必须在同一次 revision 写入。
    state.setdefault("waivers", {})[gate_id] = metadata
    state.setdefault("gates", {})[gate_id] = "WAIVED"
    state["notes"] = f"{gate_id} waived by {metadata['owner']}: {metadata['reason']}"
    new_revision = write_run_state(
        project_root, run_id, state, expected_revision=revision
    )
    return {
        "status": "WAIVED",
        "runId": run_id,
        "gateId": gate_id,
        "waiver": metadata,
        "revision": new_revision,
    }


def _artifact_list(project_root: Path, run_id: str) -> list[dict]:
    from ..artifacts.service import list_artifacts
    phase_dir = _get_phase_dir(project_root, run_id)
    return list_artifacts(phase_dir) if phase_dir else []


def _artifact_read(project_root: Path, run_id: str, filename: str) -> dict:
    from ..artifacts.service import read_artifact
    phase_dir = _get_phase_dir(project_root, run_id)
    if not phase_dir:
        return {"error": f"Run not found: {run_id}"}
    return read_artifact(project_root, phase_dir, filename)


def _artifact_hash(project_root: Path, run_id: str, filename: str) -> dict:
    artifact = _artifact_read(project_root, run_id, filename)
    return {
        "runId": run_id,
        "filename": filename,
        "sha256": artifact["sha256"],
        "size": artifact["size"],
    }


def _terminal_session_update(project_id: str, session: dict) -> dict:
    from ..terminals.projections import upsert_session

    return upsert_session(project_id, session)


def _terminal_session_list(project_id: str, run_id: str | None) -> list[dict]:
    from ..terminals.projections import list_sessions

    return list_sessions(project_id, run_id)


def _diagnostics_export(project_id: str, project_root: Path) -> dict:
    from ..diagnostics.service import export_diagnostics

    return export_diagnostics(project_id, project_root)


def _knowledge_list(project_id: str, project_root: Path, status: str) -> list[dict]:
    from ..knowledge.service import list_candidates_with_content
    return list_candidates_with_content(project_id, project_root, status=status)


def _knowledge_review(candidate_id: int, decision: str) -> dict:
    from ..knowledge.service import review_candidate
    return review_candidate(candidate_id, decision)


def _knowledge_repo_status(project_id: str) -> dict:
    from ..knowledge.shared_repo import repo_status
    return repo_status(project_id)


def _knowledge_repo_configure(project_id: str, local_path: str, remote_url: str, branch: str) -> dict:
    from ..knowledge.shared_repo import configure_repo
    return configure_repo(project_id, local_path, remote_url, branch)


def _knowledge_repo_inspect_local(local_path: str) -> dict:
    from ..knowledge.shared_repo import inspect_local_path
    return inspect_local_path(local_path)


def _knowledge_repo_pull(project_id: str) -> dict:
    from ..knowledge.shared_repo import pull_repo
    return pull_repo(project_id)


def _knowledge_repo_synthesize(project_id: str, project_root: Path, candidate_ids: list[int]) -> dict:
    from ..knowledge.shared_repo import synthesize_preview
    return synthesize_preview(project_id, project_root, candidate_ids)


async def _knowledge_repo_codex_start(
    project_id: str,
    project_root: Path,
    candidate_ids: list[int],
    allow_dirty: bool,
) -> dict:
    from ..knowledge.shared_repo import synthesis_context

    capability = await _codex_adapter.probe()
    if not capability.available or not capability.path:
        raise RuntimeError(capability.diagnostics or "CODEX_UNAVAILABLE")
    context = synthesis_context(project_id, project_root, candidate_ids, allow_dirty=allow_dirty)
    server = CodexAppServer(capability.path, Path(context["repoPath"]))
    developer_instructions = (
        "你正在 Harness Desktop 的 Knowledge 模块中运行。"
        "请使用中文进行分析和回复。"
        "在 Windows PowerShell 中读取文本文件时必须显式使用 -Encoding utf8，写入文本也必须使用 UTF-8，避免中文乱码。"
        "只允许更新共享知识库本地 Git 仓库的 working tree。"
        "不要 push，不要 commit；文件修改需要等待用户审批。"
    )
    await server.start(context["prompt"], developer_instructions=developer_instructions)
    session_id = f"knowledge-codex-{uuid.uuid4().hex[:12]}"
    _knowledge_codex_sessions[session_id] = {
        "server": server,
        "projectId": project_id,
        "repoPath": context["repoPath"],
        "diffEmitted": False,
    }
    return {
        "sessionId": session_id,
        "pid": server.pid,
        "threadId": server.thread_id,
        "turnId": server.turn_id,
        "candidateCount": context["candidateCount"],
        "rules": context["rules"],
    }


def _knowledge_repo_codex_active(project_id: str) -> dict:
    for session_id, session in reversed(_knowledge_codex_sessions.items()):
        if session.get("projectId") == project_id and not session.get("diffEmitted"):
            server: CodexAppServer = session["server"]
            return {
                "active": True,
                "sessionId": session_id,
                "pid": server.pid,
                "threadId": server.thread_id,
                "turnId": server.turn_id,
                "approvals": server.pending_approvals(),
            }
    return {"active": False}


def _knowledge_repo_codex_poll(project_id: str, session_id: str) -> list[dict]:
    from ..knowledge.shared_repo import repo_diff

    session = _knowledge_codex_sessions.get(session_id)
    if not session or session.get("projectId") != project_id:
        raise ValueError(f"KNOWLEDGE_CODEX_SESSION_NOT_FOUND: {session_id}")
    server: CodexAppServer = session["server"]
    events = server.poll_events()
    if (
        not session.get("diffEmitted")
        and any(event.get("type") in {"exited", "error"} for event in events)
    ):
        session["diffEmitted"] = True
        preview = repo_diff(project_id)
        events.append({"type": "preview", "sequence": 10_000_000, **preview})
    return events


async def _knowledge_repo_codex_respond(project_id: str, session_id: str, decision: dict) -> dict:
    session = _knowledge_codex_sessions.get(session_id)
    if not session or session.get("projectId") != project_id:
        raise ValueError(f"KNOWLEDGE_CODEX_SESSION_NOT_FOUND: {session_id}")
    server: CodexAppServer = session["server"]
    await server.respond(int(decision.get("requestId")), decision.get("decision", ""))
    return {"ok": True}


async def _knowledge_repo_codex_feedback(project_id: str, session_id: str, feedback: str) -> dict:
    from ..knowledge.shared_repo import repo_diff

    session = _knowledge_codex_sessions.get(session_id)
    if not session or session.get("projectId") != project_id:
        raise ValueError(f"KNOWLEDGE_CODEX_SESSION_NOT_FOUND: {session_id}")
    user_feedback = str(feedback or "").strip()
    if not user_feedback:
        raise ValueError("KNOWLEDGE_CODEX_FEEDBACK_REQUIRED")
    current_diff = str(repo_diff(project_id).get("diff") or "")
    if len(current_diff) > 20000:
        current_diff = current_diff[:20000] + "\n\n[DIFF TRUNCATED]"
    prompt = (
        "用户正在审批你刚才对共享知识库本地仓库生成的改动。\n\n"
        "请根据用户反馈继续修改本地 working tree，不要 commit，不要 push。\n"
        "修改完成后简要说明你做了什么。\n\n"
        f"用户反馈：\n{user_feedback}\n\n"
        f"当前 Git diff：\n{current_diff or '_当前没有可见 diff_'}\n"
    )
    server: CodexAppServer = session["server"]
    session["diffEmitted"] = False
    await server.send_message(prompt)
    return {"ok": True, "sessionId": session_id}


async def _knowledge_repo_codex_cancel(project_id: str, session_id: str) -> dict:
    session = _knowledge_codex_sessions.pop(session_id, None)
    if not session or session.get("projectId") != project_id:
        raise ValueError(f"KNOWLEDGE_CODEX_SESSION_NOT_FOUND: {session_id}")
    server: CodexAppServer = session["server"]
    await server.interrupt()
    await server.close()
    return {"ok": True}


def _knowledge_repo_push(project_id: str) -> dict:
    from ..knowledge.shared_repo import push_repo
    return push_repo(project_id)


def _get_phase_dir(project_root: Path, run_id: str):
    from ..persistence.state_store import read_run_state

    state, _ = read_run_state(project_root, run_id)
    pd = state.get("phase_dir", "")
    if pd:
        phase_dir = (project_root / pd).resolve()
        try:
            phase_dir.relative_to(project_root.resolve())
        except ValueError as exc:
            raise ValueError("PHASE_DIR_ESCAPE") from exc
        worktree_path = state.get("worktree_path")
        if worktree_path:
            worktree_phase_dir = (Path(str(worktree_path)) / pd).resolve()
            try:
                worktree_phase_dir.relative_to(Path(str(worktree_path)).resolve())
            except ValueError as exc:
                raise ValueError("PHASE_DIR_ESCAPE") from exc
            if worktree_phase_dir.is_dir() and (
                not phase_dir.is_dir() or not any(phase_dir.iterdir())
            ):
                return worktree_phase_dir
        return phase_dir
    return None


async def _execution_probe() -> dict:
    capability = await _codex_adapter.probe()
    return {
        "available": capability.available,
        "path": capability.path,
        "version": capability.version,
        "features": capability.features,
        "diagnostics": capability.diagnostics,
    }


async def _execution_start(
    project_id: str, project_root: Path, run_id: str, expected_revision: str | None
) -> dict:
    from ..executors.base import ExecutionRequest
    from ..persistence.database import get_db
    from ..persistence.state_store import read_run_state, write_run_state
    from ..runs.worktrees import ensure_run_worktree

    capability = await _codex_adapter.probe()
    if not capability.available:
        raise RuntimeError(capability.diagnostics or "CODEX_UNAVAILABLE")

    state, current_revision = read_run_state(project_root, run_id)
    if not state:
        raise ValueError(f"RUN_NOT_FOUND: {run_id}")
    if expected_revision is not None and expected_revision != current_revision:
        raise RuntimeError("REVISION_CONFLICT")
    node_id = state.get("current_node", "")
    role = state.get("next_role", "")
    if not run_id or not node_id or not role:
        raise ValueError("RUN_CONTEXT_INCOMPLETE")

    worktree_path = state.get("worktree_path", "")
    if node_id == "DEVELOPMENT" and not worktree_path:
        worktree = ensure_run_worktree(project_root, run_id)
        state.update(worktree)
        current_revision = write_run_state(
            project_root, run_id, state, expected_revision=current_revision
        )
        worktree_path = worktree["worktree_path"]
    execution_root = Path(worktree_path).resolve() if worktree_path else project_root
    if not execution_root.is_dir():
        raise ValueError(f"WORKTREE_PATH_MISSING: {execution_root}")

    phase_dir = (project_root / state.get("phase_dir", "")).resolve()
    try:
        phase_dir.relative_to(project_root.resolve())
    except ValueError as exc:
        raise ValueError("PHASE_DIR_ESCAPE") from exc
    phase_dir.mkdir(parents=True, exist_ok=True)
    role_file = project_root / ".harness" / "agents" / f"{role}.md"
    if not role_file.is_file():
        raise ValueError(f"ROLE_FILE_MISSING: {role_file}")

    # Codex 只接收目标 Run 当前节点所需上下文，忽略 Renderer 传入的 node/role。
    request = ExecutionRequest(
        project_root=str(execution_root),
        run_id=run_id,
        node_id=node_id,
        role_file=str(role_file),
        rules=[
            "AGENTS.md",
            str(project_root / ".harness" / "runs" / run_id / "state.json"),
            ".harness/workflow.yaml",
        ],
        phase_dir=str(phase_dir),
        context={"intent": state.get("intent"), "risk": state.get("risk")},
    )
    session_id = await _codex_adapter.start(request)
    info = _codex_adapter.session_info(session_id)
    db = get_db()
    db.execute(
        """INSERT INTO executor_sessions
           (id, project_id, run_id, node_id, executor_type, pid, start_time, status,
            worktree_path, branch_name, thread_id, turn_id)
           VALUES (?, ?, ?, ?, 'codex', ?, ?, 'active', ?, ?, ?, ?)""",
        (
            session_id,
            project_id,
            run_id,
            node_id,
            info.get("pid"),
            datetime.now(timezone.utc).isoformat(),
            str(execution_root),
            state.get("branch_name"),
            info.get("threadId"),
            info.get("turnId"),
        ),
    )
    db.commit()
    return {
        "sessionId": session_id,
        "runId": run_id,
        "nodeId": node_id,
        "role": role,
        "revision": current_revision,
        "worktreePath": str(execution_root),
        **info,
    }


def _require_execution_session(project_id: str, run_id: str, session_id: str):
    from ..persistence.database import get_db

    row = get_db().execute(
        "SELECT * FROM executor_sessions WHERE id = ?", (session_id,)
    ).fetchone()
    if not row:
        raise ValueError(f"EXECUTION_SESSION_NOT_FOUND: {session_id}")
    if row["project_id"] != project_id:
        raise PermissionError("EXECUTION_SESSION_PROJECT_MISMATCH")
    if row["run_id"] != run_id:
        raise PermissionError("EXECUTION_SESSION_RUN_MISMATCH")
    return row


def _execution_poll(project_id: str, run_id: str, session_id: str) -> list[dict]:
    from ..persistence.database import get_db

    _require_execution_session(project_id, run_id, session_id)
    events = _codex_adapter.poll(session_id)
    terminal = next(
        (event for event in reversed(events) if event.get("type") in {"exited", "error"}),
        None,
    )
    if terminal:
        status = "completed" if terminal["type"] == "exited" and terminal.get("code") == 0 else "failed"
        db = get_db()
        db.execute(
            "UPDATE executor_sessions SET status = ? WHERE id = ?",
            (status, session_id),
        )
        db.commit()
    return events


async def _execution_respond(project_id: str, run_id: str, session_id: str, decision: dict) -> dict:
    _require_execution_session(project_id, run_id, session_id)
    await _codex_adapter.respond(session_id, decision)
    return {"status": "ok"}


async def _execution_cancel(project_id: str, run_id: str, session_id: str) -> dict:
    from ..persistence.database import get_db

    _require_execution_session(project_id, run_id, session_id)
    await _codex_adapter.cancel(session_id)
    db = get_db()
    db.execute(
        "UPDATE executor_sessions SET status = 'cancelled' WHERE id = ?",
        (session_id,),
    )
    db.commit()
    return {"status": "cancelled"}


def _recovery_scan(project_id: str) -> list[dict]:
    from ..recovery.service import scan_sessions
    return scan_sessions(project_id)


def _recovery_cleanup(project_root: Path) -> list[str]:
    from ..recovery.service import cleanup_temp_files
    return cleanup_temp_files(project_root)
