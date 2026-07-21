"""ZIP Import/Export for Workflow packages.

Architecture §9.3: export contains workflow + related agent + gate files.
Import rejects Zip Slip, symlinks, and oversized files.
"""

import io
import zipfile
from pathlib import Path
from typing import Optional

MAX_FILE_SIZE = 1_000_000  # 1 MB per file
MAX_TOTAL_SIZE = 10_000_000  # 10 MB total ZIP


def export_workflow_zip(
    workflow_yaml: str,
    agent_files: Optional[dict[str, str]] = None,
    gate_yaml: Optional[str] = None,
) -> bytes:
    """Create a ZIP file containing workflow + optional agents + gates.

    Returns the ZIP file as bytes.
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("workflow.yaml", workflow_yaml)
        if agent_files:
            for name, content in agent_files.items():
                # Sanitize: only allow .md files in agents/ subdirectory
                safe_name = f"agents/{Path(name).name}"
                if not safe_name.endswith(".md"):
                    continue
                zf.writestr(safe_name, content)
        if gate_yaml:
            zf.writestr("gates.yaml", gate_yaml)
    return buf.getvalue()


def import_workflow_zip(zip_data: bytes) -> dict:
    """Import a workflow ZIP file with security checks.

    Returns {"workflow_yaml": str, "agent_files": {name: content}, "gate_yaml": str|None}.

    Security (architecture §14):
    - Rejects Zip Slip (.. or absolute paths in entry names)
    - Rejects symlinks
    - Rejects oversized files (>1MB per file, >10MB total)
    - Rejects non-.md agent files outside agents/
    """
    if len(zip_data) > MAX_TOTAL_SIZE:
        raise ValueError(f"ZIP file too large: {len(zip_data)} bytes (max {MAX_TOTAL_SIZE})")

    result: dict = {"workflow_yaml": "", "agent_files": {}, "gate_yaml": None}

    with zipfile.ZipFile(io.BytesIO(zip_data), "r") as zf:
        for info in zf.infolist():
            name = info.filename

            # Security: no absolute paths
            if name.startswith("/") or name.startswith("\\"):
                raise ValueError(f"Absolute path rejected: {name!r}")

            # Security: no Zip Slip (.. traversal)
            if ".." in Path(name).parts:
                raise ValueError(f"Path traversal rejected: {name!r}")

            # Security: reject symlinks
            # zipfile doesn't expose symlinks directly; check external_attr
            # (Unix permissions: symlink = 0o120000)
            if (info.external_attr >> 16) & 0o120000 == 0o120000:
                raise ValueError(f"Symlink rejected: {name!r}")

            # Security: size limit
            if info.file_size > MAX_FILE_SIZE:
                raise ValueError(f"File too large: {name!r} ({info.file_size} bytes)")

            content = zf.read(name).decode("utf-8")

            if name == "workflow.yaml":
                result["workflow_yaml"] = content
            elif name == "gates.yaml":
                result["gate_yaml"] = content
            elif name.startswith("agents/") and name.endswith(".md"):
                agent_name = Path(name).name
                result["agent_files"][agent_name] = content

    if not result["workflow_yaml"]:
        raise ValueError("ZIP file must contain workflow.yaml")

    return result
