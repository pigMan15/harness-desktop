import { builtinModules } from 'node:module'
import type { ConfigEnv } from 'vite'
import { defineConfig } from 'vite'

type ForgeConfigEnv = ConfigEnv & {
  root: string
  forgeConfigSelf: { entry?: string }
}

// Electron Main 必须保留 Node 内置模块调用；同时覆盖裸名称和 node: 前缀，避免 Vite 按浏览器模块替换。
const nodeBuiltins = builtinModules.flatMap((name) => name.startsWith('node:') ? [name] : [name, `node:${name}`])

export default defineConfig((environment) => {
  const forge = environment as ForgeConfigEnv
  return {
    root: forge.root,
    build: {
      emptyOutDir: false,
      outDir: '.vite/build',
      minify: environment.command === 'build',
      lib: {
        entry: forge.forgeConfigSelf.entry!,
        formats: ['cjs'],
        fileName: () => 'main.js',
      },
      rollupOptions: {
        external: ['electron', 'node-pty', ...nodeBuiltins],
      },
    },
    define: {
      MAIN_WINDOW_VITE_DEV_SERVER_URL: environment.command === 'serve'
        ? JSON.stringify(process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL)
        : 'undefined',
      MAIN_WINDOW_VITE_NAME: JSON.stringify('main_window'),
    },
    resolve: {
      browserField: false,
      conditions: ['node'],
      mainFields: ['module', 'jsnext:main', 'jsnext'],
    },
  }
})
