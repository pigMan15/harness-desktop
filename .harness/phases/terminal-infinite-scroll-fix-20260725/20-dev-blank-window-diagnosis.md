# Dev Blank Window Diagnosis

## Symptom

Starting the `0.2.0` worktree with `pnpm --filter @harness/desktop dev` can open an empty window.

## Cause

`apps/desktop/vite.main.config.ts` defined `MAIN_WINDOW_VITE_DEV_SERVER_URL` as the string expression `undefined` for non-serve builds. The generated main bundle in `.vite/build/main.js` folded away the `loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)` branch and kept only `loadFile(...)`.

In dev mode this makes Electron try to load:

```text
apps/desktop/.vite/renderer/main_window/index.html
```

That file was missing in the worktree, resulting in a blank window.

## Fix

Changed the fallback define value from string `'undefined'` to JavaScript `undefined`, matching Electron Forge's Vite template behavior.

Follow-up runtime log still showed:

```text
[Main] Loading renderer from: ...apps\desktop\.vite\renderer\main_window\index.html
[Main] Renderer FAILED: -6 ERR_FILE_NOT_FOUND
```

That means this Forge invocation still built main without a compile-time dev-server constant. Main now also checks `process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL` at runtime before falling back to `loadFile(...)`.

Final root cause: `apps/renderer/vite.config.ts` did not expose the renderer dev server URL to Electron Forge. The Forge Vite plugin starts renderer dev servers before building main, but the project must set `process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL` when the renderer server begins listening. Without that env value, main cannot compile or resolve the dev `loadURL(...)` target.

Added `exposeRendererDevServer('main_window')` to the renderer Vite plugins. It sets:

```text
MAIN_WINDOW_VITE_DEV_SERVER_URL=http://localhost:<port>
```

before the main bundle is compiled.

## Verification

Static check:

```powershell
Select-String -Path apps\desktop\vite.main.config.ts -Pattern "MAIN_WINDOW_VITE_DEV_SERVER_URL|: undefined|: 'undefined'" -Context 0,2
```

Result:

```text
MAIN_WINDOW_VITE_DEV_SERVER_URL: environment.command === 'serve'
  ? JSON.stringify(process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL)
  : undefined,
```

Full runtime launch could not be completed in the current tool environment because Electron Forge fails earlier with `spawn EPERM`.

Additional static check:

```powershell
Select-String -Path apps\desktop\src\main\index.ts -Pattern "rendererDevServerUrl|loadURL|loadFile" -Context 0,3
```

Result: main chooses `loadURL(rendererDevServerUrl)` when either the compile-time constant or runtime environment variable is present; otherwise it uses the packaged `loadFile(...)` path.

Renderer config check:

```powershell
Select-String -Path apps\renderer\vite.config.ts -Pattern "exposeRendererDevServer|MAIN_WINDOW|configureServer|process.env|plugins" -Context 0,2
```

Result: renderer Vite config now installs `exposeRendererDevServer('main_window')` and writes the Forge dev server URL into `process.env`.
