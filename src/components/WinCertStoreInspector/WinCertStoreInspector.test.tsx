import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToastStore } from '@/store'
import type { WinCertEntry } from '@/types'
import { fetchLocalApiJson, WebApiUnavailableError } from '@/utils/api-client'
import { getWebFallbackCertStore } from '@/utils/web-fallbacks'

import WinCertStoreInspectorDefault, { WinCertStoreInspector } from './index'
import {
  classifyWinStoreError,
  decodeWinCertDerBytes,
  extractDnDisplayName,
  sanitizeWinCertFilename,
} from './win-cert-helpers'

vi.mock('@/utils/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/api-client')>()
  return {
    ...actual,
    fetchLocalApiJson: vi.fn(),
  }
})

const mockedFetchLocalApiJson = vi.mocked(fetchLocalApiJson)

function createCustomWinCert(overrides: Partial<WinCertEntry> = {}): WinCertEntry {
  return {
    thumbprint: 'AABBCCDDEEFF00112233445566778899AABBCCDD',
    subject: 'CN=app.contoso.local, O=Contoso Corp, C=US',
    issuer: 'CN=Special Issuer Authority, O=Issuer Org, C=US',
    notBefore: '2024-01-01T00:00:00.000Z',
    notAfter: '2030-01-01T00:00:00.000Z',
    serialNumber: '1122334455',
    signatureAlgorithm: 'sha256RSA',
    publicKeyAlgorithm: 'RSA',
    publicKeySize: 2048,
    friendlyName: 'Contoso App TLS',
    purposes: ['Server Authentication', 'Client Authentication'],
    isRoot: false,
    isIntermediate: false,
    isExpired: false,
    isExpiringSoon: false,
    pem: '-----BEGIN CERTIFICATE-----\nMIIBszCCAVugAwIBAgIUQ2VydE1nci1UZXN0LVNlcmlhbDAKBggqhkjOPQQDAjAe\n-----END CERTIFICATE-----',
    extensions: [
      {
        name: 'Basic Constraints',
        oid: '2.5.29.19',
        critical: true,
        value: 'Subject Type=End Entity',
      },
    ],
    ...overrides,
  }
}

describe('WinCertStoreInspector', () => {
  const writeTextMock = vi.fn<(_text: string) => Promise<void>>()

  beforeEach(() => {
    mockedFetchLocalApiJson.mockReset()
    writeTextMock.mockReset()
    writeTextMock.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('exports both named and default component exports', () => {
    expect(WinCertStoreInspector).toBe(WinCertStoreInspectorDefault)
  })

  it('loads web fallback certificates, enforces heading order, type="button", accessible controls, and zero inline styles', async () => {
    mockedFetchLocalApiJson.mockRejectedValue(new WebApiUnavailableError())

    const { container } = render(<WinCertStoreInspector />)

    await waitFor(() => {
      expect(screen.getByText('DigiCert Global Root G2')).toBeInTheDocument()
    })

    // Sequential heading order: h1 -> h2 -> h3
    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    expect(headings.length).toBeGreaterThan(2)
    expect(headings[0]?.tagName).toBe('H1')
    for (let i = 1; i < headings.length; i += 1) {
      const prevLevel = Number(headings[i - 1]?.tagName.slice(1))
      const currLevel = Number(headings[i]?.tagName.slice(1))
      expect(currLevel - prevLevel).toBeLessThanOrEqual(1)
    }

    // All buttons have type="button" and zero inline styles
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(10)
    for (const btn of buttons) {
      expect(btn).toHaveAttribute('type', 'button')
    }
    expect(container.querySelector('[style]')).toBeNull()

    // Switch to Intermediate CAs (CA) store and verify Misplaced Root badge
    const caTab = container.querySelector('button[data-store="CA"]')
    expect(caTab).not.toBeNull()
    fireEvent.click(caTab!)

    await waitFor(() => {
      expect(screen.getByText('Contoso Legacy Internal Root CA')).toBeInTheDocument()
    })
    expect(screen.getByText('Misplaced Root')).toBeInTheDocument()

    // Switch to Personal (My), TrustedPublisher, Disallowed, and LocalMachine location
    fireEvent.click(container.querySelector('button[data-store="My"]')!)
    await waitFor(() => {
      expect(screen.getByText('workstation-dev.corp.local')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Local Machine' }))
    await waitFor(() => {
      expect(screen.getByText('home-management.dev')).toBeInTheDocument()
    })

    fireEvent.click(container.querySelector('button[data-store="TrustedPublisher"]')!)
    await waitFor(() => {
      expect(
        screen.getByText('Microsoft Windows Hardware Compatibility Publisher'),
      ).toBeInTheDocument()
    })

    fireEvent.click(container.querySelector('button[data-store="Disallowed"]')!)
    await waitFor(() => {
      expect(screen.getByText('Superfish VisualDiscovery Untrusted Root CA')).toBeInTheDocument()
    })
  })

  it('supports timeline stat filters, issuer search hints, desktop sorting, and mobile sort sheet dialog', async () => {
    const myCerts = getWebFallbackCertStore('My', 'CurrentUser')
    mockedFetchLocalApiJson.mockResolvedValue({ data: myCerts })

    const { container } = render(<WinCertStoreInspector />)

    await waitFor(() => {
      expect(screen.getByText('workstation-dev.corp.local')).toBeInTheDocument()
    })

    // Filter by Expired stat button
    const expiredStatBtn = screen.getByRole('button', { name: /^\d+\s+Expired$/i })
    fireEvent.click(expiredStatBtn)
    expect(screen.getByText('legacy-vpn-gateway.internal')).toBeInTheDocument()
    expect(screen.queryByText('workstation-dev.corp.local')).not.toBeInTheDocument()

    // Filter by Expiring Soon stat button
    fireEvent.click(screen.getByRole('button', { name: /^\d+\s+Expiring Soon$/i }))
    expect(screen.getByText('dev-signing@home-management.dev')).toBeInTheDocument()

    // Filter by Valid stat button, then back to Total (all)
    fireEvent.click(screen.getByRole('button', { name: /^\d+\s+Valid$/i }))
    expect(screen.queryByText('legacy-vpn-gateway.internal')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^\d+\s+Total$/i }))
    expect(screen.getByText('legacy-vpn-gateway.internal')).toBeInTheDocument()

    // Search by issuer name triggers "Issued by:" hint
    const searchInput = screen.getByRole('searchbox')
    fireEvent.change(searchInput, { target: { value: 'DigiCert TLS RSA' } })
    await waitFor(() => {
      expect(screen.getByText(/Issued by: DigiCert TLS RSA SHA256 2020 CA1/)).toBeInTheDocument()
    })

    // Non-matching search shows empty filter message
    fireEvent.change(searchInput, { target: { value: 'zzz-nonexistent-query-999' } })
    await waitFor(() => {
      expect(screen.getByText('No certificates match your filter.')).toBeInTheDocument()
    })

    // Clear search and exercise desktop sort select + direction toggle
    fireEvent.change(searchInput, { target: { value: '' } })
    await waitFor(() => {
      expect(screen.getByText('workstation-dev.corp.local')).toBeInTheDocument()
    })

    const sortSelect = screen.getByLabelText(/Sort by:/i)
    fireEvent.change(sortSelect, { target: { value: 'expiry' } })
    fireEvent.change(sortSelect, { target: { value: 'name' } })

    const ascButtons = screen.getAllByRole('button', { name: 'ASC' })
    fireEvent.click(ascButtons[0]!)
    expect(screen.getAllByRole('button', { name: 'DESC' }).length).toBeGreaterThan(0)

    // Open mobile sort bottom sheet dialog, interact with options, and close with Escape
    const sortSheetTrigger = container.querySelector('button[aria-haspopup="dialog"]')
    expect(sortSheetTrigger).not.toBeNull()
    fireEvent.click(sortSheetTrigger!)

    const dialog = screen.getByRole('dialog', { name: /Sort Certificates/i })
    expect(dialog).toBeInTheDocument()

    // Flip direction inside modal header and close with Escape
    fireEvent.click(within(dialog).getByRole('button', { name: 'DESC' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Reopen and select Expiry Date option inside listbox
    fireEvent.click(sortSheetTrigger!)
    const reopenedDialog = screen.getByRole('dialog', { name: /Sort Certificates/i })
    const expiryOption = within(reopenedDialog).getByRole('option', { name: /Expiry Date/i })
    fireEvent.click(expiryOption)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Reopen, click already-active Expiry Date option (flips direction), then reopen and close via close button
    fireEvent.click(sortSheetTrigger!)
    fireEvent.click(
      within(screen.getByRole('dialog', { name: /Sort Certificates/i })).getByRole('option', {
        name: /Expiry Date/i,
      }),
    )
    fireEvent.click(sortSheetTrigger!)
    fireEvent.click(
      within(screen.getByRole('dialog', { name: /Sort Certificates/i })).getByRole('button', {
        name: /Cancel/i,
      }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('expands certificate cards, copies fields and PEM, toggles PEM viewer, and downloads PEM/DER files', async () => {
    const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:wincert')
    const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const validCert = createCustomWinCert()
    const corruptDerCert = createCustomWinCert({
      thumbprint: '9999999999999999999999999999999999999999',
      subject: 'CN=corrupt.contoso.local',
      publicKeySize: null,
      friendlyName: '',
      certB64: '***INVALID_BASE64***',
      pem: '-----BEGIN CERTIFICATE-----\n***INVALID***\n-----END CERTIFICATE-----',
    })

    mockedFetchLocalApiJson.mockResolvedValue({ data: [validCert, corruptDerCert] })

    render(<WinCertStoreInspector />)

    await waitFor(() => {
      expect(screen.getByText('app.contoso.local')).toBeInTheDocument()
    })

    // Expand first card
    const toggleBtn = screen.getByRole('button', { name: /app\.contoso\.local/i })
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true')

    expect(screen.getByText('Contoso App TLS')).toBeInTheDocument()
    expect(screen.getByText(/Extensions \(1\)/)).toBeInTheDocument()

    // Copy Serial Number & Thumbprint
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy to clipboard: Serial Number/i }))
      fireEvent.click(screen.getByRole('button', { name: /Copy to clipboard: Thumbprint/i }))
    })
    expect(writeTextMock).toHaveBeenCalledWith(validCert.serialNumber)
    expect(writeTextMock).toHaveBeenCalledWith(validCert.thumbprint)

    // Copy PEM & toggle PEM preview
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy PEM/i }))
    })
    expect(writeTextMock).toHaveBeenCalledWith(validCert.pem)
    expect(screen.getByRole('button', { name: /Copied/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /View PEM/i }))
    expect(screen.getByText(/BEGIN CERTIFICATE/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Hide PEM/i }))

    // Download PEM & DER
    fireEvent.click(screen.getByRole('button', { name: /Download PEM/i }))
    expect(createUrlSpy).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeUrlSpy).toHaveBeenCalledWith('blob:wincert')

    fireEvent.click(screen.getByRole('button', { name: /Download DER/i }))
    expect(createUrlSpy).toHaveBeenCalledTimes(2)

    // Expand second card with corrupt DER and clipboard failure
    fireEvent.click(screen.getByRole('button', { name: /corrupt\.contoso\.local/i }))
    const derButtons = screen.getAllByRole('button', { name: /Download DER/i })
    fireEvent.click(derButtons[1]!)
    expect(errorSpy).toHaveBeenCalled()

    writeTextMock.mockRejectedValueOnce(new Error('Clipboard blocked'))
    const copyPemButtons = screen.getAllByRole('button', { name: /Copy PEM|Copied/i })
    await act(async () => {
      fireEvent.click(copyPemButtons[1]!)
    })
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some((t) => t.type === 'error')).toBe(true)
    })
  })

  it('handles empty stores, API errors, Refresh, and LocalMachine UAC elevation flow', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // 1. Empty store
    mockedFetchLocalApiJson.mockResolvedValueOnce({ data: [] })
    render(<WinCertStoreInspector />)

    await waitFor(() => {
      expect(screen.getByText('No Certificates Found')).toBeInTheDocument()
    })

    // 2. Refresh triggers API error
    mockedFetchLocalApiJson.mockRejectedValueOnce(new Error('Store service unavailable error'))
    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }))
    await waitFor(() => {
      expect(screen.getByText('Store service unavailable error')).toBeInTheDocument()
    })

    // 3. Switch to LocalMachine triggers access denied -> UAC elevation view
    mockedFetchLocalApiJson.mockRejectedValueOnce(new Error('Access denied to LocalMachine'))
    fireEvent.click(screen.getByRole('button', { name: 'Local Machine' }))

    await waitFor(() => {
      expect(screen.getByText('Administrator Access Required')).toBeInTheDocument()
    })

    // 4. Click Unlock LocalMachine -> waiting state -> successful unlock
    let resolveUnlock!: (val: { data: WinCertEntry[] }) => void
    mockedFetchLocalApiJson.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUnlock = resolve
        }),
    )

    fireEvent.click(screen.getByRole('button', { name: /Unlock LocalMachine Store/i }))
    expect(screen.getByText(/Waiting for Administrator Approval/)).toBeInTheDocument()

    await act(async () => {
      resolveUnlock({ data: [createCustomWinCert()] })
    })

    await waitFor(() => {
      expect(screen.getByText('app.contoso.local')).toBeInTheDocument()
    })
  })

  it('covers helper edge cases cleanly', () => {
    expect(extractDnDisplayName('O=Org Only, C=DE')).toBe('Org Only')
    expect(extractDnDisplayName('SERIALNUMBER=99')).toBe('SERIALNUMBER=99')
    expect(
      sanitizeWinCertFilename(
        createCustomWinCert({ subject: '@@@', serialNumber: '', thumbprint: '' }),
      ),
    ).toBe('certificate')
    expect(() =>
      decodeWinCertDerBytes(createCustomWinCert({ certB64: undefined, pem: '' })),
    ).toThrow('Empty certificate payload')
    expect(classifyWinStoreError(new Error('Operation cancelled by the user'), true)).toEqual({
      isFallback: false,
      needsElevation: false,
      errorKeyOrMessage: 'userCanceled',
    })
  })
})
