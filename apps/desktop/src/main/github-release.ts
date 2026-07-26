import { execFile } from 'node:child_process'
import { lstat } from 'node:fs/promises'

export interface GithubReleaseRequest {
  tag: string
  title: string
  notes: string
  assets: string[]
  draft: boolean
  overwriteAssets: boolean
}

interface CommandResult { ok: boolean; stdout: string; stderr: string }

function run(file: string, args: string[], cwd: string, timeout = 30_000): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(file, args, { cwd, windowsHide: true, timeout, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ ok: !error, stdout: String(stdout || '').trim(), stderr: String(stderr || error?.message || '').trim() })
    })
  })
}

export function validateReleaseTag(tag: string): string {
  const value = tag.trim()
  if (!value || value.length > 120 || !/^[A-Za-z0-9][A-Za-z0-9._+/-]*$/.test(value) || value.includes('..') || value.endsWith('/') || value.includes('@{')) {
    throw new Error('RELEASE_TAG_INVALID')
  }
  return value
}

export function buildReleaseCreateArgs(request: GithubReleaseRequest): string[] {
  const args = ['release', 'create', validateReleaseTag(request.tag), ...request.assets, '--title', request.title.trim() || request.tag, '--notes', request.notes, '--target', 'HEAD']
  if (request.draft) args.push('--draft')
  return args
}

export async function probeGithubRelease(projectPath: string, tag: string): Promise<Record<string, unknown>> {
  const normalizedTag = validateReleaseTag(tag)
  const [version, auth, remote, status, release] = await Promise.all([
    run('gh', ['--version'], projectPath),
    run('gh', ['auth', 'status'], projectPath),
    run('git', ['remote', 'get-url', 'origin'], projectPath),
    run('git', ['status', '--porcelain'], projectPath),
    run('gh', ['release', 'view', normalizedTag, '--json', 'url,isDraft,tagName'], projectPath),
  ])
  let releaseData: Record<string, unknown> | undefined
  if (release.ok) {
    try { releaseData = JSON.parse(release.stdout) as Record<string, unknown> } catch { releaseData = undefined }
  }
  return {
    available: version.ok,
    authenticated: auth.ok,
    ghVersion: version.stdout.split(/\r?\n/)[0] || version.stderr,
    remoteUrl: remote.ok ? remote.stdout : '',
    dirty: status.ok ? Boolean(status.stdout) : undefined,
    releaseExists: Boolean(releaseData),
    release: releaseData,
    diagnostics: [version.ok ? '' : version.stderr, auth.ok ? '' : auth.stderr, remote.ok ? '' : remote.stderr].filter(Boolean).join('\n'),
  }
}

export async function publishGithubRelease(projectPath: string, request: GithubReleaseRequest): Promise<Record<string, unknown>> {
  const tag = validateReleaseTag(request.tag)
  for (const asset of request.assets) {
    const stat = await lstat(asset)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`RELEASE_ASSET_INVALID: ${asset}`)
  }
  const capability = await probeGithubRelease(projectPath, tag)
  if (capability.available !== true) throw new Error(`GH_UNAVAILABLE: ${String(capability.diagnostics || '')}`)
  if (capability.authenticated !== true) throw new Error(`GH_AUTH_REQUIRED: ${String(capability.diagnostics || '')}`)

  const exists = capability.releaseExists === true
  const outputs: string[] = []
  if (exists) {
    const edit = await run('gh', ['release', 'edit', tag, '--title', request.title.trim() || tag, '--notes', request.notes, `--draft=${request.draft}`], projectPath, 120_000)
    if (!edit.ok) throw new Error(`RELEASE_EDIT_FAILED: ${edit.stderr}`)
    outputs.push(edit.stdout)
    if (request.assets.length > 0) {
      const uploadArgs = ['release', 'upload', tag, ...request.assets]
      if (request.overwriteAssets) uploadArgs.push('--clobber')
      const upload = await run('gh', uploadArgs, projectPath, 15 * 60_000)
      if (!upload.ok) throw new Error(`RELEASE_UPLOAD_FAILED: ${upload.stderr}`)
      outputs.push(upload.stdout)
    }
  } else {
    const created = await run('gh', buildReleaseCreateArgs({ ...request, tag }), projectPath, 15 * 60_000)
    if (!created.ok) throw new Error(`RELEASE_CREATE_FAILED: ${created.stderr}`)
    outputs.push(created.stdout)
  }
  const view = await run('gh', ['release', 'view', tag, '--json', 'url', '--jq', '.url'], projectPath)
  return { success: true, tag, existed: exists, url: view.ok ? view.stdout : '', output: outputs.filter(Boolean).join('\n') }
}
