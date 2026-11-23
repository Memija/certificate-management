import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'

import { isCommandUnavailableError } from './powershell.ts'

export class HttpRequestError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'HttpRequestError'
    this.statusCode = statusCode
  }
}

export interface ApiErrorPayload {
  ok: false
  error: string
  statusCode: number
  webFallback: boolean
}

export type ApiRequestHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void

export function getErrorMessage(error: unknown, fallback = 'Unexpected server error'): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim()
  }
  return fallback
}

export function getErrorStatusCode(error: unknown, fallback = 500): number {
  if (error instanceof HttpRequestError) {
    return error.statusCode
  }
  if (
    error &&
    typeof error === 'object' &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
  ) {
    return error.statusCode
  }
  return fallback
}

export function parseRequestUrl(req: IncomingMessage): URL {
  const host = req.headers.host || 'localhost'
  return new URL(req.url || '/', `http://${host}`)
}

export function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  if (res.writableEnded) {
    return
  }
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

/**
 * Sends operational/environment errors with HTTP 200 and `{ ok: false, error, statusCode, webFallback }`
 * so Chrome DevTools / Lighthouse CI do not flag expected local workstation permission or tool-missing
 * conditions as failed network requests in console errors.
 */
export function sendOperationalError(res: ServerResponse, message: string, statusCode = 500): void {
  const payload: ApiErrorPayload = {
    ok: false,
    error: message,
    statusCode,
    webFallback: isCommandUnavailableError(message),
  }
  sendJson(res, 200, payload)
}

export function readJsonBody<T = Record<string, unknown>>(
  req: IncomingMessage,
  maxBytes = 2 * 1024 * 1024,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalBytes = 0
    let settled = false

    req.on('data', (chunk: Buffer | string) => {
      if (settled) {
        return
      }
      const buffer = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk
      totalBytes += buffer.length
      if (totalBytes > maxBytes) {
        settled = true
        reject(new HttpRequestError(413, 'Request payload too large'))
        req.destroy()
        return
      }
      chunks.push(buffer)
    })

    req.on('end', () => {
      if (settled) {
        return
      }
      settled = true
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (!raw) {
        reject(new HttpRequestError(400, 'Request body is required'))
        return
      }
      try {
        const parsed: unknown = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new HttpRequestError(400, 'Request body must be a JSON object'))
          return
        }
        resolve(parsed as T)
      } catch {
        reject(new HttpRequestError(400, 'Invalid JSON request body'))
      }
    })

    req.on('error', (err: Error) => {
      if (settled) {
        return
      }
      settled = true
      reject(err)
    })
  })
}

export function registerApiMiddleware(
  server: ViteDevServer | PreviewServer,
  route: string,
  handler: ApiRequestHandler,
): void {
  server.middlewares.use(route, (req: IncomingMessage, res: ServerResponse) => {
    void Promise.resolve(handler(req, res)).catch((error: unknown) => {
      const message = getErrorMessage(error)
      const statusCode = getErrorStatusCode(error, 500)
      sendOperationalError(res, message, statusCode)
    })
  })
}

export function createApiMiddlewarePlugin(
  name: string,
  route: string,
  handler: ApiRequestHandler,
): Plugin {
  return {
    name,
    configureServer(server: ViteDevServer) {
      registerApiMiddleware(server, route, handler)
    },
    configurePreviewServer(server: PreviewServer) {
      registerApiMiddleware(server, route, handler)
    },
  }
}
