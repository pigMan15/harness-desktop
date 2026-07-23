# Pre-release Deployment

- Target: GitHub repository `pigMan15/harness-desktop`, `main`, and a formal GitHub Release.
- Product version: `0.1.0`.
- Planned tag: `desktop-v0.1.0`.
- Source commit: pending the versioned release commit.
- Release title: `Harness Desktop 0.1.0 - Project Import and Workflow Alignment`.
- Previous `desktop-v0.0.0-20260723` tag: already pushed but never released; it is not moved or reused.

## Build outputs

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `Harness Desktop-0.1.0 Setup.exe` | 189515264 | `201C2A18FBE526459EB7D04FECA1CF4B4CD8F89F30A9300210EE62870DFBCBE6` |
| `harness-desktop-0.1.0-full.nupkg` | 188708275 | `A5256F76CE8E06D07533B0112D965A54BF99D44A067E0CEE115B820FD65FB132` |
| fresh `runtime/harness-runtime.exe` | 41113548 | `2D9BEAE3BE4DC0635870C5579D55938A9C6FF9E18138B81E22FE3AB758C0ACFA` |

The same Runtime hash was verified in `apps/desktop/resources/harness-runtime.exe` and the unpacked app resources.

## Deployment checks

- Version sources updated to `0.1.0` across Desktop, Renderer, Contracts, Runtime, Forge metadata, runtime handshake headers, tests and README packaging examples.
- Runtime clean PyInstaller build completed from source; no old runtime binary was used as input.
- Packaged app metadata extracted from `app.asar`: package version `0.1.0`, main entry `.vite/build/main.js`, CJS Main and renderer entry present.
- Unprivileged packaged smoke was blocked by this sandbox's AppData cache permission and GPU process failure.
- Elevated real-user packaged smoke passed: Runtime healthy, project import healthy, invalid path rejected, project listed and selected.

## Rollback

- Do not move the old tag. If the new release is wrong, keep both immutable tags and publish a corrected version tag.
- Before Release creation, stop on any asset hash or package metadata mismatch.
- After Release creation, remove only incorrect assets; if downloaded externally, publish a new corrected tag rather than replacing the tag.

## Current result

- Commit, `desktop-v0.1.0` tag, GitHub Release creation and asset upload are still pending.
