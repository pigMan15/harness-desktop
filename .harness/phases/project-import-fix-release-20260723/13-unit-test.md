# Unit Test Evidence

- Desktop Vitest: PASS, 2 files and 12 tests; ran with `--no-cache` to avoid a Windows cache-file permission failure.
- Renderer Vitest: PASS, 4 files and 12 tests.
- Contracts Vitest: PASS, 1 file and 7 tests.
- Runtime first full run: 213/214 passed; one test was blocked by Git discovering the repository above an in-repository pytest temp directory.
- Runtime full retry with `GIT_CEILING_DIRECTORIES=G:\Project\ai\harness-desktop`: PASS, 214 tests, 1 warning.
- Runtime version focused tests: PASS, 5 tests; health response reports `runtime_version=0.1.0`.

The only warning is the existing Starlette/httpx deprecation warning; no test failure remains unexplained.
