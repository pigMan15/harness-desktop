# Interface Test

- GitHub Actions run: `29978736826`, status `completed`, conclusion `success`.
- Release URL: https://github.com/pigMan15/harness-desktop/releases/tag/desktop-v0.1.0
- Release state: `draft=false`, `prerelease=false`, tag `desktop-v0.1.0`.
- `git ls-remote origin refs/heads/main`: `5b20ad8d5e886cb57de0db0a5a26213850b4f643`.
- `git ls-remote origin refs/tags/desktop-v0.1.0^{}`: `d0f8032f792b4a8361ddd3daf80f54895c8c3b1c`.

## Uploaded assets

| Asset | State | Bytes | Public SHA-256 digest |
| --- | --- | ---: | --- |
| `Harness.Desktop-0.1.0.Setup.exe` | uploaded | 128051200 | `ea5ee2075c4a19e28a4ede6f2f9d00425fcaa6ad9d0cca3ef85bfa83314e0fdc` |
| `harness-desktop-0.1.0-full.nupkg` | uploaded | 127259858 | `170e601acaa3d7a3db353db76e3bf06ca8c8ee9d6ab422168a437dc47c684f93` |

## Download interface

- GitHub REST `GET /repos/pigMan15/harness-desktop/releases/tags/desktop-v0.1.0`: PASS; public Release metadata and both assets returned.
- Asset state checks: PASS; both assets report `state=uploaded`, `download_count=0` at verification time.
- Release target: PASS; Release is non-draft and non-prerelease.
- No local GitHub browser login was used; Actions used the repository-provided `GITHUB_TOKEN`.

## Local packaged behavior

- Elevated Windows smoke: PASS; new package started Runtime, imported the project with `health=healthy`, rejected a missing path, listed the project and displayed `Selected`.
- Restricted sandbox smoke: BLOCKED by AppData cache permission and Electron GPU process initialization; this is recorded as an environment limitation, not a Release asset failure.
