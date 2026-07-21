"""Atomic file operations for safe state persistence.

Architecture §10: 写入 tmp → flush → fsync → os.replace → snapshot。
故障时旧文件保持完整，不报告假成功。
"""

import os
import tempfile
from pathlib import Path


def atomic_write(filepath: Path, content: str, encoding: str = "utf-8") -> str:
    """Write content to filepath atomically.

    Returns the SHA-256 revision hash of the written content.

    Steps (architecture §10):
    1. Write to a temporary file in the same directory
    2. Flush + fsync the temp file
    3. os.replace (atomic rename on same filesystem)
    4. Return content hash as revision
    """
    import hashlib

    content_bytes = content.encode(encoding)
    revision = hashlib.sha256(content_bytes).hexdigest()

    parent = filepath.parent
    parent.mkdir(parents=True, exist_ok=True)

    # Write to temp file in same directory (ensures same filesystem for atomic rename)
    fd, tmp_path = tempfile.mkstemp(dir=str(parent), prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(content_bytes)
            f.flush()
            os.fsync(f.fileno())
        # Atomic replace (Windows: os.replace is atomic on NTFS)
        os.replace(tmp_path, str(filepath))
    except Exception:
        # Clean up temp file on failure
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise

    return revision


def atomic_read(filepath: Path, encoding: str = "utf-8") -> str:
    """Read file content. Returns empty string if file does not exist."""
    if not filepath.is_file():
        return ""
    with open(filepath, "r", encoding=encoding) as f:
        return f.read()
