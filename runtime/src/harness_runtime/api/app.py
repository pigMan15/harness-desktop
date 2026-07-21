"""FastAPI application for Harness Desktop Runtime.

Architecture §8.3: Runtime is the single authoritative writer for .harness state.
Architecture §14: Runtime listens only on 127.0.0.1, CORS restricted to localhost.

M1 scope: GET /health endpoint only.
"""

import os
from typing import Any

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import PROTOCOL_VERSION, RUNTIME_VERSION, check_protocol_version, get_runtime_token, verify_token

app = FastAPI(
    title="Harness Desktop Runtime",
    version=RUNTIME_VERSION,
    docs_url=None,  # Disable OpenAPI docs in production (security)
    redoc_url=None,
)

# CORS: only allow localhost origins (Renderer is served via file:// or localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:*", "http://localhost:*", "file://"],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type", "X-Harness-Desktop-Version"],
)


@app.get("/health")
async def health(
    _token_ok: None = Depends(verify_token),
    _version_ok: None = Depends(check_protocol_version),
) -> dict[str, Any]:
    """Runtime health check (architecture §11: runtime.health).

    Requires valid Bearer token (401 if missing/wrong).
    Requires X-Harness-Desktop-Version header (402 if protocol version mismatch).

    Returns Desktop/Runtime/Protocol versions and process information.
    """
    return {
        "status": "healthy",
        "runtime_version": RUNTIME_VERSION,
        "protocol_version": PROTOCOL_VERSION,
        "pid": os.getpid(),
        "python_version": os.sys.version,
    }
