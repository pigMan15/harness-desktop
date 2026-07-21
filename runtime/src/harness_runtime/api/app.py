"""FastAPI application for Harness Desktop Runtime."""

import json
import os
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
    if method == "run.list":
        return _run_list()
    if method == "run.create":
        return _run_create(params.get("intent", "FEATURE"), params.get("risk", "MEDIUM"), params.get("runId", ""))
    if method == "workflow.get":
        return _workflow_get()
    if method == "workflow.compile":
        return _workflow_compile(params.get("intent", "FEATURE"), params.get("risk", "MEDIUM"))
    if method == "gate.list":
        return _gate_list()
    if method == "gate.evaluate":
        return _gate_evaluate(params.get("gateId", ""), params.get("status", "NOT_RUN"))
    if method == "artifact.list":
        return _artifact_list()
    if method == "artifact.read":
        return _artifact_read(params.get("filename", ""))
    if method == "knowledge.list":
        return _knowledge_list(params.get("status", "draft"))
    if method == "knowledge.review":
        return _knowledge_review(params.get("candidateId", 0), params.get("decision", "accepted"))
    if method == "execution.start":
        return _execution_start(params.get("nodeId", "DEVELOPMENT"), params.get("role", "developer"))
    if method == "execution.poll":
        return _execution_poll(params.get("sessionId", ""))
    if method == "execution.respond":
        return _execution_respond(params.get("sessionId", ""), params.get("decision", {}))
    if method == "execution.cancel":
        return _execution_cancel(params.get("sessionId", ""))
    raise ValueError(f"Unknown method: {method}")


def _project_list() -> list[dict]:
    from ..projects.service import list_projects
    try:
        projects = list_projects()
        if projects:
            return projects
    except Exception:
        pass
    # Fallback: return current project if it has .harness
    root = PROJECT_ROOT
    harness = root / ".harness"
    if harness.is_dir():
        try:
            state = json.loads((harness / "state.json").read_text(encoding="utf-8"))
            return [{
                "projectId": root.name, "name": root.name, "path": str(root),
                "health": "healthy", "protocolVersion": state.get("schema_version", "1.0"),
                "activeRunId": state.get("run_id", ""),
            }]
        except Exception:
            pass
    # Last resort: check a few common paths
    for check in [Path("."), Path(".."), Path.home() / "harness-desktop"]:
        h = (check.resolve() / ".harness")
        if h.is_dir():
            try:
                state = json.loads((h / "state.json").read_text(encoding="utf-8"))
                return [{
                    "projectId": check.name, "name": check.name, "path": str(check.resolve()),
                    "health": "healthy", "protocolVersion": state.get("schema_version", "1.0"),
                }]
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


def _run_list() -> list[dict]:
    harness = PROJECT_ROOT / ".harness"
    runs_dir = harness / "runs"
    if not runs_dir.is_dir():
        return []
    runs = []
    for d in sorted(runs_dir.iterdir(), reverse=True):
        sf = d / "state.json"
        if sf.is_file():
            try:
                state = json.loads(sf.read_text(encoding="utf-8"))
                runs.append({
                    "run_id": state.get("run_id", d.name),
                    "intent": state.get("intent", ""),
                    "risk": state.get("risk", ""),
                    "status": state.get("status", ""),
                    "current_node": state.get("current_node", ""),
                    "completed_nodes": state.get("completed_nodes", []),
                    "required_nodes": state.get("required_nodes", []),
                })
            except Exception:
                pass
    return runs


def _run_create(intent: str, risk: str, run_id: str) -> dict:
    from ..runs.service import create_run
    return create_run(PROJECT_ROOT, intent, risk, run_id)


def _workflow_get() -> dict:
    from ..protocol.loader import load_workflow
    wf = load_workflow(PROJECT_ROOT)
    state = json.loads((PROJECT_ROOT / ".harness" / "state.json").read_text(encoding="utf-8"))
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
    }


def _workflow_compile(intent: str, risk: str) -> dict:
    from ..protocol.loader import load_workflow
    from ..workflow.compiler import simulate
    wf = load_workflow(PROJECT_ROOT)
    return simulate(wf, intent, risk)


def _gate_list() -> dict:
    state = json.loads((PROJECT_ROOT / ".harness" / "state.json").read_text(encoding="utf-8"))
    return {"gates": state.get("gates", {})}


def _gate_evaluate(gate_id: str, status: str) -> dict:
    valid = {"PASS", "FAIL", "WAIVED", "BLOCKED", "NOT_REQUIRED", "NOT_RUN"}
    if status not in valid:
        return {"error": f"Invalid gate status: {status}"}
    state_path = PROJECT_ROOT / ".harness" / "state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state.setdefault("gates", {})[gate_id] = status
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"status": status}


def _artifact_list() -> list[dict]:
    from ..artifacts.service import list_artifacts
    phase_dir = _get_phase_dir()
    return list_artifacts(phase_dir) if phase_dir else []


def _artifact_read(filename: str) -> dict:
    from ..artifacts.service import read_artifact
    phase_dir = _get_phase_dir()
    if not phase_dir:
        return {"error": "No active run"}
    return read_artifact(PROJECT_ROOT, phase_dir, filename)


def _knowledge_list(status: str) -> list[dict]:
    from ..knowledge.service import list_candidates
    return list_candidates(status=status)


def _knowledge_review(candidate_id: int, decision: str) -> dict:
    from ..knowledge.service import review_candidate
    return review_candidate(candidate_id, decision)


def _get_phase_dir():
    try:
        state = json.loads((PROJECT_ROOT / ".harness" / "state.json").read_text(encoding="utf-8"))
        pd = state.get("phase_dir", "")
        if pd:
            return PROJECT_ROOT / pd
    except Exception:
        pass
    return None


# ── Fake Executor session store ──

_exec_sessions: dict[str, dict] = {}


def _execution_start(node_id: str, role: str) -> dict:
    import uuid
    sid = f"fake-{uuid.uuid4().hex[:8]}"
    # Generate scripted events for a realistic-looking execution
    events = [
        {"type": "output", "sequence": 1, "content": f"# {role} executing node {node_id}"},
        {"type": "output", "sequence": 2, "content": "Analyzing project structure..."},
        {"type": "tool_call", "sequence": 3, "tool": "read_file", "params": {"path": ".harness/state.json"}},
        {"type": "output", "sequence": 4, "content": "Found state.json with run_id=..."},
        {"type": "approval_required", "sequence": 5, "message": f"Execute task for {node_id}?", "category": "command"},
        # After approval, more events
        {"type": "output", "sequence": 6, "content": "Task accepted. Modifying files..."},
        {"type": "tool_call", "sequence": 7, "tool": "write_file", "params": {"path": "output.txt", "content": "done"}},
        {"type": "output", "sequence": 8, "content": "Execution complete."},
        {"type": "exited", "sequence": 9, "code": 0},
    ]
    _exec_sessions[sid] = {"events": events, "cursor": 0, "pending_approval": False, "cancelled": False}
    return {"sessionId": sid}


def _execution_poll(session_id: str) -> list[dict]:
    sess = _exec_sessions.get(session_id)
    if not sess:
        return [{"type": "error", "sequence": 0, "content": "Session not found"}]
    if sess["cancelled"]:
        return [{"type": "exited", "sequence": 99, "code": -1, "content": "Cancelled"}]
    # Return next batch of events
    events = sess["events"]
    cursor = sess["cursor"]
    batch = []
    while cursor < len(events):
        ev = events[cursor]
        # Stop before approval (wait for user response)
        if ev["type"] == "approval_required" and cursor > sess.get("last_approval_cursor", -1):
            if not sess.get("approval_responded"):
                sess["pending_approval"] = True
                sess["last_approval_cursor"] = cursor
                batch.append(ev)
                sess["cursor"] = cursor + 1
                return batch
        batch.append(ev)
        cursor += 1
        if ev["type"] == "exited":
            break
    sess["cursor"] = cursor
    return batch


def _execution_respond(session_id: str, decision: dict) -> dict:
    sess = _exec_sessions.get(session_id)
    if not sess:
        return {"error": "Session not found"}
    sess["approval_responded"] = True
    sess["pending_approval"] = False
    return {"status": "ok"}


def _execution_cancel(session_id: str) -> dict:
    sess = _exec_sessions.get(session_id)
    if not sess:
        return {"error": "Session not found"}
    sess["cancelled"] = True
    return {"status": "cancelled"}
