import * as crypto from 'node:crypto'
import * as net from 'node:net'
import * as tls from 'node:tls'
import type { Plugin } from 'vite'

import { createAsyncCache } from './async-cache'
import {
  createApiMiddlewarePlugin,
  getErrorMessage,
  getErrorStatusCode,
  HttpRequestError,
  parseRequestUrl,
  sendJson,
  sendOperationalError,
} from './http-helpers'
import { type ParsedTlsExtension, parseExtensionsFromRaw } from './tls-extension-parser'

export interface TlsChainCertificate {
  subject: string
  issuer: string
  subjectCN: string
  issuerCN: string
  valid_from: string
  valid_to: string
  fingerprint: string
  fingerprint256: string
  serialNumber: string
  rawB64: string
  pem: string
  keyType: string
  keyDetails: Record<string, unknown> | null
  ca: boolean
  subjectAltNames: string[]
  extensions: ParsedTlsExtension[]
}

export interface TlsScanResult {
  chain: TlsChainCertificate[]
  protocol: string | null
  cipher: tls.CipherNameAndProtocol
  authorized: boolean
  authorizationError: string | null
  host: string
  port: number
}

const VALID_HOSTNAME_CHARS_RE = /^[a-z0-9._:-]+$/i

function sanitizeHostAndPort(
  rawHost: string,
  rawPort: string,
): { host: string; port: number } | null {
  let host = rawHost.trim()
  let port = Number.parseInt(rawPort, 10)
  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    port = 443
  }

  if (host.includes('://')) {
    try {
      const parsed = new URL(host)
      host = parsed.hostname
      if (parsed.port) {
        const urlPort = Number.parseInt(parsed.port, 10)
        if (!Number.isNaN(urlPort) && urlPort > 0 && urlPort <= 65535) {
          port = urlPort
        }
      }
    } catch {
      host = host.replace(/^[a-zA-Z]+:\/\//, '')
      const slash = host.indexOf('/')
      if (slash !== -1) {
        host = host.substring(0, slash)
      }
    }
  }

  const slashIdx = host.indexOf('/')
  if (slashIdx !== -1) {
    host = host.substring(0, slashIdx)
  }

  if (host.startsWith('[')) {
    const endBracket = host.indexOf(']')
    if (endBracket !== -1) {
      const portPart = host.substring(endBracket + 1)
      if (portPart.startsWith(':')) {
        const bracketPort = Number.parseInt(portPart.substring(1), 10)
        if (!Number.isNaN(bracketPort) && bracketPort > 0 && bracketPort <= 65535) {
          port = bracketPort
        }
      }
      host = host.substring(1, endBracket)
    }
  } else if (host.includes(':')) {
    const parts = host.split(':')
    if (parts.length === 2 && !Number.isNaN(Number(parts[1]))) {
      const hostPort = Number.parseInt(parts[1], 10)
      host = parts[0]
      if (!Number.isNaN(hostPort) && hostPort > 0 && hostPort <= 65535) {
        port = hostPort
      }
    }
  }

  host = host.trim().toLowerCase()
  if (!host || !VALID_HOSTNAME_CHARS_RE.test(host)) {
    return null
  }

  return { host, port }
}

function serializeKeyDetails(
  details: crypto.KeyObject['asymmetricKeyDetails'],
): Record<string, unknown> | null {
  if (!details) {
    return null
  }
  const clean: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(details)) {
    clean[key] = typeof val === 'bigint' ? val.toString() : val
  }
  return clean
}

function formatPeerDnFallback(dn: tls.Certificate | undefined): string {
  if (!dn) {
    return ''
  }
  if (typeof dn === 'object') {
    return Object.entries(dn)
      .map(([key, val]) => `${key}=${Array.isArray(val) ? val.join(', ') : String(val ?? '')}`)
      .join(', ')
  }
  return String(dn)
}

function extractCommonName(dn: tls.Certificate | undefined, dnStr: string): string {
  const cnValue = dn?.CN
  if (typeof cnValue === 'string' && cnValue) {
    return cnValue
  }
  if (Array.isArray(cnValue) && cnValue[0]) {
    return cnValue[0]
  }
  return dnStr.match(/CN=([^,]+)/)?.[1] || dnStr || 'Unknown'
}

function buildChainCertificate(currentCert: tls.DetailedPeerCertificate): TlsChainCertificate {
  let x509: crypto.X509Certificate | null = null
  let pem = ''
  let subjectStr = ''
  let issuerStr = ''
  let keyType = ''
  let keyDetails: Record<string, unknown> | null = null

  try {
    x509 = new crypto.X509Certificate(currentCert.raw)
    pem = x509.toString()
    subjectStr = x509.subject ? x509.subject.split('\n').filter(Boolean).join(', ') : ''
    issuerStr = x509.issuer ? x509.issuer.split('\n').filter(Boolean).join(', ') : ''
    keyType = x509.publicKey.asymmetricKeyType || ''
    keyDetails = serializeKeyDetails(x509.publicKey.asymmetricKeyDetails)
  } catch {
    // Fall back to peerCert properties when Node X509Certificate parsing fails
  }

  if (!subjectStr) {
    subjectStr = formatPeerDnFallback(currentCert.subject)
  }
  if (!issuerStr) {
    issuerStr = formatPeerDnFallback(currentCert.issuer)
  }

  const subjectCN = extractCommonName(currentCert.subject, subjectStr)
  const issuerCN = extractCommonName(currentCert.issuer, issuerStr)
  const extensions = parseExtensionsFromRaw(currentCert.raw)

  const rawSan = x509?.subjectAltName || currentCert.subjectaltname || ''
  const subjectAltNames = rawSan
    ? rawSan
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : []

  return {
    subject: subjectStr,
    issuer: issuerStr,
    subjectCN,
    issuerCN,
    valid_from: currentCert.valid_from || (x509 ? x509.validFrom : ''),
    valid_to: currentCert.valid_to || (x509 ? x509.validTo : ''),
    fingerprint: currentCert.fingerprint || (x509 ? x509.fingerprint : ''),
    fingerprint256: currentCert.fingerprint256 || (x509 ? x509.fingerprint256 : ''),
    serialNumber: currentCert.serialNumber || (x509 ? x509.serialNumber : ''),
    rawB64: currentCert.raw.toString('base64'),
    pem,
    keyType,
    keyDetails,
    ca: x509 ? x509.ca : Boolean(currentCert.ca),
    subjectAltNames,
    extensions,
  }
}

function extractCertificateChain(peerCert: tls.DetailedPeerCertificate): TlsChainCertificate[] {
  const seen = new Set<string>()
  const chain: TlsChainCertificate[] = []
  let currentCert: tls.DetailedPeerCertificate | undefined = peerCert

  while (currentCert && Buffer.isBuffer(currentCert.raw) && currentCert.raw.length > 0) {
    if (seen.has(currentCert.fingerprint256)) {
      break
    }
    seen.add(currentCert.fingerprint256)
    chain.push(buildChainCertificate(currentCert))

    if (!currentCert.issuerCertificate || currentCert.issuerCertificate === currentCert) {
      break
    }
    currentCert = currentCert.issuerCertificate
  }

  return chain
}

function scanTlsEndpoint(host: string, port: number): Promise<TlsScanResult> {
  const isIp = net.isIP(host) !== 0
  const options: tls.ConnectionOptions = {
    host,
    port,
    rejectUnauthorized: false,
    ...(isIp ? {} : { servername: host }),
  }

  return new Promise<TlsScanResult>((resolve, reject) => {
    let finished = false

    const socket = tls.connect(options, () => {
      if (finished) {
        return
      }
      finished = true

      try {
        const peerCert = socket.getPeerCertificate(true)
        if (!peerCert || !Buffer.isBuffer(peerCert.raw) || peerCert.raw.length === 0) {
          socket.destroy()
          reject(new Error('Remote server did not present a certificate'))
          return
        }

        const chain = extractCertificateChain(peerCert)
        const protocol = socket.getProtocol()
        const cipher = socket.getCipher()
        const authorized = socket.authorized
        const authorizationError = socket.authorizationError
          ? String(socket.authorizationError)
          : null

        socket.end()

        resolve({
          chain,
          protocol,
          cipher,
          authorized,
          authorizationError,
          host,
          port,
        })
      } catch (error: unknown) {
        socket.destroy()
        reject(new Error(`Failed to process certificate: ${getErrorMessage(error)}`))
      }
    })

    socket.on('error', (err: Error) => {
      if (finished) {
        return
      }
      finished = true
      socket.destroy()
      reject(new Error(`Connection failed: ${err.message}`))
    })

    socket.setTimeout(10_000, () => {
      if (finished) {
        return
      }
      finished = true
      socket.destroy()
      reject(new HttpRequestError(504, `Connection to ${host}:${port} timed out after 10s`))
    })
  })
}

export function tlsScannerApiPlugin(): Plugin {
  const cache = createAsyncCache<TlsScanResult>(15_000)

  return createApiMiddlewarePlugin('tls-scanner-api', '/api/tlsscanner', async (req, res) => {
    const url = parseRequestUrl(req)
    const rawHost = url.searchParams.get('host') || ''
    const rawPort = url.searchParams.get('port') || '443'
    const refresh = url.searchParams.get('refresh') === 'true'

    if (!rawHost.trim()) {
      sendJson(res, 400, { ok: false, error: 'Missing "host" query parameter', statusCode: 400 })
      return
    }

    const sanitized = sanitizeHostAndPort(rawHost, rawPort)
    if (!sanitized) {
      sendJson(res, 400, { ok: false, error: 'Invalid hostname provided', statusCode: 400 })
      return
    }

    try {
      const cacheKey = `tls:${sanitized.host}:${sanitized.port}`
      const resultPayload = await cache.getOrLoad(cacheKey, refresh, () =>
        scanTlsEndpoint(sanitized.host, sanitized.port),
      )
      sendJson(res, 200, { ok: true, data: resultPayload })
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Failed to scan TLS.')
      const statusCode = getErrorStatusCode(error, 500)
      sendOperationalError(res, message, statusCode)
    }
  })
}
