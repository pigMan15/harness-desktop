import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    test: {
      name: '@harness/desktop',
      root: 'apps/desktop',
      environment: 'node',
      include: ['tests/**/*.{test,spec}.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/.vite/**'],
    },
  },
  {
    test: {
      name: '@harness/renderer',
      root: 'apps/renderer',
      environment: 'node',
      include: ['src/**/*.{test,spec}.ts?(x)'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/.vite/**'],
    },
  },
  {
    test: {
      name: '@harness/contracts',
      root: 'packages/contracts',
      environment: 'node',
      include: ['tests/**/*.{test,spec}.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
    },
  },
])
