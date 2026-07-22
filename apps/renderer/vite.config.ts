import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import path from 'node:path'

// Output renderer build into the desktop's .vite directory so Electron Forge can find it
const desktopDir = path.resolve(__dirname, '..', 'desktop')

export default defineConfig({
  plugins: [react()],
  base: './',
  root: path.resolve(__dirname),
  build: {
    outDir: path.join(desktopDir, '.vite', 'renderer', 'main_window'),
    emptyOutDir: true,
  },
})
