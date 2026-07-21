"""Tests for Approval Policy (Task 5.3)."""

from harness_runtime.approvals.policy import classify_request, is_forbidden, requires_second_confirmation


class TestClassify:
    def test_file_tool(self):
        assert classify_request("write_file", {}) == "file"
        assert classify_request("read_file", {}) == "file"

    def test_command_tool(self):
        assert classify_request("execute_command", {"command": "ls"}) == "command"

    def test_network_tool(self):
        assert classify_request("web_fetch", {"url": "https://example.com"}) == "network"

    def test_delete_tool(self):
        assert classify_request("delete_file", {"path": "test.py"}) == "delete"

    def test_dangerous_git_tool(self):
        assert classify_request("git", {"command": "push --force origin main"}) == "dangerous_git"

    def test_safe_git_tool(self):
        assert classify_request("git", {"command": "status"}) == "file"


class TestForbidden:
    def test_forbidden_shell(self):
        assert is_forbidden("bash -c 'rm -rf /'") == "bash"
        assert is_forbidden("python -c 'import os'") == "python"
        assert is_forbidden("cmd /c del") == "cmd"

    def test_allowed_command(self):
        assert is_forbidden("npm test") is None
        assert is_forbidden("pytest -v") is None
        assert is_forbidden("git status") is None


class TestSecondConfirmation:
    def test_deploy_needs_second(self):
        assert requires_second_confirmation("deploy")

    def test_delete_needs_second(self):
        assert requires_second_confirmation("delete")

    def test_dangerous_git_needs_second(self):
        assert requires_second_confirmation("dangerous_git")

    def test_file_no_second(self):
        assert not requires_second_confirmation("file")

    def test_network_no_second(self):
        assert not requires_second_confirmation("network")
