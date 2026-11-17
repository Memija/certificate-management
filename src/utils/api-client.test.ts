import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchLocalApiJson, WebApiUnavailableError } from './api-client'

describe('api-client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('throws WebApiUnavailableError when fetch rejects (network error)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(fetchLocalApiJson('/api/test-net')).rejects.toBeInstanceOf(WebApiUnavailableError)
  })

  it('throws WebApiUnavailableError when static host returns HTML or empty body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<!doctype html><html><body>SPA</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    )
    await expect(fetchLocalApiJson('/api/test-html')).rejects.toBeInstanceOf(WebApiUnavailableError)

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 200 }))
    await expect(fetchLocalApiJson('/api/test-empty')).rejects.toBeInstanceOf(
      WebApiUnavailableError,
    )
  })

  it('throws WebApiUnavailableError on HTTP 404, 405, or missing OS binary errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(fetchLocalApiJson('/api/test-404')).rejects.toBeInstanceOf(WebApiUnavailableError)

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'spawn powershell.exe ENOENT' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(fetchLocalApiJson('/api/test-enoent')).rejects.toBeInstanceOf(
      WebApiUnavailableError,
    )
  })

  it('handles HTTP 200 { ok: false, error, webFallback } envelopes cleanly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          error: 'Windows Secure Boot API unavailable on Linux',
          webFallback: true,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    )
    await expect(fetchLocalApiJson('/api/secureboot?var=all')).rejects.toBeInstanceOf(
      WebApiUnavailableError,
    )

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          error: 'Invalid hostname parameter',
          webFallback: false,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    )
    await expect(fetchLocalApiJson('/api/tlsscanner?host=')).rejects.toThrow(
      'Invalid hostname parameter',
    )
  })

  it('returns parsed data and deduplicates identical concurrent GET requests', async () => {
    let resolveFetch!: (res: Response) => void
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )

    const p1 = fetchLocalApiJson<{ ok: boolean; data: string[] }>('/api/dedup-test')
    const p2 = fetchLocalApiJson<{ ok: boolean; data: string[] }>('/api/dedup-test')

    expect(fetchSpy).toHaveBeenCalledTimes(1)

    resolveFetch(
      new Response(JSON.stringify({ ok: true, data: ['cert1', 'cert2'] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1.data).toEqual(['cert1', 'cert2'])
    expect(r2.data).toEqual(['cert1', 'cert2'])
  })
})
