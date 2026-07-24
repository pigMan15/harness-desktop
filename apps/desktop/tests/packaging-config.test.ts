import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const desktopRoot = path.resolve(__dirname, '..')

describe('Desktop packaging configuration', () => {
  it('declares the TypeScript loader required by Forge 7.4', () => {
    const packageJson = JSON.parse(readFileSync(path.join(desktopRoot, 'package.json'), 'utf8'))

    expect(packageJson.devDependencies['ts-node']).toBe('10.9.2')
  })

  it('unpacks node-pty and externalizes all Node builtin spellings', () => {
    const forge = readFileSync(path.join(desktopRoot, 'forge.config.ts'), 'utf8')
    const mainVite = readFileSync(path.join(desktopRoot, 'vite.main.config.ts'), 'utf8')

    expect(forge).toContain("asar: { unpackDir: path.join('node_modules', 'node-pty') }")
    expect(forge).not.toContain('asarUnpack')
    expect(mainVite).toContain("import { builtinModules } from 'node:module'")
    expect(mainVite).toContain("`node:${name}`")
    expect(mainVite).toContain("external: ['electron', 'node-pty', ...nodeBuiltins]")
  })

  it('copies the resolved node-pty package into the app staging directory before ASAR', () => {
    const forge = readFileSync(path.join(desktopRoot, 'forge.config.ts'), 'utf8')

    expect(forge).toContain("createRequire")
    expect(forge).toContain('copyNodePtyToStaging')
    expect(forge).toContain('afterCopy')
  })

  it('can use an audited local Electron ZIP directory for offline packaging', () => {
    const forge = readFileSync(path.join(desktopRoot, 'forge.config.ts'), 'utf8')

    expect(forge).toContain('HARNESS_ELECTRON_ZIP_DIR')
    expect(forge).toContain('electronZipDir')
  })
})
