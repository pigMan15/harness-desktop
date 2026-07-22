import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'main.js',
      },
      external: ['electron', 'child_process', 'crypto', 'path', 'os'],
    },
  },
  resolve: {
    browserField: false,
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
})
