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

PROJECT_ROOT = Path(os.getcwd())


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
    raise ValueError(f"Unknown method: {method}")


def _project_list() -> list[dict]:
    root = PROJECT_ROOT
    harness = root / ".harness"
    if not harness.is_dir():
        return []
    try:
        state = json.loads((harness / "state.json").read_text(encoding="utf-8"))
    except Exception:
        return []
    return [{
        "projectId": root.name,
        "name": root.name,
        "path": str(root),
        "health": "healthy",
        "protocolVersion": state.get("schema_version", "1.0"),
        "activeRunId": state.get("run_id", ""),
    }]


def _project_import(path: str) -> dict:
    from ..projects.service import import_project
    return import_project(path)


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
