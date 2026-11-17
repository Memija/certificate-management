import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToastStore } from '@/store'
import type { ParsedCertificate } from '@/types'

import { CertificateDetails } from './index'

const SAMPLE_PEM = [
  '-----BEGIN CERTIFICATE-----',
  'MIIBszCCAVugAwIBAgIUQ2VydE1nci1UZXN0LVNlcmlhbDAKBggqhkjOPQQDAjAe',
  '-----END CERTIFICATE-----',
].join('\n')

function createSampleCertificate(overrides: Partial<ParsedCertificate> = {}): ParsedCertificate {
  return {
    subject: 'CN=Windows UEFI CA 2023, O=Microsoft Corporation, C=US',
    issuer: 'CN=Microsoft Root Certificate Authority 2010, O=Microsoft Corporation, C=US',
    validFrom: '2023-09-14T19:21:31.000Z',
    validTo: '2038-09-14T19:31:31.000Z',
    serialNumber: '330000001A2B3C4D',
    signatureType: 'SHA256withRSA',
    pem: SAMPLE_PEM,
    isRoot: false,
    isIntermediate: true,
    isLeaf: false,
    isExpired: false,
    purposes: ['Digital Signature', 'Certificate Signing'],
    version: 2,
    signatureOid: '1.2.840.113549.1.1.11',
    signatureAlgorithm: 'sha256WithRSAEncryption',
    publicKeyAlgorithm: 'RSA',
    publicKeySize: 2048,
    fingerprintSha1: 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD',
    fingerprintSha256:
      '11:22:33:44:55:66:77:88:99:00:AA:BB:CC:DD:EE:FF:11:22:33:44:55:66:77:88:99:00:AA:BB:CC:DD:EE:FF',
    extensions: [
      {
        name: 'Basic Constraints',
        oid: '2.5.29.19',
        critical: true,
        value: 'Is CA: Yes',
      },
      {
        name: 'Key Usage',
        oid: '2.5.29.15',
        critical: false,
        value: 'Digital Signature, Certificate Signing (86)',
      },
    ],
    ...overrides,
  }
}

describe('CertificateDetails', () => {
  const writeTextMock = vi.fn<(_text: string) => Promise<void>>()

  beforeEach(() => {
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

  it('renders certificate metadata, extensions, and enforces type="button" with zero inline styles', () => {
    const cert = createSampleCertificate()
    const { container } = render(<CertificateDetails cert={cert} />)

    expect(screen.getByText(cert.subject)).toBeInTheDocument()
    expect(screen.getByText(cert.issuer)).toBeInTheDocument()
    expect(screen.getByText('v3')).toBeInTheDocument()
    expect(
      screen.getByText(/sha256WithRSAEncryption \(1\.2\.840\.113549\.1\.1\.11\)/),
    ).toBeInTheDocument()
    expect(screen.getByText(/RSA \(2048 bits\)/)).toBeInTheDocument()
    expect(screen.getByText(/Extensions \(2\)/)).toBeInTheDocument()
    expect(screen.getByText('2.5.29.19')).toBeInTheDocument()
    expect(screen.getByText('(Critical)')).toBeInTheDocument()

    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(7)
    for (const button of buttons) {
      expect(button).toHaveAttribute('type', 'button')
    }
    expect(container.querySelector('[style]')).toBeNull()
  })

  it('renders expired badge when cert.isExpired is true and omits optional sections when empty', () => {
    const expiredCert = createSampleCertificate({
      validTo: '2020-01-01T00:00:00.000Z',
      isExpired: true,
      publicKeySize: null,
      extensions: [],
      pem: '',
    })

    render(<CertificateDetails cert={expiredCert} />)

    expect(screen.getByText('Expired')).toBeInTheDocument()
    expect(screen.queryByText(/Extensions \(/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Download PEM/i })).not.toBeInTheDocument()
  })

  it('copies serial number, fingerprints, and PEM text to clipboard and toggles PEM viewer', async () => {
    vi.useFakeTimers()
    const cert = createSampleCertificate()
    render(<CertificateDetails cert={cert} />)

    // Copy Serial Number
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: cert.serialNumber }))
    })
    expect(writeTextMock).toHaveBeenCalledWith(cert.serialNumber)

    // Copy SHA-1 & SHA-256
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: cert.fingerprintSha1 }))
      fireEvent.click(screen.getByRole('button', { name: cert.fingerprintSha256 }))
    })
    expect(writeTextMock).toHaveBeenCalledWith(cert.fingerprintSha1)
    expect(writeTextMock).toHaveBeenCalledWith(cert.fingerprintSha256)

    // Copy PEM and check Copied state reset after 2000ms
    const copyPemBtn = screen.getByRole('button', { name: /Copy PEM/i })
    await act(async () => {
      fireEvent.click(copyPemBtn)
    })
    expect(writeTextMock).toHaveBeenCalledWith(SAMPLE_PEM)
    expect(screen.getByRole('button', { name: /Copied/i })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2100)
    })
    expect(screen.getByRole('button', { name: /Copy PEM/i })).toBeInTheDocument()

    // Toggle PEM viewer
    const viewPemBtn = screen.getByRole('button', { name: /View PEM/i })
    expect(viewPemBtn).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(viewPemBtn)

    const hidePemBtn = screen.getByRole('button', { name: /Hide PEM/i })
    expect(hidePemBtn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/BEGIN CERTIFICATE/)).toBeInTheDocument()
  })

  it('downloads PEM and DER files and handles corrupt PEM / clipboard failure gracefully', async () => {
    const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-cert')
    const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const cert = createSampleCertificate()
    const { rerender } = render(<CertificateDetails cert={cert} />)

    fireEvent.click(screen.getByRole('button', { name: /Download PEM/i }))
    expect(createUrlSpy).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeUrlSpy).toHaveBeenCalledWith('blob:mock-cert')

    fireEvent.click(screen.getByRole('button', { name: /Download DER/i }))
    expect(createUrlSpy).toHaveBeenCalledTimes(2)
    expect(revokeUrlSpy).toHaveBeenCalledTimes(2)

    // Corrupt PEM should catch error and show error toast
    const corruptCert = createSampleCertificate({
      subject: '',
      serialNumber: '',
      pem: '-----BEGIN CERTIFICATE-----\n***NOT_BASE64***\n-----END CERTIFICATE-----',
    })
    rerender(<CertificateDetails cert={corruptCert} />)
    fireEvent.click(screen.getByRole('button', { name: /Download DER/i }))
    expect(errorSpy).toHaveBeenCalled()

    // Clipboard failure should catch and show error toast
    writeTextMock.mockRejectedValueOnce(new Error('Clipboard denied'))
    fireEvent.click(screen.getByRole('button', { name: /Copy PEM/i }))
    await waitFor(() => {
      const hasErrorToast = useToastStore.getState().toasts.some((item) => item.type === 'error')
      expect(hasErrorToast).toBe(true)
    })
  })
})
