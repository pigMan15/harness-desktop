"""Workspace smoke test — verifies the runtime package is importable."""


def test_runtime_import():
    """The harness_runtime package must be importable after pip install -e."""
    import harness_runtime
    assert harness_runtime.__version__ == "0.1.0"
