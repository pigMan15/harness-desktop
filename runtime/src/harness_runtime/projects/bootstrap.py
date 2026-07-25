"""Safely bootstrap the static files of a Harness v1 project."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from ..persistence.project_lock import ProjectLock

INITIAL_RUN_ID = "local-initial"
_GENERATED_FILES = {"state.json", "runs/local-initial/state.json"}
_INITIAL_RUNTIME_MARKERS = {
    "runs/.gitkeep",
    "phases/.gitkeep",
    "phases/local-initial/.gitkeep",
}
_ROOT_GUIDE_START = "<!-- HARNESS ROOT GUIDE START -->"
_ROOT_GUIDE_END = "<!-- HARNESS ROOT GUIDE END -->"
_ROOT_GUIDES = {
    "AGENTS.md": """# 项目 Harness 入口

本项目使用 `.harness/` 作为 AI Coding 工程化流程的唯一事实来源。

## 硬性约束

1. 涉及源码变更、构建、测试、部署或问题排查的任务必须经过 harness。
2. `intent` 和 `risk` 以 `.harness/state.json` 或用户创建 run 时的选择为准。
3. 不得跳过 dispatcher 路由出的必需节点。
4. 阶段产物必须写入当前 `state.phase_dir`。
5. 门禁结果必须由对应验证角色记录，不能口头替代。

## 标准入口

每次开始非简单任务时，先读取：

- `.harness/state.json`
- `.harness/workflow.yaml`
- `.harness/agents/dispatcher.md`

然后按 dispatcher 给出的节点和角色继续。
""",
    "CLAUDE.md": """# Claude Code Harness 入口

本文件是 `AGENTS.md` 的 Claude Code 版本。真正的流程事实来源是 `.harness/`。

## 使用规则

- 非简单任务必须走 harness。
- 不自行覆盖 `intent` / `risk`。
- 不跳过 dispatcher 指定节点。
- 阶段产物写入当前 `state.phase_dir`。
- 门禁和状态变更必须有文件记录。

请优先读取 `.harness/state.json`、`.harness/workflow.yaml` 和 `.harness/agents/dispatcher.md`。
""",
}


def get_template_root() -> Path:
    """Resolve the application-controlled v1 template in source and packaged runs."""
    meipass = getattr(sys, "_MEIPASS", None)
    candidates = []
    if meipass:
        candidates.append(Path(meipass) / "fixtures" / "harness-v1" / "valid-project" / ".harness")
    # 开发环境和 PyInstaller 都从同一份受控 v1 模板生成文件清单。
    candidates.append(
        Path(__file__).resolve().parents[4]
        / "fixtures"
        / "harness-v1"
        / "valid-project"
        / ".harness"
    )
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    raise RuntimeError("HARNESS_TEMPLATE_NOT_FOUND: bundled v1 template is unavailable")


def expected_files(
    template_root: Path | None = None, include_initial_state: bool = True
) -> dict[str, Path | None]:
    """Return the static and generated files required by a fresh v1 project."""
    source_root = (template_root or get_template_root()).resolve()
    if not source_root.is_dir():
        raise ValueError(f"HARNESS_TEMPLATE_NOT_FOUND: {source_root}")

    files: dict[str, Path | None] = {}
    for source in source_root.rglob("*"):
        if _is_link(source):
            raise ValueError(f"HARNESS_TEMPLATE_SYMLINK: {source}")
        if not source.is_file():
            continue
        relative = source.relative_to(source_root).as_posix()
        if _is_static_template_file(relative) or (
            include_initial_state and relative in _INITIAL_RUNTIME_MARKERS
        ):
            files[relative] = source

    if include_initial_state:
        files["state.json"] = None
        files["runs/local-initial/state.json"] = None
    return dict(sorted(files.items()))


def list_missing_files(project_root: Path) -> list[str]:
    """Preview missing files without creating the target .harness directory."""
    root = project_root.resolve()
    if not root.is_dir():
        raise ValueError(f"Project path does not exist or is not a directory: {project_root}")

    harness_dir = root / ".harness"
    if _is_link(harness_dir):
        raise ValueError(f"HARNESS_SYMLINK_REJECTED: {harness_dir}")
    if harness_dir.exists() and not harness_dir.is_dir():
        raise ValueError(f"HARNESS_PATH_INVALID: {harness_dir} is not a directory")
    root_missing = _missing_root_guides(root)
    if not harness_dir.exists():
        return sorted([*expected_files(), *root_missing])

    missing: list[str] = []
    for relative in _expected_for_existing_harness(harness_dir):
        target = _safe_target(harness_dir, relative)
        if _is_link(target):
            raise ValueError(f"HARNESS_SYMLINK_REJECTED: {target}")
        if not target.is_file():
            missing.append(relative)
    return sorted([*missing, *root_missing])


def apply_bootstrap(project_root: Path, decision: str) -> dict[str, list[str]]:
    """Create only missing files and return paths owned by this operation."""
    if decision not in {"initialize", "append"}:
        raise ValueError(f"BOOTSTRAP_DECISION_INVALID: {decision}")

    root = project_root.resolve()
    if not root.is_dir():
        raise ValueError(f"Project path does not exist or is not a directory: {project_root}")
    harness_dir = root / ".harness"
    existed_before = harness_dir.exists()
    if _is_link(harness_dir):
        raise ValueError(f"HARNESS_SYMLINK_REJECTED: {harness_dir}")
    if existed_before and not harness_dir.is_dir():
        raise ValueError(f"HARNESS_PATH_INVALID: {harness_dir} is not a directory")
    if not existed_before and decision != "initialize":
        raise ValueError(
            "BOOTSTRAP_DECISION_INVALID: append requires an existing .harness directory"
        )

    files = expected_files() if not existed_before else _expected_for_existing_harness(harness_dir)
    created_files: list[str] = []
    created_root_files: list[str] = []
    updated_root_files: list[str] = []
    root_update_originals: dict[str, bytes] = {}
    created_dirs: list[str] = []
    if not existed_before:
        # ProjectLock 会先创建 .harness；失败回滚时只能清理本次创建的目录。
        created_dirs.append(".")

    try:
        with ProjectLock(root):
            for relative, source in files.items():
                target = _safe_target(harness_dir, relative)
                if _is_link(target):
                    raise ValueError(f"HARNESS_SYMLINK_REJECTED: {target}")
                if target.exists():
                    if target.is_file():
                        continue
                    raise ValueError(f"HARNESS_TARGET_NOT_FILE: {target}")

                _create_parent_directories(harness_dir, target.parent, created_dirs)
                content = _generated_content(relative) if source is None else source.read_bytes()
                if _create_exclusive(target, content):
                    created_files.append(relative)
            for relative, content in _ROOT_GUIDES.items():
                target = _safe_root_target(root, relative)
                if target.exists():
                    if not target.is_file():
                        raise ValueError(f"HARNESS_ROOT_TARGET_NOT_FILE: {target}")
                    original = target.read_bytes()
                    merged = _merge_root_guide(original.decode("utf-8"), content).encode("utf-8")
                    if merged != original:
                        root_update_originals[relative] = original
                        target.write_bytes(merged)
                        updated_root_files.append(relative)
                    continue
                if _create_exclusive(target, _managed_root_guide(content).encode("utf-8")):
                    created_root_files.append(relative)
    except Exception:
        _rollback(root, created_files, created_dirs, created_root_files, root_update_originals)
        raise

    return {
        "createdFiles": created_files,
        "createdDirs": created_dirs,
        "createdRootFiles": created_root_files,
        "updatedRootFiles": updated_root_files,
    }


def rollback_bootstrap(project_root: Path, operation: dict[str, list[str]]) -> None:
    """Remove only files and empty directories created by a failed import."""
    _rollback(
        project_root.resolve(),
        operation.get("createdFiles", []),
        operation.get("createdDirs", []),
        operation.get("createdRootFiles", []),
    )


def _is_static_template_file(relative: str) -> bool:
    if relative in {"state.json", ".lock"}:
        return False
    if relative.startswith("runs/") or relative.startswith("phases/"):
        return False
    return True


def _expected_for_existing_harness(harness_dir: Path) -> dict[str, Path | None]:
    files = expected_files(include_initial_state=False)
    state_path = harness_dir / "state.json"
    if _is_link(state_path):
        raise ValueError(f"HARNESS_SYMLINK_REJECTED: {state_path}")
    if not state_path.is_file():
        initial_files = expected_files()
        for relative in {
            "state.json",
            "runs/local-initial/state.json",
            "phases/local-initial/.gitkeep",
        }:
            files[relative] = initial_files[relative]
    return dict(sorted(files.items()))


def _generated_content(relative: str) -> bytes:
    state = {
        "schema_version": "1.0",
        "run_id": INITIAL_RUN_ID,
        "status": "IDLE",
        "intent": "UNKNOWN",
        "risk": "UNKNOWN",
        "current_node": "INTAKE",
        "next_role": "dispatcher",
        "phase_dir": ".harness/phases/local-initial",
        "required_nodes": [],
        "completed_nodes": [],
        "blocked_by": [],
        "artifacts": {},
        "gates": {
            "G1_REQUIREMENTS": "NOT_RUN",
            "G2_DESIGN": "NOT_RUN",
            "G3_COMPILE": "NOT_RUN",
            "G4_UNIT_TEST": "NOT_RUN",
            "G5_ATDD": "NOT_RUN",
            "G6_EVIDENCE": "NOT_RUN",
            "G7_PRERELEASE": "NOT_RUN",
            "G8_ACCEPTANCE": "NOT_RUN",
        },
        "last_updated": None,
        "notes": (
            "Initialize a new run by setting run_id, intent, risk, required_nodes, "
            "and current_node."
        ),
    }
    if relative not in _GENERATED_FILES:
        return b""
    return (json.dumps(state, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _safe_target(harness_dir: Path, relative: str) -> Path:
    """Reject links and paths that resolve outside the selected project."""
    base = harness_dir.resolve()
    if _is_link(harness_dir):
        raise ValueError(f"HARNESS_SYMLINK_REJECTED: {harness_dir}")
    target = harness_dir / Path(relative)
    resolved = target.resolve()
    try:
        resolved.relative_to(base)
    except ValueError as exc:
        raise ValueError(f"HARNESS_PATH_ESCAPE: {relative}") from exc

    current = harness_dir
    for component in Path(relative).parts[:-1]:
        current = current / component
        if _is_link(current):
            raise ValueError(f"HARNESS_SYMLINK_REJECTED: {current}")
    return target


def _safe_root_target(root: Path, relative: str) -> Path:
    if relative not in _ROOT_GUIDES:
        raise ValueError(f"HARNESS_ROOT_TEMPLATE_UNKNOWN: {relative}")
    target = root / relative
    if _is_link(target):
        raise ValueError(f"HARNESS_SYMLINK_REJECTED: {target}")
    return target


def _missing_root_guides(root: Path) -> list[str]:
    missing: list[str] = []
    for relative, content in _ROOT_GUIDES.items():
        target = _safe_root_target(root, relative)
        if not target.is_file() or _root_guide_needs_update(target, content):
            missing.append(relative)
    return missing


def _managed_root_guide(content: str) -> str:
    return f"{_ROOT_GUIDE_START}\n{content.rstrip()}\n{_ROOT_GUIDE_END}\n"


def _merge_root_guide(existing: str, content: str) -> str:
    managed = _managed_root_guide(content).rstrip()
    start = existing.find(_ROOT_GUIDE_START)
    end = existing.find(_ROOT_GUIDE_END)
    if start >= 0 and end >= start:
        end += len(_ROOT_GUIDE_END)
        merged = f"{existing[:start]}{managed}{existing[end:]}"
        return _ensure_trailing_newline(merged)
    separator = "\n\n" if existing.strip() else ""
    return _ensure_trailing_newline(f"{existing.rstrip()}{separator}{managed}")


def _root_guide_needs_update(target: Path, content: str) -> bool:
    if _is_link(target):
        raise ValueError(f"HARNESS_SYMLINK_REJECTED: {target}")
    if not target.is_file():
        return True
    existing = target.read_text(encoding="utf-8")
    return _merge_root_guide(existing, content) != existing


def _ensure_trailing_newline(content: str) -> str:
    return content if content.endswith("\n") else f"{content}\n"


def _create_parent_directories(harness_dir: Path, parent: Path, created_dirs: list[str]) -> None:
    missing: list[Path] = []
    current = parent
    while current != harness_dir:
        if current.exists():
            if _is_link(current) or not current.is_dir():
                raise ValueError(f"HARNESS_PARENT_INVALID: {current}")
            break
        missing.append(current)
        current = current.parent
    for directory in reversed(missing):
        directory.mkdir()
        created_dirs.append(directory.relative_to(harness_dir).as_posix())


def _create_exclusive(target: Path, content: bytes) -> bool:
    try:
        fd = os.open(str(target), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    except FileExistsError:
        if target.is_file() and not _is_link(target):
            return False
        raise ValueError(f"HARNESS_TARGET_NOT_FILE: {target}")
    with os.fdopen(fd, "wb") as stream:
        stream.write(content)
        stream.flush()
        os.fsync(stream.fileno())
    return True


def _rollback(
    root: Path,
    created_files: list[str],
    created_dirs: list[str],
    created_root_files: list[str] | None = None,
    root_update_originals: dict[str, bytes] | None = None,
) -> None:
    harness_dir = root / ".harness"
    for relative, original in (root_update_originals or {}).items():
        target = root / relative
        try:
            if target.is_file() and not _is_link(target):
                target.write_bytes(original)
        except FileNotFoundError:
            pass
    for relative in reversed(created_root_files or []):
        target = root / relative
        try:
            if target.is_file() and not _is_link(target):
                target.unlink()
        except FileNotFoundError:
            pass
    for relative in reversed(created_files):
        target = harness_dir / relative
        try:
            if target.is_file() and not _is_link(target):
                target.unlink()
        except FileNotFoundError:
            pass
    for relative in sorted(
        (item for item in created_dirs if item != "."),
        key=lambda item: len(Path(item).parts),
        reverse=True,
    ):
        try:
            (harness_dir / relative).rmdir()
        except (FileNotFoundError, OSError):
            pass
    if "." in created_dirs:
        try:
            harness_dir.rmdir()
        except (FileNotFoundError, OSError):
            pass


def _is_link(path: Path) -> bool:
    is_junction = getattr(path, "is_junction", None)
    return path.is_symlink() or bool(is_junction and is_junction())
