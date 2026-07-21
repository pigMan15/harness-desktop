"""Harness Desktop Runtime entry point.

Architecture §8.3:
- Reads HARNESS_RUNTIME_TOKEN from environment.
- Binds to 127.0.0.1:0 (random available port).
- Prints the actual port to stdout for Electron Main to read.
- Token not set → exit code 1 with stderr diagnostic.

M1 scope: health endpoint only; full JSON-RPC/WebSocket in Phase 2+.
"""

import os
import sys

import uvicorn

from .api.app import app as fastapi_app
from .api.auth import RUNTIME_TOKEN


def main() -> None:
    """Start the Harness Runtime server."""
    if not RUNTIME_TOKEN:
        sys.stderr.write(
            "HARNESS_RUNTIME_TOKEN environment variable not set. "
            "The runtime cannot start without an authentication token.\n"
        )
        sys.exit(1)

    # Bind to loopback on a random available port
    config = uvicorn.Config(
        fastapi_app,
        host="127.0.0.1",
        port=0,  # OS assigns a free port
        log_level="warning",
        access_log=False,
    )
    server = uvicorn.Server(config)

    # Print the assigned port to stdout — Electron Main reads this
    # to know where to send the health-check request.
    # We need to get the port after the server starts.
    # Uvicorn doesn't expose the port before serve(), so we use a callback.
    original_run = server.run

    def run_with_port():
        for sock in server.servers.sockets if server.servers else []:
            addr = sock.getsockname()
            if addr and len(addr) >= 2:
                print(f"PORT:{addr[1]}", flush=True)
                break
        original_run()

    server.run = run_with_port  # type: ignore[method-assign]
    server.run()


if __name__ == "__main__":
    main()
