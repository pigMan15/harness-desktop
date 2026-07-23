"""Integration tests for Runtime health check authentication.

Architecture §5.4: deterministic gate checks.
Architecture §17: test strategy — contract tests verify auth behavior.

Four test scenarios (implementation plan Task 1.3):
1. No token → 401
2. Wrong token → 401
3. Protocol version mismatch → 402
4. Correct token + version → 200 with version info
"""

import os

import pytest
from fastapi.testclient import TestClient

from harness_runtime.api.app import app
from harness_runtime.api.auth import PROTOCOL_VERSION, RUNTIME_VERSION


@pytest.fixture
def client():
    """Create a TestClient with the FastAPI app (no real server needed)."""
    return TestClient(app)


@pytest.fixture(autouse=True)
def setup_token(monkeypatch):
    """Set a known token for testing (overwritten per test as needed)."""
    monkeypatch.setattr(
        "harness_runtime.api.auth.RUNTIME_TOKEN", "test-token-123"
    )
    # Also set the module-level constant used at startup
    monkeypatch.setattr(
        "harness_runtime.api.app.get_runtime_token", lambda: "test-token-123"
    )


class TestHealthAuth:
    """Test the four authentication scenarios for GET /health."""

    def test_no_token_returns_401(self, client: TestClient, monkeypatch):
        """Architecture §8.3: No token → rejected (401)."""
        monkeypatch.setattr("harness_runtime.api.auth.RUNTIME_TOKEN", "test-token-123")
        response = client.get(
            "/health",
            headers={"X-Harness-Desktop-Version": "0.1.0"},
            # No Authorization header
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.json()}"

    def test_wrong_token_returns_401(self, client: TestClient):
        """Architecture §8.3: Wrong token → rejected (401)."""
        response = client.get(
            "/health",
            headers={
                "Authorization": "Bearer wrong-token",
                "X-Harness-Desktop-Version": "0.1.0",
            },
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.json()}"

    def test_missing_version_header_returns_402(self, client: TestClient):
        """Architecture §5.4: Missing protocol version header → 402."""
        response = client.get(
            "/health",
            headers={"Authorization": "Bearer test-token-123"},
            # No X-Harness-Desktop-Version header
        )
        assert response.status_code == 402, f"Expected 402, got {response.status_code}: {response.json()}"

    def test_correct_token_and_version_returns_200(self, client: TestClient):
        """Architecture §8.3: Correct token + version → 200 with health info."""
        response = client.get(
            "/health",
            headers={
                "Authorization": "Bearer test-token-123",
                "X-Harness-Desktop-Version": "0.1.0",
            },
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.json()}"
        data = response.json()
        assert data["status"] == "healthy"
        assert "runtime_version" in data
        assert "protocol_version" in data
        assert data["protocol_version"] == PROTOCOL_VERSION
        assert "pid" in data
        assert isinstance(data["pid"], int)
        assert data["pid"] > 0
