import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EfiSignatureList, ParsedCertificate } from '@/types'
import { fetchLocalApiJson, WebApiUnavailableError } from '@/utils/api-client'
import { buildDerAndPemCert, getWebFallbackSecureBootVars } from '@/utils/web-fallbacks'

import { BootHealthWarnings } from './BootHealthWarnings'
import SecureBootInspectorDefault, { SecureBootInspector } from './index'
import {
  assessBootHealth,
  extractSubjectCn,
  isUserCanceledError,
  isWebFallbackError,
  parseSecureBootVariablePayload,
} from './secure-boot-helpers'

vi.mock('@/utils/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/api-client')>()
  return {
    ...actual,
    fetchLocalApiJson: vi.fn(),
  }
})

const mockedFetchLocalApiJson = vi.mocked(fetchLocalApiJson)

function createMockCert(overrides: Partial<ParsedCertificate> = {}): ParsedCertificate {
  return {
    subject: 'CN=Test Boot CA, O=Contoso, C=US',
    issuer: 'CN=Test Root CA, O=Contoso, C=US',
    validFrom: '2024-01-01T00:00:00.000Z',
    validTo: '2035-01-01T00:00:00.000Z',
    serialNumber: '01020304',
    signatureType: 'SHA256withRSA',
    pem: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
    isRoot: false,
    isIntermediate: true,
    isLeaf: false,
    isExpired: false,
    purposes: ['Code Signing'],
    version: 2,
    signatureOid: '1.2.840.113549.1.1.11',
    signatureAlgorithm: 'sha256WithRSAEncryption',
    publicKeyAlgorithm: 'RSA',
    publicKeySize: 2048,
    fingerprintSha1: 'AA:BB:CC',
    fingerprintSha256: '11:22:33',
    extensions: [],
    ...overrides,
  }
}

function createSignatureList(certs: ParsedCertificate[]): EfiSignatureList {
  return {
    signatureTypeGuid: 'a5c059a1-94e4-4aa7-87b5-ab155c2bf072',
    signatureTypeName: 'EFI_CERT_X509_GUID',
    signatureListSize: 1024,
    signatureHeaderSize: 0,
    signatureSize: 512,
    signatures: certs.map((certificate, i) => ({
      signatureOwner: `77fa9abd-0359-4d32-bd60-28f4e78f784${i}`,
      certificate,
      rawData: new Uint8Array([1, 2, 3]),
    })),
  }
}

describe('SecureBootInspector', () => {
  beforeEach(() => {
    mockedFetchLocalApiJson.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exports both named and default component exports', () => {
    expect(SecureBootInspector).toBe(SecureBootInspectorDefault)
  })

  it('falls back gracefully to web fallback vars, enforces heading order, type="button", and zero inline styles', async () => {
    mockedFetchLocalApiJson.mockRejectedValue(new WebApiUnavailableError())

    const { container } = render(<SecureBootInspector />)

    await waitFor(
      () => {
        expect(screen.getByText('Secure Boot System Assessment')).toBeInTheDocument()
      },
      { timeout: 5000 },
    )

    // Heading hierarchy check: h1 -> h2 -> h3 without skipping levels
    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    expect(headings.length).toBeGreaterThan(0)
    expect(headings[0]?.tagName).toBe('H1')
    for (let i = 1; i < headings.length; i += 1) {
      const prevLevel = Number(headings[i - 1]?.tagName.slice(1))
      const currLevel = Number(headings[i]?.tagName.slice(1))
      expect(currLevel - prevLevel).toBeLessThanOrEqual(1)
    }

    // All buttons have type="button" and zero inline styles exist
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(4)
    for (const btn of buttons) {
      expect(btn).toHaveAttribute('type', 'button')
    }
    expect(container.querySelector('[style]')).toBeNull()

    // Expand an X.509 signature card on db tab
    const sigToggles = screen.getAllByRole('button', { name: /Raw X\.509 Certificate/i })
    expect(sigToggles[0]).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(sigToggles[0]!)
    expect(sigToggles[0]).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Owner GUID')).toBeInTheDocument()

    // Switch to dbx tab and expand a SHA-256 hash signature
    const dbxBtn = container.querySelector('button[data-var="dbx"]')
    expect(dbxBtn).not.toBeNull()
    fireEvent.click(dbxBtn!)

    await waitFor(() => {
      expect(screen.getByText(/Signatures \(dbx\)/)).toBeInTheDocument()
    })
    const hashToggles = screen.getAllByRole('button', { name: /Hash \/ Binary Signature/i })
    fireEvent.click(hashToggles[0]!)
    expect(screen.getByText('Raw Hex Data:')).toBeInTheDocument()

    // Switch to KEK and back to db (hits parsedVarsCacheRef)
    fireEvent.click(container.querySelector('button[data-var="KEK"]')!)
    await waitFor(() => {
      expect(screen.getByText(/Signatures \(KEK\)/)).toBeInTheDocument()
    })

    fireEvent.click(container.querySelector('button[data-var="db"]')!)
    await waitFor(() => {
      expect(screen.getByText(/Signatures \(db\)/)).toBeInTheDocument()
    })
  })

  it('renders raw X.509 certificates, empty variables, parse errors, and supports Refresh', async () => {
    const rawLeafCert = buildDerAndPemCert({
      serialHex: '9988776655',
      subject: [
        { shortName: 'CN', value: 'Custom Platform Leaf Cert' },
        { shortName: 'O', value: 'OEM Corp' },
      ],
      issuer: [
        { shortName: 'CN', value: 'OEM Root Authority' },
        { shortName: 'O', value: 'OEM Corp' },
      ],
      notBefore: new Date('2020-01-01T00:00:00Z'),
      notAfter: new Date('2022-01-01T00:00:00Z'),
      isCA: false,
    })
    const fallbackVars = getWebFallbackSecureBootVars()

    mockedFetchLocalApiJson.mockResolvedValue({
      data: {
        db: fallbackVars.db ?? '',
        dbx: '',
        KEK: btoa('not-a-valid-efi-or-x509-payload'),
        PK: rawLeafCert.certB64,
      },
    })

    const { container } = render(<SecureBootInspector />)

    await waitFor(() => {
      expect(screen.getByText(/Signatures \(db\)/)).toBeInTheDocument()
    })

    // Empty variable (dbx)
    fireEvent.click(container.querySelector('button[data-var="dbx"]')!)
    expect(screen.getByText('Variable is Empty')).toBeInTheDocument()

    // Unparseable payload (KEK)
    fireEvent.click(container.querySelector('button[data-var="KEK"]')!)
    await waitFor(() => {
      expect(screen.getByText('Error parsing variable')).toBeInTheDocument()
    })
    expect(
      screen.getByText(/Could not parse KEK as an EFI Signature List or X\.509 certificate/),
    ).toBeInTheDocument()

    // Raw X.509 certificate (PK)
    fireEvent.click(container.querySelector('button[data-var="PK"]')!)
    await waitFor(() => {
      expect(screen.getByText(/Custom Platform Leaf Cert/)).toBeInTheDocument()
    })

    // Refresh button reloads from API with &refresh=true and keeps PK selected
    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }))
    await waitFor(() => {
      expect(mockedFetchLocalApiJson).toHaveBeenCalledWith('/api/secureboot?var=all&refresh=true')
    })
    expect(screen.getByText(/Custom Platform Leaf Cert/)).toBeInTheDocument()
  })

  it('handles UAC elevation prompt, waiting state, user cancellation, and successful unlock', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // 1. Initial unprivileged read fails with access denied
    mockedFetchLocalApiJson.mockRejectedValueOnce(new Error('Access is denied'))

    render(<SecureBootInspector />)

    await waitFor(() => {
      expect(screen.getByText('Administrator Access Required')).toBeInTheDocument()
    })

    // 2. User clicks Unlock and cancels UAC prompt
    let rejectElevation!: (reason?: unknown) => void
    mockedFetchLocalApiJson.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectElevation = reject
        }),
    )

    fireEvent.click(screen.getByRole('button', { name: /Unlock Secure Boot Variables/i }))
    expect(screen.getByText(/Waiting for Administrator Approval/)).toBeInTheDocument()

    await act(async () => {
      rejectElevation(new Error('The operation was canceled by the user.'))
    })

    await waitFor(() => {
      expect(screen.getByText(/cancelled the Administrator prompt/i)).toBeInTheDocument()
    })

    // 3. Generic elevation error
    mockedFetchLocalApiJson.mockRejectedValueOnce(new Error('Elevation helper failed'))
    fireEvent.click(screen.getByRole('button', { name: /Unlock Secure Boot Variables/i }))
    await waitFor(() => {
      expect(screen.getByText('Elevation helper failed')).toBeInTheDocument()
    })

    // 4. Retry elevation succeeds
    const fallbackVars = getWebFallbackSecureBootVars()
    mockedFetchLocalApiJson.mockResolvedValueOnce({ data: fallbackVars })
    fireEvent.click(screen.getByRole('button', { name: /Unlock Secure Boot Variables/i }))

    await waitFor(
      () => {
        expect(screen.getByText('Secure Boot System Assessment')).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
  })

  it('evaluates boot health warnings and helper edge cases accurately', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const now = new Date('2026-11-17T12:00:00Z')
    const translate = (key: string) => key

    // All expired MS certs -> critical warnings
    const expiredList = createSignatureList([
      createMockCert({
        subject: 'CN=Microsoft Windows Production PCA 2011, O=Microsoft Corporation',
        validTo: '2026-10-19T00:00:00Z',
        isExpired: true,
      }),
      createMockCert({
        subject: 'CN=Microsoft Corporation UEFI CA 2011, O=Microsoft Corporation',
        validTo: '2026-06-27T00:00:00Z',
        isExpired: true,
      }),
    ])
    const critResult = assessBootHealth([expiredList], translate, now)
    expect(critResult.criticals).toContain('app.secureBoot.critNoValidDb')
    expect(critResult.criticals).toContain('app.secureBoot.critExpiredWindowsPca')
    expect(critResult.criticals).toContain('app.secureBoot.critExpiredUefiCa')

    // Valid non-MS cert expiring within 30 days -> expiring soon + missing Windows PCA warnings
    const soonList = createSignatureList([
      createMockCert({
        subject: 'CN=Linux Vendor Shim CA',
        validTo: '2026-11-28T00:00:00Z',
      }),
    ])
    const warnResult = assessBootHealth([soonList], translate, now)
    expect(warnResult.criticals).toHaveLength(0)
    expect(warnResult.warnings).toContain('app.secureBoot.warnExpiringSoon')
    expect(warnResult.warnings).toContain('app.secureBoot.warnMissingWindowsPca')

    // Render BootHealthWarnings directly with critical & warning items
    const { rerender } = render(<BootHealthWarnings lists={[expiredList]} />)
    expect(screen.getAllByText('Critical Warning').length).toBeGreaterThanOrEqual(1)
    rerender(<BootHealthWarnings lists={[soonList]} />)
    expect(screen.getAllByText('Warning').length).toBeGreaterThanOrEqual(1)

    // Helper edge cases
    expect(extractSubjectCn('O=Fallback Org, C=US')).toBe('Fallback Org')
    expect(extractSubjectCn('SERIALNUMBER=12345')).toBe('SERIALNUMBER=12345')
    expect(isWebFallbackError({ isWebFallback: true })).toBe(true)
    expect(isWebFallbackError(new Error('nope'))).toBe(false)
    expect(isUserCanceledError('Cancelled by the user')).toBe(true)

    const corruptBase64Result = await parseSecureBootVariablePayload('db', '***not_base64***')
    expect(corruptBase64Result.error).toMatch(/Error parsing db:/)
    expect(errorSpy).toHaveBeenCalled()
  })
})
