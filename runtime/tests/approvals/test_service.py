"""Tests for Approval Service."""

import unittest

from harness_runtime.approvals.service import ApprovalService


class TestApprovalService(unittest.TestCase):
    def test_create_request_classifies_and_records_audit(self):
        events = []
        service = ApprovalService(audit_recorder=lambda *args: events.append(args))

        request = service.create_request("delete_file", {"path": "out.log"}, requested_by="codex")

        self.assertEqual(request.category, "delete")
        self.assertTrue(request.second_confirmation_required)
        self.assertEqual(request.status, "pending")
        self.assertEqual(events[0][0], "approval.requested")

    def test_dangerous_request_requires_second_confirmation(self):
        service = ApprovalService()
        request = service.create_request("delete_file", {"path": "out.log"})

        with self.assertRaisesRegex(ValueError, "second confirmation"):
            service.resolve(request.id, "allow_once")

        resolved = service.resolve(request.id, "allow_once", second_confirmed=True)
        self.assertEqual(resolved.status, "allowed")

    def test_forbidden_command_is_denied_even_when_allowed(self):
        service = ApprovalService()
        request = service.create_request("execute_command", {"command": "python -c 'print(1)'"})

        resolved = service.resolve(request.id, "allow_once")

        self.assertEqual(resolved.status, "denied")
        self.assertEqual(resolved.forbidden_prefix, "python")

    def test_deny_records_decision(self):
        service = ApprovalService()
        request = service.create_request("web_fetch", {"url": "https://example.com"})

        resolved = service.resolve(request.id, "deny", actor="user", reason="不需要联网")

        self.assertEqual(resolved.status, "denied")
        self.assertEqual(resolved.decisions[0]["reason"], "不需要联网")


if __name__ == "__main__":
    unittest.main()
