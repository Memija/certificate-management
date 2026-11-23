import * as crypto from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import type { Plugin } from 'vite'

import { createAsyncCache } from './async-cache.ts'
import {
  createApiMiddlewarePlugin,
  getErrorMessage,
  HttpRequestError,
  parseRequestUrl,
  readJsonBody,
  sendJson,
  sendOperationalError,
} from './http-helpers.ts'
import { execFileAsync, isCommandUnavailableError, safeUnlink } from './powershell.ts'

interface OcspRequestBody {
  certB64?: unknown
  refresh?: unknown
}

export interface OcspRevocationResult {
  status: 'good' | 'revoked' | 'unknown'
  output: string
  ocspVerified: boolean
  crlVerified: boolean
  ocspUrl: string | null
  crlUrl: string | null
}

function validateX509Buffer(certBuf: Buffer, b64: string): boolean {
  try {
    new crypto.X509Certificate(certBuf)
    return true
  } catch {
    try {
      new crypto.X509Certificate(`-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----`)
      return true
    } catch {
      return false
    }
  }
}

function describeInvalidCertError(certBuf: Buffer, b64: string): string {
  const rawStr = certBuf.toString('utf8')
  if (rawStr.includes('CERTIFICATE REQUEST') || b64.includes('CERTIFICATE REQUEST')) {
    return 'The provided data is a Certificate Signing Request (CSR), not an issued X.509 certificate. CSRs do not have revocation status.'
  }
  if (rawStr.includes('PRIVATE KEY') || b64.includes('PRIVATE KEY')) {
    return 'The provided data is a Private Key, not an X.509 certificate.'
  }
  if (rawStr.includes('CRL') || b64.includes('CRL')) {
    return 'The provided data is a CRL, not an X.509 certificate.'
  }
  return 'The provided data is not a valid X.509 certificate.'
}

function extractExecFailureStdout(error: unknown): string | null {
  if (error && typeof error === 'object' && 'stdout' in error && typeof error.stdout === 'string') {
    return error.stdout
  }
  return null
}

function parseCertutilVerifyOutput(output: string): OcspRevocationResult {
  const isRevoked =
    output.includes('CERT_TRUST_IS_REVOKED') ||
    output.includes('Certificate is REVOKED') ||
    output.includes('The certificate is revoked') ||
    /CRYPT_E_REVOKED/i.test(output)

  const leafVerifiedOcsp =
    /Certificate OCSP\s*-+\s*Verified "OCSP"/i.test(output) || /Verified "OCSP"/i.test(output)
  const leafVerifiedCrl =
    /Certificate CDP\s*-+\s*Verified "Base CRL/i.test(output) || /Verified "Base CRL/i.test(output)
  const leafErrorStatusZero = /CertContext\[0\]\[0\]:[^\n]*dwErrorStatus=0/i.test(output)

  const isOk =
    !isRevoked &&
    (output.includes('Leaf certificate revocation check passed') ||
      output.includes('certificate revocation check passed') ||
      ((leafVerifiedOcsp || leafVerifiedCrl) && leafErrorStatusZero))

  const status: OcspRevocationResult['status'] = isRevoked ? 'revoked' : isOk ? 'good' : 'unknown'

  const ocspMatch = output.match(
    /Certificate OCSP\s*-+\s*([^\n]+)(?:\n\s*\[\d+\.\d+\]\s*([^\n\r]+))?/i,
  )
  const cdpMatch = output.match(
    /Certificate CDP\s*-+\s*([^\n]+)(?:\n\s*\[\d+\.\d+\]\s*([^\n\r]+))?/i,
  )

  return {
    status,
    output,
    ocspVerified: leafVerifiedOcsp,
    crlVerified: leafVerifiedCrl,
    ocspUrl: ocspMatch && ocspMatch[2] ? ocspMatch[2].trim() : null,
    crlUrl: cdpMatch && cdpMatch[2] ? cdpMatch[2].trim() : null,
  }
}

async function runCertutilOcspCheck(certBuf: Buffer): Promise<OcspRevocationResult> {
  if (process.platform !== 'win32') {
    throw new Error('certutil not found (ENOENT): Windows certutil is required')
  }

  const certPath = path.join(os.tmpdir(), `ocsp_check_${crypto.randomUUID()}.cer`)
  await fs.writeFile(certPath, certBuf)

  let output = ''
  try {
    const { stdout } = await execFileAsync('certutil', ['-verify', '-urlfetch', certPath], {
      encoding: 'utf8',
      timeout: 30_000,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    })
    output = stdout
  } catch (error: unknown) {
    const stdout = extractExecFailureStdout(error)
    const errMsg = getErrorMessage(error)
    if (!stdout && isCommandUnavailableError(errMsg)) {
      throw new Error(errMsg)
    }
    output = stdout || errMsg
  } finally {
    await safeUnlink(certPath)
  }

  return parseCertutilVerifyOutput(output)
}

export function ocspApiPlugin(): Plugin {
  const cache = createAsyncCache<OcspRevocationResult>(30_000)

  return createApiMiddlewarePlugin('ocsp-api', '/api/ocsp', async (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'Method Not Allowed', statusCode: 405 })
      return
    }

    const url = parseRequestUrl(req)
    const refreshQuery = url.searchParams.get('refresh') === 'true'

    let body: OcspRequestBody
    try {
      body = await readJsonBody<OcspRequestBody>(req)
    } catch (error: unknown) {
      if (error instanceof HttpRequestError) {
        sendJson(res, error.statusCode, {
          ok: false,
          error: error.message,
          statusCode: error.statusCode,
        })
        return
      }
      sendOperationalError(res, getErrorMessage(error), 500)
      return
    }

    if (typeof body.certB64 !== 'string' || !body.certB64.trim()) {
      sendJson(res, 400, { ok: false, error: 'certB64 is required', statusCode: 400 })
      return
    }

    const b64 = body.certB64.trim()
    const certBuf = Buffer.from(b64, 'base64')
    if (!validateX509Buffer(certBuf, b64)) {
      const errorMsg = describeInvalidCertError(certBuf, b64)
      sendJson(res, 400, { ok: false, error: errorMsg, statusCode: 400 })
      return
    }

    try {
      const certHash = crypto.createHash('sha256').update(certBuf).digest('hex')
      const bypassCache = refreshQuery || Boolean(body.refresh)
      const resultData = await cache.getOrLoad(`ocsp:${certHash}`, bypassCache, () =>
        runCertutilOcspCheck(certBuf),
      )
      sendJson(res, 200, { ok: true, data: resultData })
    } catch (error: unknown) {
      sendOperationalError(res, getErrorMessage(error), 500)
    }
  })
}
