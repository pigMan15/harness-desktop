import type { ConfigEnv } from 'vite'
import { defineConfig } from 'vite'

type ForgeConfigEnv = ConfigEnv & {
  root: string
  forgeConfigSelf: { entry?: string }
}

export default defineConfig((environment) => {
  const forge = environment as ForgeConfigEnv
  return {
    root: forge.root,
    build: {
      emptyOutDir: false,
      outDir: '.vite/build',
      minify: environment.command === 'build',
      rollupOptions: {
        input: forge.forgeConfigSelf.entry!,
        external: ['electron'],
        output: {
          format: 'cjs',
          inlineDynamicImports: true,
          entryFileNames: 'preload.js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
        },
      },
    },
  }
})
