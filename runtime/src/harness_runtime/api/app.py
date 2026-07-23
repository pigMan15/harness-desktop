"""FastAPI application for Harness Desktop Runtime."""

import json
import hashlib
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

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

_codex_adapter = CodexAdapter(os.environ.get("HARNESS_CODEX_PATH", "codex"))


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
        return _project_import(params.get("path", ""))
    if method == "project.validate":
        return _project_validate(params.get("path", ""))
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
    if method == "workflow.get":
        return _workflow_get(project_root)
    if method == "workflow.compile":
        return _workflow_compile(
            project_root, params.get("intent", "FEATURE"), params.get("risk", "MEDIUM")
        )
    if method == "workflow.preview":
        return _workflow_preview(project_root, params)
    if method == "workflow.diff":
        return _workflow_diff(project_root, params.get("yaml", ""))
    if method == "workflow.apply":
        return _workflow_apply(project_root, params.get("yaml", ""), params.get("hash", ""))
    if method == "gate.list":
        return _gate_list(project_root, params.get("runId", ""))
    if method == "gate.evaluate":
        return _gate_evaluate(
            project_root,
            params.get("runId", ""),
            params.get("gateId", ""),
            params.get("expectedRevision"),
        )
    if method == "artifact.list":
        return _artifact_list(project_root, params.get("runId", ""))
    if method == "artifact.read":
        return _artifact_read(project_root, params.get("runId", ""), params.get("filename", ""))
    if method == "knowledge.list":
        return _knowledge_list(params.get("status", "draft"))
    if method == "knowledge.review":
        return _knowledge_review(params.get("candidateId", 0), params.get("decision", "accepted"))
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


def _project_import(path: str) -> dict:
    from ..projects.service import import_project
    actual_path = path if path and path != '.' else str(PROJECT_ROOT)
    return import_project(actual_path)


def _project_validate(path: str) -> dict:
    from ..projects.service import validate_project
    return validate_project(path)


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


def _workflow_get(project_root: Path) -> dict:
    from ..protocol.loader import load_workflow
    wf = load_workflow(project_root)
    workflow_path = project_root / ".harness" / "workflow.yaml"
    workflow_yaml = workflow_path.read_text(encoding="utf-8")
    state = json.loads((project_root / ".harness" / "state.json").read_text(encoding="utf-8"))
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
    )


def _workflow_diff(project_root: Path, new_yaml: str) -> dict:
    from ..workflow.drafts import semantic_diff
    wf_path = project_root / ".harness" / "workflow.yaml"
    old_yaml = wf_path.read_text(encoding="utf-8") if wf_path.is_file() else ""
    return semantic_diff(old_yaml, new_yaml)


def _workflow_apply(project_root: Path, yaml: str, expected_hash: str) -> dict:
    from ..workflow.drafts import apply_draft
    return apply_draft(project_root, yaml, expected_hash if expected_hash else None)


def _gate_list(project_root: Path, run_id: str) -> dict:
    from ..persistence.state_store import read_run_state

    state, revision = read_run_state(project_root, run_id)
    if not state:
        raise ValueError(f"RUN_NOT_FOUND: {run_id}")
    return {
        "runId": state.get("run_id", ""),
        "currentNode": state.get("current_node", ""),
        "nextRole": state.get("next_role", ""),
        "phaseDir": state.get("phase_dir", ""),
        "revision": revision,
        "gates": state.get("gates", {}),
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
    from ..protocol.loader import load_workflow

    state, current_revision = read_run_state(project_root, run_id)
    if not state:
        raise ValueError(f"RUN_NOT_FOUND: {run_id}")
    if gate_id not in state.get("gates", {}):
        raise ValueError(f"GATE_NOT_FOUND: {gate_id}")

    # Gate 权限来自目标 Run 的当前角色，Renderer 不能通过请求参数冒充 verifier。
    caller_role = state.get("next_role", "")
    permission_error = check_gate_permission(gate_id, caller_role)
    if permission_error:
        raise PermissionError(f"{permission_error}: {gate_id} requires verifier")

    phase_dir = (project_root / state.get("phase_dir", "")).resolve()
    try:
        phase_dir.relative_to(project_root.resolve())
    except ValueError as exc:
        raise ValueError("PHASE_DIR_ESCAPE") from exc

    workflow = load_workflow(project_root)
    result = evaluate_gate(
        gate_id,
        state,
        phase_dir,
        caller_role=caller_role,
        gate_meanings=workflow.gate_meanings,
        failure_recovery=workflow.failure_recovery,
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


def _knowledge_list(status: str) -> list[dict]:
    from ..knowledge.service import list_candidates
    return list_candidates(status=status)


def _knowledge_review(candidate_id: int, decision: str) -> dict:
    from ..knowledge.service import review_candidate
    return review_candidate(candidate_id, decision)


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
