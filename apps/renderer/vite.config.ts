import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

import type { AddressInfo } from 'node:net'
import path from 'node:path'

// Output renderer build into the desktop's .vite directory so Electron Forge can find it
const desktopDir = path.resolve(__dirname, '..', 'desktop')

function exposeRendererDevServer(name: string): Plugin {
  const envKey = `${name.toUpperCase()}_VITE_DEV_SERVER_URL`
  return {
    name: 'harness:expose-renderer-dev-server',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address() as AddressInfo | null
        if (address?.port) process.env[envKey] = `http://localhost:${address.port}`
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), exposeRendererDevServer('main_window')],
  base: './',
  root: path.resolve(__dirname),
  build: {
    outDir: path.join(desktopDir, '.vite', 'renderer', 'main_window'),
    emptyOutDir: true,
  },
})
