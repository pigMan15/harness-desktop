"""PyInstaller launcher — avoids relative import issues in frozen builds.

Uses absolute imports which work in both development and frozen contexts.
"""
import sys
from pathlib import Path

# Ensure the runtime package is importable (both dev and frozen)
_src = Path(__file__).resolve().parent / "src"
if str(_src) not in sys.path:
    sys.path.insert(0, str(_src))

# Absolute imports — no relative imports in frozen context
from harness_runtime.main import main

if __name__ == "__main__":
    main()
