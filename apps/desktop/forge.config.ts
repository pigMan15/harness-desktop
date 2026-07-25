import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { VitePlugin } from '@electron-forge/plugin-vite'
import type { HookFunction } from '@electron/packager'
import { cp } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const electronZipDir = process.env.HARNESS_ELECTRON_ZIP_DIR?.trim()
const requireFromConfig = createRequire(path.resolve('forge.config.ts'))
const nodePtySource = path.dirname(requireFromConfig.resolve('node-pty/package.json'))

const copyNodePtyToStaging: HookFunction = (buildPath, _electronVersion, _platform, _arch, callback) => {
  // pnpm 的 hoisted 原生依赖可能落在 package 根；复制进 staging 才能让 ASAR Main 通过虚拟 node_modules 解析。
  cp(nodePtySource, path.join(buildPath, 'node_modules', 'node-pty'), { recursive: true, force: true })
    .then(() => callback())
    .catch((cause: Error) => callback(cause))
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: { unpackDir: path.join('node_modules', 'node-pty') },
    afterCopy: [copyNodePtyToStaging],
    // 仅在发布环境显式指定时复用已审计 ZIP；Packager 仍会校验目录和精确版本文件名。
    ...(electronZipDir ? { electronZipDir } : {}),
    name: 'Harness Desktop',
    appVersion: '0.2.1',
    extraResource: [
      'resources/harness-runtime.exe',
    ],
  },
  rebuildConfig: {
    onlyModules: ['node-pty'],
  },
  makers: [
    new MakerSquirrel({
      name: 'harness-desktop',
      loadingGif: undefined,
      noMsi: true,
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: '../../apps/renderer/vite.config.ts',
        },
      ],
    }),
  ],
}

export default config
