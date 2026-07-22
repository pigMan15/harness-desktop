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

    # Print the assigned port to stdout — Electron Main reads this.
    # Bind the socket first to get the actual port (port=0 = random).
    import socket as _socket
    _sock = _socket.socket(_socket.AF_INET, _socket.SOCK_STREAM)
    _sock.bind(("127.0.0.1", 0))
    port = _sock.getsockname()[1]
    _sock.close()
    config.port = port
    print(f"PORT:{port}", flush=True)

    server.run()


if __name__ == "__main__":
    main()
