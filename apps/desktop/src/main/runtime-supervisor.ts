/**
 * RuntimeSupervisor — manages the Python Runtime subprocess lifecycle.
 *
 * Architecture §8.1: Electron Main starts Python, reads the handshake port
 * from stdout, completes token verification, and emits events on exit.
 *
 * Architecture §14: token is short-lived, loopback-only; process crash → event.
 * Architecture §16: on restart, probe whether the child process is still alive.
 */

import { ChildProcess, spawn } from 'node:child_process'
import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'

export interface RuntimeSupervisorEvents {
  status: (healthy: boolean) => void
  error: (err: Error) => void
}

export class RuntimeSupervisor extends EventEmitter {
  private process: ChildProcess | null = null
  token: string = ''
  port: number = 0

  /** Generate a one-time 64-char hex token for authentication. */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /** Find the Runtime executable — bundled exe first, then system Python. */
  private findRuntime(): { cmd: string; args: string[] } {
    // 1. Bundled harness-runtime.exe (packaged app)
    const bundled = path.join(process.resourcesPath, 'harness-runtime.exe')
    if (fs.existsSync(bundled)) {
      return { cmd: bundled, args: [] }
    }
    // 2. System Python via py launcher (development)
    return { cmd: 'py', args: ['-3', '-m', 'harness_runtime.main'] }
  }

  /** Start the Python Runtime and perform the authentication handshake. */
  spawn(): void {
    this.token = this.generateToken()
    const runtime = this.findRuntime()

    // Find project root: search up from cwd for .harness directory
    let projectRoot = process.cwd()
    let check = path.resolve(projectRoot)
    for (let i = 0; i < 10; i++) {
      if (fs.existsSync(path.join(check, '.harness'))) {
        projectRoot = check
        console.log('[Supervisor] Found .harness at:', projectRoot)
        break
      }
      const parent = path.dirname(check)
      if (parent === check) break
      check = parent
    }
    console.log('[Supervisor] Project root:', projectRoot)

    this.process = spawn(runtime.cmd, runtime.args, {
      env: {
        ...process.env,
        HARNESS_RUNTIME_TOKEN: this.token,
        HARNESS_PROJECT_ROOT: projectRoot,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    // Read port from stdout (Runtime prints "PORT:<number>")
    if (this.process.stdout) {
      this.process.stdout.on('data', (data: Buffer) => {
        const output = data.toString()
        const match = output.match(/PORT:(\d+)/)
        if (match) {
          this.port = parseInt(match[1], 10)
          this.performHandshake()
        }
      })
    }

    // Log errors from stderr
    if (this.process.stderr) {
      this.process.stderr.on('data', (data: Buffer) => {
        console.error('[Runtime]', data.toString().trim())
      })
    }

    this.process.on('exit', (code) => {
      this.emit('error', new Error(`Runtime exited with code ${code}`))
      this.process = null
    })

    this.process.on('error', (err) => {
      this.emit('error', err)
      this.process = null
    })
  }

  /** Perform the HTTP health-check handshake with the Runtime. */
  private async performHandshake(): Promise<void> {
    try {
      const resp = await fetch(`http://127.0.0.1:${this.port}/health`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'X-Harness-Desktop-Version': '0.1.0',
        },
      })
      if (resp.ok) {
        this.emit('status', true)
      } else {
        this.emit('error', new Error(`Runtime handshake failed: HTTP ${resp.status}`))
        this.emit('status', false)
      }
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)))
      this.emit('status', false)
    }
  }

  /** Graceful shutdown: terminate child process, force kill after timeout. */
  shutdown(): void {
    if (this.process) {
      this.process.kill('SIGTERM')
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL')
        }
      }, 5000)
    }
  }
}
