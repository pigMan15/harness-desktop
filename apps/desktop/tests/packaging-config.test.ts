import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const desktopRoot = path.resolve(__dirname, '..')

describe('Desktop packaging configuration', () => {
  it('declares the TypeScript loader required by Forge 7.4', () => {
    const packageJson = JSON.parse(readFileSync(path.join(desktopRoot, 'package.json'), 'utf8'))

    expect(packageJson.devDependencies['ts-node']).toBe('10.9.2')
  })

  it('keeps package, Forge, and Runtime client versions aligned', () => {
    const packageJson = JSON.parse(readFileSync(path.join(desktopRoot, 'package.json'), 'utf8'))
    const forge = readFileSync(path.join(desktopRoot, 'forge.config.ts'), 'utf8')
    const supervisor = readFileSync(path.join(desktopRoot, 'src', 'main', 'runtime-supervisor.ts'), 'utf8')

    expect(packageJson.version).toBe('0.2.0')
    expect(forge).toContain(`appVersion: '${packageJson.version}'`)
    expect(supervisor).toContain(`DESKTOP_VERSION = '${packageJson.version}'`)
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
