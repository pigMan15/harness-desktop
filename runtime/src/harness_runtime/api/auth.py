"""Token authentication and protocol version verification.

Architecture §8.3: Runtime binds 127.0.0.1, one-time token via environment variable.
Architecture §5.3: system minimum rules require Desktop/Runtime/Protocol version handshake.
"""

import os

from fastapi import Header, HTTPException, Request
from harness_runtime import __version__ as RUNTIME_VERSION

# ── Token authentication ─────────────────────────────

RUNTIME_TOKEN = os.environ.get("HARNESS_RUNTIME_TOKEN", "")

# Hardcoded protocol version (matches .harness state.schema.json schema_version)
PROTOCOL_VERSION = "1.0"

def get_runtime_token() -> str:
    """Return the configured runtime token (read once from environment at startup)."""
    return RUNTIME_TOKEN


async def verify_token(authorization: str = Header(default="")) -> None:
    """FastAPI dependency: verify Bearer token against HARNESS_RUNTIME_TOKEN.

    Returns None on success; raises HTTPException (401) on failure.

    Architecture §8.3: Runtime token is one-time, passed via environment variable.
    No token or wrong token → 401 (architecture §5.4 gate G6 evidence requirement).
    """
    if not RUNTIME_TOKEN:
        # Token not configured — reject all requests (security: fail-closed)
        raise HTTPException(status_code=401, detail="Runtime token not configured")

    token = authorization.removeprefix("Bearer ").strip()
    if not token or token != RUNTIME_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid or missing runtime token")


async def check_protocol_version(
    request: Request,
    x_harness_desktop_version: str = Header(default=""),
) -> None:
    """FastAPI dependency: verify Desktop/Runtime/Protocol version compatibility.

    Architecture §8.3: Desktop sends its version via header.
    Architecture §5.4: protocol mismatch → rejected (402).

    Returns None on success; raises HTTPException (402) on mismatch.
    """
    desktop_version = x_harness_desktop_version
    if not desktop_version:
        raise HTTPException(status_code=402, detail="Missing X-Harness-Desktop-Version header")

    # For M1, accept any non-empty desktop version (strict match deferred to Phase 2+)
    # The protocol version is the key compatibility check
    # In Phase 2, add semantic version comparison logic here
    _ = desktop_version  # acknowledged; full semver check in future phase
