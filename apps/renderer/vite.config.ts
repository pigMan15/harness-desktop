import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  base: './',
  root: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, '.vite/renderer/main_window'),
  },
})
