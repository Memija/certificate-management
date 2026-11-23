import type { Plugin } from 'vite'

import { createAsyncCache } from './async-cache.ts'
import {
  createApiMiddlewarePlugin,
  getErrorMessage,
  parseRequestUrl,
  sendJson,
  sendOperationalError,
} from './http-helpers.ts'
import { runElevatedPowerShellScript, runPowerShellEncoded } from './powershell.ts'

const VALID_VARS = ['all', 'PK', 'KEK', 'db', 'dbx'] as const
type SecureBootVarParam = (typeof VALID_VARS)[number]
type SingleSecureBootVar = Exclude<SecureBootVarParam, 'all'>
type SecureBootResult = Record<string, string> | string

function isValidSecureBootVar(value: string): value is SecureBootVarParam {
  return (VALID_VARS as readonly string[]).includes(value)
}

function isPlainStringMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every((entry) => typeof entry === 'string')
}

async function fetchAllVarsElevated(): Promise<Record<string, string>> {
  const cleanOutput = await runElevatedPowerShellScript({
    prefix: 'secureboot_all',
    outputExtension: 'json',
    buildScript: (escapedOutPath) => `
$ErrorActionPreference = 'Stop'
$results = @{}
$vars = @('PK', 'KEK', 'db', 'dbx')
try {
    foreach ($v in $vars) {
        $bytes = (Get-SecureBootUEFI -Name $v).Bytes
        if ($bytes) {
            $results[$v] = [Convert]::ToBase64String($bytes)
        }
    }
    $results | ConvertTo-Json -Compress | Out-File -FilePath '${escapedOutPath}' -Encoding utf8
} catch {
    $_.Exception.Message | Out-File -FilePath '${escapedOutPath}' -Encoding utf8
}
`,
  })

  try {
    const parsed: unknown = JSON.parse(cleanOutput)
    if (!isPlainStringMap(parsed)) {
      throw new Error(`Elevated process error: ${cleanOutput}`)
    }
    return parsed
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('Elevated process error:')) {
      throw error
    }
    throw new Error(`Elevated process error: ${cleanOutput}`)
  }
}

async function fetchAllVarsStandard(): Promise<Record<string, string>> {
  const psScript = `
$results = @{}
foreach ($v in @('PK', 'KEK', 'db', 'dbx')) {
    try {
        $b = (Get-SecureBootUEFI -Name $v -ErrorAction Stop).Bytes
        if ($b) { $results[$v] = [Convert]::ToBase64String($b) }
    } catch {
        if ($_.Exception -is [System.UnauthorizedAccessException] -or $_.Exception.Message -match 'Access|Privilege') {
            break
        }
    }
}
$results | ConvertTo-Json -Compress
exit 0
`
  const stdout = await runPowerShellEncoded(psScript)
  const parsed: unknown = stdout ? JSON.parse(stdout) : {}
  if (!isPlainStringMap(parsed) || Object.keys(parsed).length === 0) {
    throw new Error('Access was denied')
  }
  return parsed
}

async function fetchSingleVarElevated(varName: SingleSecureBootVar): Promise<string> {
  const base64Str = await runElevatedPowerShellScript({
    prefix: `secureboot_${varName}`,
    outputExtension: 'txt',
    buildScript: (escapedOutPath) => `
$ErrorActionPreference = 'Stop'
try {
    $bytes = (Get-SecureBootUEFI -Name '${varName}').Bytes
    [Convert]::ToBase64String($bytes) | Out-File -FilePath '${escapedOutPath}' -Encoding ascii
} catch {
    $_.Exception.Message | Out-File -FilePath '${escapedOutPath}' -Encoding ascii
}
`,
  })

  if (base64Str.includes(' ')) {
    throw new Error(`Elevated process error: ${base64Str}`)
  }
  return base64Str
}

async function fetchSingleVarStandard(varName: SingleSecureBootVar): Promise<string> {
  return runPowerShellEncoded(
    `try { $b = (Get-SecureBootUEFI -Name '${varName}' -ErrorAction Stop).Bytes; if ($b) { [Convert]::ToBase64String($b) } } catch { throw }`,
  )
}

export function secureBootApiPlugin(): Plugin {
  const cache = createAsyncCache<SecureBootResult>(300_000)

  return createApiMiddlewarePlugin('secure-boot-api', '/api/secureboot', async (req, res) => {
    const url = parseRequestUrl(req)
    const varName = url.searchParams.get('var')
    const elevate = url.searchParams.get('elevate') === 'true'
    const refresh = url.searchParams.get('refresh') === 'true'

    if (!varName) {
      sendJson(res, 400, { ok: false, error: 'Missing "var" query parameter', statusCode: 400 })
      return
    }

    if (!isValidSecureBootVar(varName)) {
      sendJson(res, 400, { ok: false, error: 'Invalid "var" query parameter', statusCode: 400 })
      return
    }

    try {
      const cacheKey = `sb:${varName}`
      const resultData = await cache.getOrLoad(cacheKey, elevate || refresh, async () => {
        if (varName === 'all') {
          return elevate ? fetchAllVarsElevated() : fetchAllVarsStandard()
        }
        return elevate ? fetchSingleVarElevated(varName) : fetchSingleVarStandard(varName)
      })

      if (!resultData || (typeof resultData === 'string' && !resultData.trim())) {
        sendOperationalError(res, `Variable ${varName} not found or empty.`, 404)
        return
      }

      sendJson(res, 200, { ok: true, data: resultData })
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      sendOperationalError(res, `Failed to access variable. ${message}`, 500)
    }
  })
}
