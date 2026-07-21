// Vitest workspace configuration for pnpm monorepo
// Each package in apps/ and packages/ provides its own vitest.config.ts
export default [
  'apps/*/vitest.config.ts',
  'packages/*/vitest.config.ts',
]
