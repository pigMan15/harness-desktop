"""Artifact watcher — computes safe change events for a phase_dir.

The watcher is intentionally polling/snapshot based. Runtime callers decide when
to scan and broadcast events; this module never mutates project state.
"""

import hashlib
from dataclasses import dataclass
from pathlib import Path

from .service import _get_content_type


@dataclass(frozen=True)
class ArtifactSnapshot:
    name: str
    size: int
    mtime: float
    sha256: str
    type: str


@dataclass(frozen=True)
class ArtifactChange:
    type: str
    name: str
    before: ArtifactSnapshot | None = None
    after: ArtifactSnapshot | None = None


def snapshot_artifacts(phase_dir: Path) -> dict[str, ArtifactSnapshot]:
    """Return a deterministic snapshot of regular, non-symlink phase artifacts."""
    if not phase_dir.is_dir():
        return {}

    snapshot: dict[str, ArtifactSnapshot] = {}
    phase_resolved = phase_dir.resolve()
    for path in sorted(phase_resolved.iterdir()):
        # 监听器只报告 phase_dir 内普通文件，避免符号链接逃逸后被当成可信产物。
        if not path.is_file() or path.is_symlink():
            continue
        stat = path.stat()
        snapshot[path.name] = ArtifactSnapshot(
            name=path.name,
            size=stat.st_size,
            mtime=stat.st_mtime,
            sha256=_sha256(path),
            type=_get_content_type(path.suffix.lower()),
        )
    return snapshot


def diff_snapshots(
    before: dict[str, ArtifactSnapshot],
    after: dict[str, ArtifactSnapshot],
) -> list[ArtifactChange]:
    """Compare two snapshots and return created/modified/deleted events."""
    changes: list[ArtifactChange] = []
    for name in sorted(after.keys() - before.keys()):
        changes.append(ArtifactChange(type="created", name=name, after=after[name]))
    for name in sorted(before.keys() - after.keys()):
        changes.append(ArtifactChange(type="deleted", name=name, before=before[name]))
    for name in sorted(before.keys() & after.keys()):
        if before[name] != after[name]:
            changes.append(ArtifactChange(type="modified", name=name, before=before[name], after=after[name]))
    return changes


class ArtifactWatcher:
    """Stateful polling watcher for phase artifact changes."""

    def __init__(self, phase_dir: Path):
        self.phase_dir = phase_dir
        self._snapshot = snapshot_artifacts(phase_dir)

    def scan(self) -> list[ArtifactChange]:
        current = snapshot_artifacts(self.phase_dir)
        changes = diff_snapshots(self._snapshot, current)
        self._snapshot = current
        return changes


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
