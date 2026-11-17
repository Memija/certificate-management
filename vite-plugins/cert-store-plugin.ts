import type { Plugin } from 'vite'

import { createAsyncCache } from './async-cache'
import {
  buildExpiryBatchPsScript,
  buildSingleStorePsBody,
  type CertStoreLocation,
  type CertStoreName,
  type EnrichedCertStoreEntry,
  type ExpiryBatchEntry,
  isValidCertLocation,
  isValidCertStore,
  parseAndMapStoreOutput,
  parseExpiryBatchOutput,
} from './cert-store-helpers'
import {
  createApiMiddlewarePlugin,
  getErrorMessage,
  parseRequestUrl,
  sendJson,
  sendOperationalError,
} from './http-helpers'
import { runElevatedPowerShellScript, runPowerShellEncoded } from './powershell'

async function fetchStoreCerts(
  storeLocation: CertStoreLocation,
  storeName: CertStoreName,
  elevate: boolean,
): Promise<EnrichedCertStoreEntry[]> {
  const coreBody = buildSingleStorePsBody(storeLocation, storeName)

  const clean = elevate
    ? await runElevatedPowerShellScript({
        prefix: 'certstore',
        outputExtension: 'json',
        timeoutMs: 30_000,
        buildScript: (escapedOutPath) => `
try {
${coreBody}
    ConvertTo-Json -InputObject @($results.ToArray()) -Depth 5 -Compress | Out-File -FilePath '${escapedOutPath}' -Encoding utf8
} catch {
    [PSCustomObject]@{ error = $_.Exception.Message } | ConvertTo-Json -Compress | Out-File -FilePath '${escapedOutPath}' -Encoding utf8
}
`,
      })
    : await runPowerShellEncoded(`
try {
${coreBody}
    ConvertTo-Json -InputObject @($results.ToArray()) -Depth 5 -Compress
} catch {
    [PSCustomObject]@{ error = $_.Exception.Message } | ConvertTo-Json -Compress
}
exit 0
`)

  return parseAndMapStoreOutput(clean)
}

export function certStoreApiPlugin(): Plugin {
  const storeCache = createAsyncCache<EnrichedCertStoreEntry[]>(30_000)
  const expiryCache = createAsyncCache<ExpiryBatchEntry[]>(30_000)

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
      const enriched = await storeCache.getOrLoad(cacheKey, elevate || refresh, () =>
        fetchStoreCerts(storeLocation, storeName, elevate),
      )
      sendJson(res, 200, { ok: true, data: enriched })
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      sendOperationalError(res, message, 500)
    }
  })
}
