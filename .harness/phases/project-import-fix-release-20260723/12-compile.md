# Compile Evidence

- `tsc --noEmit -p apps/desktop/tsconfig.json`: PASS, exit 0.
- `tsc --noEmit -p apps/renderer/tsconfig.json`: PASS, exit 0.
- `tsc --noEmit -p packages/contracts/tsconfig.json`: PASS, exit 0.
- Renderer production Vite build: PASS, 227 modules transformed.
- Desktop Main/Preload production Vite build: PASS, CJS `main.js` and `preload.js` generated.
- PyInstaller 6.21.0 clean build from `runtime/harness-runtime.spec`: PASS, output in `dist-harness-desktop-0.1.0/runtime`.
- Electron Packager 31.7.7 local-zip build: PASS, output in `dist-harness-desktop-0.1.0/desktop-unpacked`.
- Squirrel.Windows installer generation: PASS, Setup and nupkg generated with `0.1.0` names.

The root `pnpm typecheck` wrapper was not used as evidence because it attempted a non-interactive modules purge; direct local TypeScript commands above are the equivalent checks.
