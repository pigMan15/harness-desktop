"""Workflow Draft Service — SQLite-backed draft storage with compile + apply.

Architecture §9.2: compile fails → diagnostics only, no file write.
Architecture §9.3: apply requires expected hash + project lock → atomic replace.
"""

import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import yaml

from ..persistence.database import get_db
from ..persistence.project_lock import ProjectLock
from .compiler import compile_workflow, simulate


def _ensure_drafts_table():
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS workflow_drafts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT 'Untitled',
            yaml_content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(project_id, name)
        )
    """)
    db.commit()


def save_draft(project_id: str, name: str, yaml_content: str) -> dict:
    """Save or update a workflow draft in SQLite."""
    _ensure_drafts_table()
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    existing = db.execute(
        "SELECT id FROM workflow_drafts WHERE project_id = ? AND name = ?",
        (project_id, name),
    ).fetchone()
    if existing:
        db.execute(
            "UPDATE workflow_drafts SET yaml_content = ?, updated_at = ? WHERE id = ?",
            (yaml_content, now, existing["id"]),
        )
    else:
        db.execute(
            "INSERT INTO workflow_drafts (project_id, name, yaml_content) VALUES (?, ?, ?)",
            (project_id, name, yaml_content),
        )
    db.commit()
    return {"name": name, "updated_at": now}


def get_draft(project_id: str, name: str) -> Optional[dict]:
    """Get a saved draft."""
    _ensure_drafts_table()
    db = get_db()
    row = db.execute(
        "SELECT * FROM workflow_drafts WHERE project_id = ? AND name = ?",
        (project_id, name),
    ).fetchone()
    if not row:
        return None
    return {"name": row["name"], "yaml_content": row["yaml_content"],
            "created_at": row["created_at"], "updated_at": row["updated_at"]}


def list_drafts(project_id: str) -> list[dict]:
    """List all drafts for a project."""
    _ensure_drafts_table()
    db = get_db()
    rows = db.execute(
        "SELECT name, updated_at FROM workflow_drafts WHERE project_id = ? ORDER BY updated_at DESC",
        (project_id,),
    ).fetchall()
    return [{"name": r["name"], "updated_at": r["updated_at"]} for r in rows]


def compile_draft(yaml_content: str, intent: str, risk: str) -> dict:
    """Compile a draft YAML and return result with diagnostics.

    Architecture §9.2: compile fails → returns diagnostics, does NOT write project files.
    """
    try:
        wf_dict = yaml.safe_load(yaml_content)
        from ..protocol.models import WorkflowDefinition
        wf = WorkflowDefinition(**wf_dict)
        route = compile_workflow(wf, intent, risk)
        return {"success": True, "route": route.to_dict()}
    except Exception as e:
        return {"success": False, "error": str(e), "route": None}


def simulate_draft(yaml_content: str, intent: str, risk: str) -> dict:
    """Simulate a draft without side effects."""
    try:
        wf_dict = yaml.safe_load(yaml_content)
        from ..protocol.models import WorkflowDefinition
        wf = WorkflowDefinition(**wf_dict)
        return simulate(wf, intent, risk)
    except Exception as e:
        return {"error": str(e)}


def validate_draft_content(yaml_content: str, project_root: Optional[Path] = None) -> dict:
    """Validate the complete workflow before any project file replacement."""
    try:
        wf_dict = yaml.safe_load(yaml_content)
        if not isinstance(wf_dict, dict):
            raise ValueError("workflow.yaml must be a mapping")
        from ..protocol.models import WorkflowDefinition
        from ..protocol.validator import validate_workflow_deep

        workflow = WorkflowDefinition(**wf_dict)
        agents_dir = project_root / ".harness" / "agents" if project_root else None
        diagnostics = validate_workflow_deep(workflow, agents_dir=agents_dir)
        diagnostic_dicts = [d.to_dict() for d in diagnostics]
        for intent, risk_routes in workflow.routes.items():
            for risk in risk_routes:
                try:
                    compile_workflow(workflow, intent, risk)
                except ValueError as exc:
                    diagnostic_dicts.append(
                        {
                            "code": "WORKFLOW_COMPILE_FAILED",
                            "severity": "error",
                            "pointer": f"/routes/{intent}/{risk}",
                            "message": str(exc),
                        }
                    )
        return {
            "success": not any(d["severity"] == "error" for d in diagnostic_dicts),
            "diagnostics": diagnostic_dicts,
        }
    except Exception as exc:
        return {
            "success": False,
            "diagnostics": [
                {
                    "code": "WORKFLOW_VALIDATION_FAILED",
                    "severity": "error",
                    "pointer": "/",
                    "message": str(exc),
                }
            ],
        }


def preview_structured_draft(
    project_root: Path,
    nodes: list[dict],
    intent: str,
    risk: str,
    route: list[str],
) -> dict:
    """Merge one edited route into the complete workflow and compile it without writing."""
    wf_path = project_root / ".harness" / "workflow.yaml"
    if not wf_path.is_file():
        return {
            "success": False,
            "error": "WORKFLOW_MISSING",
            "diagnostics": [],
        }

    original_yaml = wf_path.read_text(encoding="utf-8")
    base_hash = hashlib.sha256(original_yaml.encode("utf-8")).hexdigest()
    try:
        merged = yaml.safe_load(original_yaml) or {}
        if not isinstance(merged, dict):
            raise ValueError("workflow.yaml must be a mapping")

        # Renderer 只提交节点目录和当前路线；其余路线与安全规则始终由 Runtime 保留。
        merged["nodes"] = nodes
        routes = merged.setdefault("routes", {})
        intent_routes = routes.setdefault(intent, {})
        intent_routes[risk] = route
        preview_yaml = yaml.safe_dump(
            merged,
            allow_unicode=True,
            sort_keys=False,
            default_flow_style=False,
        )

        from ..protocol.models import WorkflowDefinition
        from ..protocol.validator import validate_workflow_deep

        workflow = WorkflowDefinition(**merged)
        diagnostics = validate_workflow_deep(
            workflow,
            agents_dir=project_root / ".harness" / "agents",
        )
        diagnostic_dicts = [d.to_dict() for d in diagnostics]
        if any(d.severity == "error" for d in diagnostics):
            return {
                "success": False,
                "error": "WORKFLOW_VALIDATION_FAILED",
                "diagnostics": diagnostic_dicts,
                "base_hash": base_hash,
            }

        compiled = compile_workflow(workflow, intent, risk)
        return {
            "success": True,
            "yaml": preview_yaml,
            "base_hash": base_hash,
            "compiled": compiled.to_dict(),
            "diagnostics": diagnostic_dicts + [
                d.to_dict() for d in compiled.diagnostics
            ],
            "diff": semantic_diff(original_yaml, preview_yaml),
        }
    except Exception as exc:
        return {
            "success": False,
            "error": str(exc),
            "diagnostics": [
                {
                    "code": "WORKFLOW_PREVIEW_FAILED",
                    "severity": "error",
                    "pointer": "/",
                    "message": str(exc),
                }
            ],
            "base_hash": base_hash,
        }


def semantic_diff(old_yaml: str, new_yaml: str) -> dict:
    """Generate a semantic diff between two workflow YAMLs."""
    try:
        old = yaml.safe_load(old_yaml) or {}
        new = yaml.safe_load(new_yaml) or {}
    except yaml.YAMLError:
        return {"error": "YAML parse error"}

    old_nodes = {n["id"]: n for n in old.get("nodes", []) if isinstance(n, dict)}
    new_nodes = {n["id"]: n for n in new.get("nodes", []) if isinstance(n, dict)}

    added = [nid for nid in new_nodes if nid not in old_nodes]
    removed = [nid for nid in old_nodes if nid not in new_nodes]
    modified = []
    for nid in set(old_nodes) & set(new_nodes):
        if old_nodes[nid] != new_nodes[nid]:
            modified.append(nid)

    old_routes = old.get("routes", {})
    new_routes = new.get("routes", {})
    route_changes = []
    for intent in set(old_routes) | set(new_routes):
        orr = old_routes.get(intent, {})
        nrr = new_routes.get(intent, {})
        if orr != nrr:
            route_changes.append(intent)

    return {
        "nodes": {"added": added, "removed": removed, "modified": modified},
        "routes": {"changed": route_changes},
    }


def apply_draft(project_root: Path, yaml_content: str, expected_hash: Optional[str] = None) -> dict:
    """Apply a draft to the project's workflow.yaml (atomic, with lock).

    Architecture §9.3: apply requires expected hash + project lock → atomic replace.
    Architecture §3.4: active Run route is frozen; this only affects new Runs.
    """
    wf_path = project_root / ".harness" / "workflow.yaml"
    new_hash = hashlib.sha256(yaml_content.encode()).hexdigest()

    # Read current and verify hash
    if wf_path.is_file() and not expected_hash:
        return {"success": False, "error": "EXPECTED_HASH_REQUIRED"}
    if wf_path.is_file() and expected_hash:
        with open(wf_path, "rb") as f:
            current_hash = hashlib.sha256(f.read()).hexdigest()
        if current_hash != expected_hash:
            return {"success": False, "error": "HASH_MISMATCH",
                    "current_hash": current_hash, "expected_hash": expected_hash}

    # Apply 不能信任 Renderer 的 Preview 结果，落盘前必须独立重做完整校验。
    validation = validate_draft_content(yaml_content, project_root)
    if not validation["success"]:
        return {
            "success": False,
            "error": "WORKFLOW_VALIDATION_FAILED",
            "diagnostics": validation["diagnostics"],
        }

    # Apply with project lock
    try:
        with ProjectLock(project_root, timeout=5):
            # Atomic write via temp file
            import tempfile, os
            parent = wf_path.parent
            fd, tmp = tempfile.mkstemp(dir=str(parent), prefix=".tmp-wf-", suffix=".yaml")
            try:
                with os.fdopen(fd, "wb") as f:
                    f.write(yaml_content.encode())
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(tmp, str(wf_path))
            except Exception:
                if os.path.exists(tmp):
                    os.unlink(tmp)
                raise
        return {"success": True, "hash": new_hash}
    except TimeoutError:
        return {"success": False, "error": "PROJECT_LOCK_TIMEOUT"}
