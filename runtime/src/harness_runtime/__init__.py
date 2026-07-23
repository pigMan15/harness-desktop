"""Harness Desktop Runtime — .harness v1.0 protocol adapter.

This package provides the Python backend for Harness Desktop:
- API layer with authenticated health check and JSON-RPC endpoints
- Protocol adapter for loading and validating .harness v1.0 projects
- Workflow compiler merging system minimum rules with project custom rules
- Run service, dispatcher, gate engine, artifact service, and executor manager

M1 scope: API health check + authentication handshake only.
"""

__version__ = "0.1.0"
