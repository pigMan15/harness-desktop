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

export interface RuntimeSupervisorEvents {
  status: (healthy: boolean) => void
  error: (err: Error) => void
}

export class RuntimeSupervisor extends EventEmitter {
  private process: ChildProcess | null = null
  private token: string = ''
  private port: number = 0

  /** Generate a one-time 64-char hex token for authentication. */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /** Probe for an available Python interpreter (architecture solution design ADR-1). */
  private findPython(): string {
    // Priority: py -3 > common paths > user config (Phase 2+)
    return 'py'
  }

  /** Start the Python Runtime and perform the authentication handshake. */
  spawn(): void {
    this.token = this.generateToken()
    const pythonPath = this.findPython()

    this.process = spawn(pythonPath, ['-3', '-m', 'harness_runtime.main'], {
      env: { ...process.env, HARNESS_RUNTIME_TOKEN: this.token },
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
          'X-Harness-Desktop-Version': '0.0.0',
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
