import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/components/shared'
import i18n from '@/i18n'
import type { TlsScanResult } from '@/types'
import * as apiClient from '@/utils/api-client'
import { WebApiUnavailableError } from '@/utils/api-client'
import { scanTlsClientSide } from '@/utils/web-fallbacks'

import TlsScannerDefault, { TlsScanner } from './index'
import {
  calculateValidityProgress,
  derB64ToPem,
  enrichTlsChain,
  formatAuthError,
  formatDn,
  formatKeyDescription,
  parseDnEntries,
  parseHostInput,
  resolveChainRole,
  TLS_QUICK_PRESETS,
} from './tls-scanner-helpers'

function renderScanner() {
  return render(
    <ToastProvider>
      <TlsScanner />
    </ToastProvider>,
  )
}

describe('tls-scanner-helpers', () => {
  it('parses hostnames, URLs, IPv6 brackets, ports, and malformed URLs', () => {
    expect(parseHostInput('  google.com  ')).toEqual({ host: 'google.com' })
    expect(parseHostInput('https://api.github.com:8443/v1/certs')).toEqual({
      host: 'api.github.com',
      port: 8443,
    })
    expect(parseHostInput('https://cloudflare.com/cdn')).toEqual({
      host: 'cloudflare.com',
      port: undefined,
    })
    expect(parseHostInput('http://[bad-url/test')).toEqual({ host: '[bad-url' })
    expect(parseHostInput('[2001:4860:4860::8888]:8443')).toEqual({
      host: '2001:4860:4860::8888',
      port: 8443,
    })
    expect(parseHostInput('[::1]')).toEqual({ host: '::1' })
    expect(parseHostInput('internal.local:9443')).toEqual({
      host: 'internal.local',
      port: 9443,
    })
    expect(parseHostInput('2001:db8::1')).toEqual({ host: '2001:db8::1' })
  })

  it('formats and parses DN strings and objects with localization', () => {
    expect(formatDn(null)).toBe('')
    expect(formatDn('CN=example.com\nO=Example Inc')).toBe('CN=example.com, O=Example Inc')
    expect(formatDn({ CN: 'example.com', O: 'Example Inc', OU: '' })).toBe(
      'CN=example.com, O=Example Inc',
    )

    expect(parseDnEntries(undefined)).toEqual([])
    const objEntries = parseDnEntries({ cn: 'test.dev', o: 'Test Org', empty: '' }, i18n.t)
    expect(objEntries).toHaveLength(2)
    expect(objEntries[0]).toEqual({ key: 'CN', label: 'Common Name', value: 'test.dev' })

    const strEntries = parseDnEntries('CN=leaf.dev, EMAILADDRESS=sec@leaf.dev, UnparsedChunk')
    expect(strEntries).toEqual([
      { key: 'CN', label: 'Common Name', value: 'leaf.dev' },
      { key: 'EMAILADDRESS', label: 'Email', value: 'sec@leaf.dev' },
      { key: 'RAW', label: 'Raw', value: 'UnparsedChunk' },
    ])
  })

  it('calculates certificate validity progress for valid, expiring-soon, expired, and invalid dates', () => {
    const now = new Date('2026-06-01T00:00:00Z').getTime()
    const normal = calculateValidityProgress('2026-01-01T00:00:00Z', '2026-12-31T00:00:00Z', now)
    expect(normal.isExpired).toBe(false)
    expect(normal.isExpiringSoon).toBe(false)
    expect(normal.percent).toBeGreaterThan(35)

    const soon = calculateValidityProgress('2026-01-01T00:00:00Z', '2026-06-15T00:00:00Z', now)
    expect(soon.isExpired).toBe(false)
    expect(soon.isExpiringSoon).toBe(true)
    expect(soon.daysRemaining).toBe(14)

    const expired = calculateValidityProgress('2025-01-01T00:00:00Z', '2026-05-20T00:00:00Z', now)
    expect(expired.isExpired).toBe(true)
    expect(expired.daysExpired).toBe(12)

    const invalid = calculateValidityProgress('not-a-date', '2026-01-01T00:00:00Z', now)
    expect(invalid.percent).toBe(100)
    expect(invalid.isExpired).toBe(true)
  })

  it('maps TLS authorization errors and key descriptions cleanly', () => {
    expect(formatAuthError(null, i18n.t).title).toBe('Validation Issue')
    expect(formatAuthError('DEPTH_ZERO_SELF_SIGNED_CERT', i18n.t)).toEqual({
      title: 'Self-Signed Leaf Certificate',
      detail: 'DEPTH_ZERO_SELF_SIGNED_CERT',
    })
    expect(formatAuthError('CERT_HAS_EXPIRED', i18n.t).title).toBe('Certificate Expired')
    expect(formatAuthError('ERR_TLS_CERT_ALTNAME_INVALID', i18n.t).title).toBe('Hostname Mismatch')
    expect(formatAuthError('CUSTOM_UNKNOWN_CODE', i18n.t)).toEqual({
      title: 'CUSTOM UNKNOWN CODE',
      detail: 'CUSTOM_UNKNOWN_CODE',
    })

    expect(formatKeyDescription({ keyType: 'ec', keyDetails: { namedCurve: 'P-384' } })).toBe(
      'ECDSA (P-384)',
    )
    expect(formatKeyDescription({ keyType: 'rsa', bits: 4096 })).toBe('RSA (4096-bit)')
    expect(formatKeyDescription({ keyType: 'ed25519' })).toBe('ED25519')
    expect(formatKeyDescription({}, i18n.t)).toBe('Unknown Public Key')
  })

  it('enriches raw DER base64 certificates with PEM, CNs, roles, and fallback extensions', () => {
    expect(derB64ToPem('')).toBe('')
    const synth = scanTlsClientSide('google.com', 443)
    const strippedLeaf = {
      ...synth.chain[0],
      pem: '',
      subjectCN: undefined,
      issuerCN: undefined,
      extensions: [],
    }
    const enriched = enrichTlsChain([strippedLeaf, synth.chain[1], synth.chain[2]])
    expect(enriched[0].pem).toContain('-----BEGIN CERTIFICATE-----')
    expect(enriched[0].subjectCN).toContain('CN=google.com')
    expect(enriched[0].extensions.length).toBeGreaterThan(0)

    expect(resolveChainRole(enriched[0], 0, 3).role).toBe('leaf')
    expect(resolveChainRole(enriched[1], 1, 3).role).toBe('intermediate')
    expect(resolveChainRole(enriched[2], 2, 3)).toEqual({ role: 'root', isSelfSigned: true })
  })
})

describe('TlsScanner component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('exports both named and default component and renders accessible header, inputs, and presets', () => {
    expect(TlsScannerDefault).toBe(TlsScanner)
    renderScanner()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Remote TLS Scanner' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Hostname / Domain / IP')).toBeInTheDocument()
    expect(screen.getByLabelText('Port')).toHaveValue(443)
    expect(screen.getByRole('button', { name: /Scan Endpoint/i })).toBeInTheDocument()

    for (const preset of TLS_QUICK_PRESETS) {
      expect(
        screen.getByRole('button', { name: new RegExp(preset.label, 'i') }),
      ).toBeInTheDocument()
    }
  })

  it('shows validation error when submitting an empty host', async () => {
    renderScanner()
    fireEvent.click(screen.getByRole('button', { name: /Scan Endpoint/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Host is required')
  })

  it('falls back to client-side TLS scan when local API is unavailable and maintains h1 -> h2 -> h3 order', async () => {
    vi.spyOn(apiClient, 'fetchLocalApiJson').mockRejectedValue(new WebApiUnavailableError())

    renderScanner()
    fireEvent.click(screen.getByRole('button', { name: /home-management\.dev/i }))

    expect(
      await screen.findByRole('heading', { level: 2, name: /Presented Certificate Chain/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Trusted by System Store')).toBeInTheDocument()
    expect(screen.getByText('TLS_AES_128_GCM_SHA256')).toBeInTheDocument()

    const headings = screen.getAllByRole('heading')
    const levels = headings.map((h) => Number(h.tagName.slice(1)))
    expect(levels[0]).toBe(1)
    expect(levels[1]).toBe(2)
    expect(levels.slice(2).every((lvl) => lvl === 3)).toBe(true)

    const stepper = screen.getByRole('region', { name: 'Certificate Chain Stepper' })
    const stepButtons = within(stepper).getAllByRole('button')
    expect(stepButtons).toHaveLength(3)
    fireEvent.click(stepButtons[1])
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('renders untrusted single-cert and expired warnings for badssl presets', async () => {
    vi.spyOn(apiClient, 'fetchLocalApiJson').mockRejectedValue(new WebApiUnavailableError())

    renderScanner()
    fireEvent.click(screen.getByRole('button', { name: /self-signed\.badssl\.com/i }))

    expect(await screen.findByText('Self-Signed Leaf Certificate')).toBeInTheDocument()
    expect(screen.getByText('Single Leaf / Self-Signed')).toBeInTheDocument()
    expect(screen.getByText('Trust Path Warning')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /expired\.badssl\.com/i }))
    expect(await screen.findByText('Certificate Expired')).toBeInTheDocument()
  })

  it('supports SAN filtering, DN raw toggle, extensions accordion, PEM export/copy, and error handling', async () => {
    const baseResult = scanTlsClientSide('github.com', 443)
    const richResult: TlsScanResult = {
      ...baseResult,
      chain: [
        {
          ...baseResult.chain[0],
          subjectAltNames: [
            'DNS:github.com',
            'DNS:www.github.com',
            'DNS:api.github.com',
            'DNS:gist.github.com',
            'DNS:pages.github.com',
            'DNS:raw.github.com',
            'DNS:assets.github.com',
          ],
        },
        baseResult.chain[1],
        baseResult.chain[2],
      ],
    }

    const apiSpy = vi
      .spyOn(apiClient, 'fetchLocalApiJson')
      .mockResolvedValueOnce({ data: richResult })
      .mockRejectedValueOnce(new Error('TLS socket reset by peer'))

    const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-pem')
    const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    renderScanner()

    const hostInput = screen.getByLabelText('Hostname / Domain / IP')
    fireEvent.change(hostInput, { target: { value: 'https://github.com:8443/login' } })
    fireEvent.submit(hostInput.closest('form')!)

    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalledWith('/api/tlsscanner?host=github.com&port=8443')
    })

    // SAN filtering (> 6 SANs renders filter input)
    const sanSearch = await screen.findByLabelText('Filter SAN domains...')
    fireEvent.change(sanSearch, { target: { value: 'gist' } })
    const gistPill = screen.getByRole('button', { name: 'DNS:gist.github.com' })
    fireEvent.click(gistPill)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('DNS:gist.github.com')

    fireEvent.change(sanSearch, { target: { value: 'nonexistent-subdomain' } })
    expect(screen.getByText('No SAN domains matching search filter')).toBeInTheDocument()

    // Toggle raw DN view
    const rawButtons = screen.getAllByRole('button', { name: 'View Raw' })
    fireEvent.click(rawButtons[0])
    expect(screen.getAllByRole('button', { name: 'View Structured' }).length).toBeGreaterThan(0)

    // Expand extensions accordion
    const extButtons = screen.getAllByRole('button', { name: /View Extensions/i })
    fireEvent.click(extButtons[0])
    expect(screen.getAllByText(/2\.5\.29\.19/i).length).toBeGreaterThan(0)

    // Jump to issuer (#2), copy CN, copy serial, copy fingerprint
    fireEvent.click(screen.getByRole('button', { name: '#2' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy Common Name' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy Serial Number' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy Full Fingerprint' })[0])

    // Open PEM viewer, copy PEM, download single PEM, copy full chain, download bundle
    const pemToggle = screen.getAllByRole('button', { name: 'PEM' })[0]
    fireEvent.click(pemToggle)
    expect(screen.getByText('X.509 Certificate (PEM Format)')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Copy PEM' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Download PEM' })[0])
    fireEvent.click(screen.getByRole('button', { name: /Copy Full Chain/i }))
    fireEvent.click(screen.getByRole('button', { name: /Download Bundle/i }))

    expect(createUrlSpy).toHaveBeenCalled()
    expect(anchorClickSpy).toHaveBeenCalled()
    expect(revokeUrlSpy).toHaveBeenCalled()

    // Trigger operational API error on second scan
    fireEvent.click(screen.getByRole('button', { name: /Scan Endpoint/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('TLS socket reset by peer')
  })
})
