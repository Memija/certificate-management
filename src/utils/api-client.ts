export class WebApiUnavailableError extends Error {
  isWebFallback = true

  constructor(message = 'Local backend API is unavailable in static web mode') {
    super(message)
    this.name = 'WebApiUnavailableError'
  }
}

const WEB_FALLBACK_ERROR_RE = /powershell\.exe.*not found|certutil.*not found|ENOENT|unavailable/i

const inflightGetRequests = new Map<string, Promise<unknown>>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function throwForErrorPayload(
  parsed: unknown,
  fallbackMessage: string,
  forceWebFallback = false,
): never {
  const errMsg =
    isRecord(parsed) && typeof parsed.error === 'string' && parsed.error
      ? parsed.error
      : fallbackMessage
  const isFallback =
    forceWebFallback ||
    (isRecord(parsed) && parsed.webFallback === true) ||
    WEB_FALLBACK_ERROR_RE.test(errMsg)

  if (isFallback) {
    throw new WebApiUnavailableError(errMsg)
  }
  throw new Error(errMsg)
}

/**
 * Fetches JSON from a local `/api/*` endpoint and throws `WebApiUnavailableError`
 * when running as a static web page (404, 405, HTML SPA fallback, network failure,
 * or HTTP 200 `{ ok: false, error, webFallback }` envelope).
 * Deduplicates identical concurrent GET requests (e.g. under React StrictMode).
 */
export async function fetchLocalApiJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const isGet = !init?.method || init.method.toUpperCase() === 'GET'
  if (isGet && !init?.signal) {
    const existing = inflightGetRequests.get(url)
    if (existing) {
      return existing as Promise<T>
    }
  }

  const execute = async (): Promise<T> => {
    let res: Response
    try {
      res = await fetch(url, init)
    } catch {
      throw new WebApiUnavailableError()
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    const rawText = await res.text()
    const trimmed = rawText.trim()

    // Static web hosts return HTML (index.html or 404 page) or empty body when /api/* is missing
    if (
      !trimmed ||
      trimmed.startsWith('<!') ||
      trimmed.startsWith('<html') ||
      contentType.includes('text/html')
    ) {
      throw new WebApiUnavailableError()
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      throw new WebApiUnavailableError()
    }

    if (!res.ok) {
      const forceFallback = res.status === 404 || res.status === 405
      throwForErrorPayload(parsed, `HTTP ${res.status}`, forceFallback)
    }

    if (
      isRecord(parsed) &&
      (parsed.ok === false || (Boolean(parsed.error) && !('data' in parsed)))
    ) {
      throwForErrorPayload(parsed, 'Local API request failed', false)
    }

    return parsed as T
  }

  if (isGet && !init?.signal) {
    const promise = execute().finally(() => {
      inflightGetRequests.delete(url)
    })
    inflightGetRequests.set(url, promise)
    return promise
  }

  return execute()
}
