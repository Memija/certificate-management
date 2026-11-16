export class WebApiUnavailableError extends Error {
  isWebFallback = true;
  constructor(message = 'Local backend API is unavailable in static web mode') {
    super(message);
    this.name = 'WebApiUnavailableError';
  }
}

const inflightGetRequests = new Map<string, Promise<any>>();

/**
 * Fetches JSON from a local `/api/*` endpoint and throws `WebApiUnavailableError`
 * when running as a static web page (404, 405, HTML SPA fallback, or network failure).
 * Deduplicates identical concurrent GET requests (e.g. under React StrictMode).
 */
export async function fetchLocalApiJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const isGet = !init?.method || init.method.toUpperCase() === 'GET';
  if (isGet && !init?.signal) {
    const existing = inflightGetRequests.get(url);
    if (existing) {
      return existing as Promise<T>;
    }
  }

  const execute = async (): Promise<T> => {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch {
      throw new WebApiUnavailableError();
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const rawText = await res.text();
    const trimmed = rawText.trim();

    // Static web hosts return HTML (index.html or 404 page) or empty body when /api/* is missing
    if (
      !trimmed ||
      trimmed.startsWith('<!') ||
      trimmed.startsWith('<html') ||
      contentType.includes('text/html')
    ) {
      throw new WebApiUnavailableError();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new WebApiUnavailableError();
    }

    if (!res.ok) {
      const errMsg = parsed?.error || `HTTP ${res.status}`;
      // If running on a non-Windows server where powershell.exe or certutil is missing, fall back to web mode
      if (
        res.status === 404 ||
        res.status === 405 ||
        /powershell\.exe.*not found|certutil.*not found|ENOENT/i.test(errMsg)
      ) {
        throw new WebApiUnavailableError(errMsg);
      }
      throw new Error(errMsg);
    }

    return parsed as T;
  };

  if (isGet && !init?.signal) {
    const promise = execute().finally(() => {
      inflightGetRequests.delete(url);
    });
    inflightGetRequests.set(url, promise);
    return promise;
  }

  return execute();
}
