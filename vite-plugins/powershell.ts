import { execFile } from 'node:child_process'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { promisify } from 'node:util'

export const execFileAsync = promisify(execFile)

const COMMAND_UNAVAILABLE_RE = /powershell\.exe.*not found|certutil.*not found|ENOENT/i
const SAFE_PREFIX_RE = /^[a-zA-Z0-9_-]+$/

export interface ElevatedPowerShellOptions {
  prefix: string
  outputExtension?: 'json' | 'txt'
  buildScript: (escapedOutPath: string) => string
  timeoutMs?: number
}

export function isCommandUnavailableError(message: string): boolean {
  if (process.platform !== 'win32') {
    return true
  }
  return COMMAND_UNAVAILABLE_RE.test(message)
}

export function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''")
}

export async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch {
    // Ignore missing or already cleaned temporary files
  }
}

export async function runPowerShellEncoded(script: string, timeoutMs = 30_000): Promise<string> {
  if (process.platform !== 'win32') {
    throw new Error('powershell.exe not found (ENOENT): Windows PowerShell is required')
  }

  const fullScript = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n${script}`
  const encoded = Buffer.from(fullScript, 'utf16le').toString('base64')
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
    {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      timeout: timeoutMs,
      windowsHide: true,
    },
  )

  return stdout.replace(/^\uFEFF/, '').trim()
}

export async function runElevatedPowerShellScript(
  options: ElevatedPowerShellOptions,
): Promise<string> {
  if (process.platform !== 'win32') {
    throw new Error('powershell.exe not found (ENOENT): Windows PowerShell is required')
  }

  const prefix = SAFE_PREFIX_RE.test(options.prefix) ? options.prefix : 'ps_elevated'
  const ext = options.outputExtension ?? 'json'
  const timeoutMs = options.timeoutMs ?? 60_000
  const tmpdir = os.tmpdir()
  const runId = crypto.randomUUID()
  const outPath = path.join(tmpdir, `${prefix}_out_${runId}.${ext}`)
  const scriptPath = path.join(tmpdir, `${prefix}_get_${runId}.ps1`)

  const escapedOutPath = escapePowerShellSingleQuoted(outPath)
  const escapedScriptPath = escapePowerShellSingleQuoted(scriptPath)
  const psScript = options.buildScript(escapedOutPath)

  await fs.writeFile(scriptPath, psScript, 'utf8')

  try {
    const launcherScript = [
      "$ErrorActionPreference = 'Stop'",
      `Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', '${escapedScriptPath}') -Verb RunAs -Wait`,
    ].join('\n')
    const encodedLauncher = Buffer.from(launcherScript, 'utf16le').toString('base64')

    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-WindowStyle', 'Hidden', '-EncodedCommand', encodedLauncher],
      {
        encoding: 'utf8',
        timeout: timeoutMs,
        windowsHide: true,
      },
    )

    const output = await fs.readFile(outPath, 'utf8')
    return output.replace(/^\uFEFF/, '').trim()
  } finally {
    await safeUnlink(outPath)
    await safeUnlink(scriptPath)
  }
}
