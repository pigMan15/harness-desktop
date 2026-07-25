import shutil
import tempfile
from pathlib import Path

import pytest

from harness_runtime.projects.bootstrap import (
    apply_bootstrap,
    expected_files,
    get_template_root,
    list_missing_files,
)


def test_expected_files_exclude_history_but_keep_runtime_directories():
    files = expected_files()

    assert "state.json" in files
    assert "runs/local-initial/state.json" in files
    assert "phases/local-initial/.gitkeep" in files
    assert not any(
        path.startswith("runs/")
        and path != "runs/.gitkeep"
        and "local-initial/state.json" not in path
        for path in files
    )
    assert not any(
        path.startswith("phases/")
        and path not in {"phases/.gitkeep", "phases/local-initial/.gitkeep"}
        for path in files
    )
    assert "runs/desktop-foundation-20260721/state.json" not in files


def test_template_root_prefers_packaged_meipass(monkeypatch, tmp_path):
    source = Path(__file__).resolve().parents[3] / "fixtures" / "harness-v1"
    packaged = tmp_path / "fixtures" / "harness-v1"
    shutil.copytree(source, packaged)
    monkeypatch.setattr("sys._MEIPASS", str(tmp_path), raising=False)

    assert get_template_root() == packaged / "valid-project" / ".harness"


def test_missing_files_does_not_create_a_harness_directory():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)

        missing = list_missing_files(root)

        assert missing
        assert "AGENTS.md" in missing
        assert "CLAUDE.md" in missing
        assert not (root / ".harness").exists()


def test_initialization_creates_root_agent_guides(tmp_path):
    result = apply_bootstrap(tmp_path, "initialize")

    assert "AGENTS.md" in result["createdRootFiles"]
    assert "CLAUDE.md" in result["createdRootFiles"]
    assert (tmp_path / "AGENTS.md").is_file()
    assert (tmp_path / "CLAUDE.md").is_file()
    assert ".harness/" in (tmp_path / "AGENTS.md").read_text(encoding="utf-8")


def test_existing_root_agent_guides_are_merged_without_overwriting_custom_content(tmp_path):
    (tmp_path / "AGENTS.md").write_text("custom agents", encoding="utf-8")

    result = apply_bootstrap(tmp_path, "initialize")

    assert "AGENTS.md" not in result["createdRootFiles"]
    assert "AGENTS.md" in result["updatedRootFiles"]
    assert "CLAUDE.md" in result["createdRootFiles"]
    agents = (tmp_path / "AGENTS.md").read_text(encoding="utf-8")
    assert agents.startswith("custom agents")
    assert "HARNESS ROOT GUIDE START" in agents
    assert ".harness/state.json" in agents


def test_existing_root_agent_guides_replace_managed_block(tmp_path):
    (tmp_path / "AGENTS.md").write_text(
        "custom agents\n\n"
        "<!-- HARNESS ROOT GUIDE START -->\n"
        "old managed guide\n"
        "<!-- HARNESS ROOT GUIDE END -->\n",
        encoding="utf-8",
    )

    missing = list_missing_files(tmp_path)
    result = apply_bootstrap(tmp_path, "initialize")

    agents = (tmp_path / "AGENTS.md").read_text(encoding="utf-8")
    assert "AGENTS.md" in missing
    assert "AGENTS.md" in result["updatedRootFiles"]
    assert "custom agents" in agents
    assert "old managed guide" not in agents
    assert agents.count("HARNESS ROOT GUIDE START") == 1


def test_existing_state_does_not_require_local_initial_runtime_files(tmp_path):
    source = Path(__file__).resolve().parents[3] / "fixtures" / "harness-v1" / "valid-project"
    shutil.copytree(source, tmp_path, dirs_exist_ok=True)
    (tmp_path / ".harness" / "runs" / "local-initial" / "state.json").unlink()
    (tmp_path / ".harness" / "phases" / "local-initial" / ".gitkeep").unlink()

    missing = list_missing_files(tmp_path)

    assert "runs/local-initial/state.json" not in missing
    assert "phases/local-initial/.gitkeep" not in missing


def test_existing_harness_symlink_is_rejected(tmp_path):
    target = tmp_path / "outside"
    target.mkdir()
    harness = tmp_path / ".harness"
    try:
        harness.symlink_to(target, target_is_directory=True)
    except (OSError, NotImplementedError):
        pytest.skip("symlinks are not available on this test host")

    with pytest.raises(ValueError, match="SYMLINK"):
        list_missing_files(tmp_path)


def test_failed_initialization_rolls_back_created_files_and_directories(monkeypatch, tmp_path):
    import harness_runtime.projects.bootstrap as bootstrap

    original_create = bootstrap._create_exclusive
    calls = 0

    def fail_after_first(target, content):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise OSError("simulated write failure")
        return original_create(target, content)

    monkeypatch.setattr(bootstrap, "_create_exclusive", fail_after_first)

    with pytest.raises(OSError, match="simulated write failure"):
        apply_bootstrap(tmp_path, "initialize")

    assert not (tmp_path / ".harness").exists()
