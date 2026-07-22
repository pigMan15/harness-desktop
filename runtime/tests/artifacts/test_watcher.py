"""Tests for artifact watcher."""

import tempfile
import unittest
from pathlib import Path

from harness_runtime.artifacts.watcher import ArtifactWatcher, diff_snapshots, snapshot_artifacts


class TestArtifactWatcher(unittest.TestCase):
    def test_snapshot_artifacts_lists_regular_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            phase = Path(tmp) / ".harness" / "phases" / "run"
            phase.mkdir(parents=True)
            (phase / "a.md").write_text("hello", encoding="utf-8")

            snapshot = snapshot_artifacts(phase)

            self.assertEqual(set(snapshot), {"a.md"})
            self.assertEqual(snapshot["a.md"].type, "markdown")
            self.assertEqual(len(snapshot["a.md"].sha256), 64)

    def test_diff_snapshots_reports_create_modify_delete(self):
        with tempfile.TemporaryDirectory() as tmp:
            phase = Path(tmp) / "phase"
            phase.mkdir()
            (phase / "a.md").write_text("a", encoding="utf-8")
            before = snapshot_artifacts(phase)

            (phase / "a.md").write_text("changed", encoding="utf-8")
            (phase / "b.json").write_text("{}", encoding="utf-8")
            changes = diff_snapshots(before, snapshot_artifacts(phase))

            self.assertEqual({change.type for change in changes}, {"created", "modified"})
            self.assertEqual({change.name for change in changes}, {"a.md", "b.json"})

            after = snapshot_artifacts(phase)
            (phase / "a.md").unlink()
            deleted = diff_snapshots(after, snapshot_artifacts(phase))
            self.assertEqual(deleted[0].type, "deleted")
            self.assertEqual(deleted[0].name, "a.md")

    def test_watcher_scan_does_not_modify_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            phase = Path(tmp) / "phase"
            phase.mkdir()
            watched = phase / "evidence.json"
            watched.write_text("{}", encoding="utf-8")
            watcher = ArtifactWatcher(phase)

            self.assertEqual(watcher.scan(), [])
            watched.write_text('{"ok": true}', encoding="utf-8")
            changes = watcher.scan()

            self.assertEqual(changes[0].type, "modified")
            self.assertEqual(watched.read_text(encoding="utf-8"), '{"ok": true}')


if __name__ == "__main__":
    unittest.main()
