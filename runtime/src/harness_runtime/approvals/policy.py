"""Approval policy — classifies requests and enforces constraints.

Architecture §5.3: 8 categories — file, command, network, external, deploy, delete, perm, dangerous_git.
Architecture §5.3: allow-once, deny, controlled prefix; forbid generic shell/python prefixes.
"""

from typing import Optional

APPROVAL_CATEGORIES = [
    "file", "command", "network", "external",
    "deploy", "delete", "permission", "dangerous_git",
]

FORBIDDEN_PREFIXES = [
    "bash", "sh", "zsh", "python", "python3", "py",
    "cmd", "powershell", "pwsh",
]

DANGEROUS_GIT_COMMANDS = [
    "push --force", "push -f", "hard reset", "clean -f",
]


def classify_request(tool: str, params: dict) -> str:
    """Classify an executor tool call into an approval category."""
    if tool in ("write_file", "read_file", "replace_in_file"):
        return "file"
    if tool in ("execute_command", "run_command", "shell"):
        return "command"
    if tool in ("web_fetch", "web_search", "http_request"):
        return "network"
    if tool in ("delete_file", "rm", "unlink"):
        return "delete"
    if tool in ("git", "version_control"):
        return _classify_git(params)
    return "external"


def _classify_git(params: dict) -> str:
    cmd = params.get("command", "")
    for dangerous in DANGEROUS_GIT_COMMANDS:
        if dangerous in cmd:
            return "dangerous_git"
    return "file"


def is_forbidden(command: str) -> Optional[str]:
    """Check if a command uses a forbidden prefix (generic shell/python).

    Returns the forbidden prefix if found, None if allowed.
    Architecture §5.3: forbid generic shell/python prefixes.
    """
    cmd = command.strip().split()[0] if command.strip() else ""
    for prefix in FORBIDDEN_PREFIXES:
        if cmd == prefix or cmd.endswith(f"/{prefix}"):
            return prefix
    return None


def requires_second_confirmation(category: str) -> bool:
    """Check if this category requires a second confirmation.

    Architecture §5.3: deploy, delete, and force-push require double confirmation.
    """
    return category in ("deploy", "delete", "dangerous_git")
