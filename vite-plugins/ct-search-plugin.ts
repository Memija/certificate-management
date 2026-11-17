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

export interface CtLogEntry {
  id: number
  issuer_ca_id: number
  issuer_name: string
  common_name: string
  name_value: string
  entry_timestamp: string
  not_before: string
  not_after: string
  serial_number: string
}

export interface CtSearchSuccessPayload {
  ok: true
  data: CtLogEntry[]
  provider: 'crt.sh' | 'certspotter'
  rateLimited: boolean
  primaryError?: string
}

interface CertSpotterIssuer {
  name?: string
  friendly_name?: string
}

interface CertSpotterIssuance {
  id?: string | number
  issuer?: CertSpotterIssuer
  dns_names?: string[]
  not_before?: string
  not_after?: string
  cert_sha256?: string
  tbs_sha256?: string
}

const CRT_SH_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const CERTSPOTTER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number,
  userAgent: string,
): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return await response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

function mapCertSpotterIssuance(
  item: CertSpotterIssuance,
  index: number,
  normDomain: string,
): CtLogEntry {
  const parsedId = Number.parseInt(String(item.id ?? ''), 10)
  const dnsNames =
    Array.isArray(item.dns_names) && item.dns_names.length > 0 ? item.dns_names : [normDomain]
  const notBefore = item.not_before || ''

  return {
    id: Number.isNaN(parsedId) ? Date.now() - index * 1000 : parsedId,
    issuer_ca_id: 16418,
    issuer_name: item.issuer?.name || item.issuer?.friendly_name || 'Public Certificate Authority',
    common_name: dnsNames[0] || normDomain,
    name_value: dnsNames.join('\n'),
    entry_timestamp: notBefore,
    not_before: notBefore,
    not_after: item.not_after || '',
    serial_number: item.cert_sha256 || item.tbs_sha256 || String(item.id ?? index),
  }
}

async function queryCtProviders(normDomain: string): Promise<CtSearchSuccessPayload> {
  try {
    const fetchUrl = `https://crt.sh/?q=${encodeURIComponent(normDomain)}&output=json`
    const crtData = await fetchJsonWithTimeout(fetchUrl, 6000, CRT_SH_USER_AGENT)
    if (Array.isArray(crtData) && crtData.length > 0) {
      return {
        ok: true,
        data: crtData as CtLogEntry[],
        provider: 'crt.sh',
        rateLimited: false,
      }
    }
  } catch (crtError: unknown) {
    console.warn(
      `crt.sh unavailable for ${normDomain} (${getErrorMessage(crtError)}), trying CertSpotter fallback...`,
    )
  }

  try {
    const csUrl = `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(normDomain)}&include_subdomains=true&expand=dns_names&expand=issuer`
    const csData = await fetchJsonWithTimeout(csUrl, 8000, CERTSPOTTER_USER_AGENT)
    if (Array.isArray(csData) && csData.length > 0) {
      const mapped = (csData as CertSpotterIssuance[]).map((item, idx) =>
        mapCertSpotterIssuance(item, idx, normDomain),
      )
      return {
        ok: true,
        data: mapped,
        provider: 'certspotter',
        rateLimited: true,
        primaryError: 'crt.sh rate-limited (429/502)',
      }
    }
  } catch (csError: unknown) {
    console.warn(`CertSpotter fallback failed for ${normDomain}:`, getErrorMessage(csError))
  }

  throw new HttpRequestError(
    502,
    'CT log providers (crt.sh & CertSpotter) are temporarily unavailable.',
  )
}

export function ctSearchApiPlugin(): Plugin {
  const cache = createAsyncCache<CtSearchSuccessPayload>(120_000)

  return createApiMiddlewarePlugin('ct-search-api', '/api/ctsearch', async (req, res) => {
    const url = parseRequestUrl(req)
    const domain = url.searchParams.get('domain')
    const refresh = url.searchParams.get('refresh') === 'true'

    if (!domain || !domain.trim()) {
      sendJson(res, 400, { ok: false, error: 'Missing "domain" query parameter', statusCode: 400 })
      return
    }

    const normDomain = domain.trim().toLowerCase()

    try {
      const payload = await cache.getOrLoad(`ct:${normDomain}`, refresh, () =>
        queryCtProviders(normDomain),
      )
      sendJson(res, 200, payload)
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      const statusCode = getErrorStatusCode(error, 500)
      sendOperationalError(res, message, statusCode)
    }
  })
}
