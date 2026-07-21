"""Artifact Service — safe file access for phase_dir artifacts.

Architecture §14: 路径 canonicalize 后验证仍在授权根目录。
Architecture §6.4: Markdown/JSON 预览、SHA-256、安全状态。
"""

import hashlib
from pathlib import Path
from typing import Optional


def read_artifact(
    project_root: Path,
    phase_dir: Path,
    filename: str,
    max_size_mb: int = 5,
) -> dict:
    """Read an artifact file safely.

    Returns {"content": str|None, "type": str, "size": int, "mtime": float, "sha256": str, "truncated": bool}.
    Raises ValueError on path escape or unsafe access.
    """
    # Resolve and verify path containment
    art_path = (phase_dir / filename).resolve()
    phase_resolved = phase_dir.resolve()
    project_resolved = project_root.resolve()

    # Must be inside phase_dir or project_root
    try:
        art_path.relative_to(phase_resolved)
    except ValueError:
        try:
            art_path.relative_to(project_resolved)
        except ValueError:
            raise ValueError(f"Artifact path {filename!r} escapes allowed roots")

    # Reject symlinks (architecture §14)
    if art_path.exists() and art_path.is_symlink():
        raise ValueError(f"Symlinks are not allowed: {filename!r}")

    if not art_path.is_file():
        raise FileNotFoundError(f"Artifact not found: {filename}")

    stat = art_path.stat()
    size = stat.st_size
    mtime = stat.st_mtime

    # Content type based on extension
    suffix = art_path.suffix.lower()
    content_type = _get_content_type(suffix)

    # Read content
    max_bytes = max_size_mb * 1024 * 1024
    truncated = size > max_bytes

    with open(art_path, "rb") as f:
        data = f.read(max_bytes)
    sha = hashlib.sha256(data).hexdigest()

    content: Optional[str] = None
    if content_type in ("json", "markdown", "text"):
        try:
            content = data.decode("utf-8")
        except UnicodeDecodeError:
            content = f"[Binary content — {size} bytes]"

    return {
        "content": content,
        "type": content_type,
        "size": size,
        "mtime": mtime,
        "sha256": sha,
        "truncated": truncated,
    }


def list_artifacts(phase_dir: Path) -> list[dict]:
    """List all artifacts in a phase_dir."""
    if not phase_dir.is_dir():
        return []
    artifacts = []
    for f in sorted(phase_dir.iterdir()):
        if f.is_file():
            stat = f.stat()
            artifacts.append({
                "name": f.name,
                "size": stat.st_size,
                "mtime": stat.st_mtime,
                "type": _get_content_type(f.suffix.lower()),
            })
    return artifacts


def _get_content_type(suffix: str) -> str:
    mapping = {
        ".md": "markdown",
        ".json": "json",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".txt": "text",
        ".py": "text",
        ".ts": "text",
        ".tsx": "text",
        ".html": "text",
        ".css": "text",
        ".sql": "text",
    }
    return mapping.get(suffix, "binary")
