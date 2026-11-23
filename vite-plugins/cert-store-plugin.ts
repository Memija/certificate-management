import type { Plugin } from 'vite'

import { createAsyncCache } from './async-cache.ts'
import {
  buildExpiryBatchPsScript,
  buildLocationBatchPsBody,
  type CertStoreLocation,
  type CertStoreName,
  type EnrichedCertStoreEntry,
  type ExpiryBatchEntry,
  isValidCertLocation,
  isValidCertStore,
  type LocationBatchMap,
  type LocationStoreOutcome,
  parseExpiryBatchOutput,
  parseLocationBatchOutput,
} from './cert-store-helpers.ts'
import {
  createApiMiddlewarePlugin,
  getErrorMessage,
  parseRequestUrl,
  sendJson,
  sendOperationalError,
} from './http-helpers.ts'
import { runElevatedPowerShellScript, runPowerShellEncoded } from './powershell.ts'

const CERT_STORE_CACHE_TTL_MS = 300_000

async function fetchLocationStoresBatch(
  storeLocation: CertStoreLocation,
  elevate: boolean,
): Promise<LocationBatchMap> {
  const coreBody = buildLocationBatchPsBody(storeLocation)

  const clean = elevate
    ? await runElevatedPowerShellScript({
        prefix: 'certstore',
        outputExtension: 'json',
        timeoutMs: 30_000,
        buildScript: (escapedOutPath) => `
try {
${coreBody}
    [System.IO.File]::WriteAllText('${escapedOutPath}', $ser.Serialize($allStores), [System.Text.Encoding]::UTF8)
} catch {
    [PSCustomObject]@{ error = $_.Exception.Message } | ConvertTo-Json -Compress | Out-File -FilePath '${escapedOutPath}' -Encoding utf8
}
`,
      })
    : await runPowerShellEncoded(`
try {
${coreBody}
    [Console]::Write($ser.Serialize($allStores))
} catch {
    [PSCustomObject]@{ error = $_.Exception.Message } | ConvertTo-Json -Compress
}
exit 0
`)

  return parseLocationBatchOutput(clean)
}

export function certStoreApiPlugin(): Plugin {
  const storeCache = createAsyncCache<EnrichedCertStoreEntry[]>(CERT_STORE_CACHE_TTL_MS)
  const locationBatchCache = createAsyncCache<LocationBatchMap>(CERT_STORE_CACHE_TTL_MS)
  const expiryCache = createAsyncCache<ExpiryBatchEntry[]>(CERT_STORE_CACHE_TTL_MS)

  return createApiMiddlewarePlugin('cert-store-api', '/api/certstore', async (req, res) => {
    const url = parseRequestUrl(req)
    const batchMode = url.searchParams.get('batch')
    const refresh = url.searchParams.get('refresh') === 'true'

    if (batchMode === 'expiry') {
      try {
        const data = await expiryCache.getOrLoad('certstore:batch:expiry', refresh, async () => {
          const clean = await runPowerShellEncoded(buildExpiryBatchPsScript())
          return parseExpiryBatchOutput(clean)
        })
        sendJson(res, 200, { ok: true, data })
      } catch (error: unknown) {
        const message = getErrorMessage(error)
        sendOperationalError(res, message, 500)
      }
      return
    }

    const storeName = url.searchParams.get('store') || 'Root'
    const storeLocation = url.searchParams.get('location') || 'CurrentUser'
    const elevate = url.searchParams.get('elevate') === 'true'

    if (!isValidCertStore(storeName) || !isValidCertLocation(storeLocation)) {
      sendJson(res, 400, {
        ok: false,
        error: 'Invalid store or location parameter',
        statusCode: 400,
      })
      return
    }

    try {
      const cacheKey = `certstore:${storeLocation}:${storeName}`
      const bypass = elevate || refresh
      const enriched = await storeCache.getOrLoad(cacheKey, bypass, async () => {
        const batch = await locationBatchCache.getOrLoad(
          `certstore:loc:${storeLocation}`,
          bypass,
          () => fetchLocationStoresBatch(storeLocation, elevate),
        )
        for (const [st, outcome] of Object.entries(batch) as [
          CertStoreName,
          LocationStoreOutcome,
        ][]) {
          if (outcome.ok) {
            storeCache.set(`certstore:${storeLocation}:${st}`, outcome.data)
          }
        }
        const requested = batch[storeName]
        if (!requested) {
          return []
        }
        if (!requested.ok) {
          throw new Error(requested.error)
        }
        return requested.data
      })
      sendJson(res, 200, { ok: true, data: enriched })
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      sendOperationalError(res, message, 500)
    }
  })
}
