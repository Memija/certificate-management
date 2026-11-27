import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getSampleCertDerBuffer,
  SAMPLE_MATCHING_CERT_PEM,
  SAMPLE_MATCHING_CSR_PEM,
  SAMPLE_MATCHING_KEY_PEM,
} from '@/data'
import { useAppStore } from '@/store'
import type { ParsedCRL } from '@/types'
import { parseCrlText, SAMPLE_CRL_PEM } from '@/utils/crl-parser'

import {
  buildCrlErrorInfo,
  formatCrlDate,
  formatLocalizedCrlError,
  getIssuerCN,
  getReasonKey,
} from './crl-helpers'
import { CrlOverviewPanel } from './CrlOverviewPanel'
import { CrlRevokedTable } from './CrlRevokedTable'
import CrlInspectorDefault, { CrlInspector } from './index'

function buildLargeMockCrl(): ParsedCRL {
  const reasons = [
    'Unspecified',
    'Key Compromise',
    'CA Compromise',
    'Affiliation Changed',
    'Superseded',
    'Cessation Of Operation',
    'Certificate Hold',
    'Remove From CRL',
    'Privilege Withdrawn',
    'AA Compromise',
  ]
  return {
    version: 2,
    issuer: 'CN=Enterprise Issuing CA, O=Acme Security, C=US',
    thisUpdate: '2026-09-01T00:00:00.000Z',
    nextUpdate: '2028-09-01T00:00:00.000Z',
    isExpired: false,
    pem: SAMPLE_CRL_PEM,
    fingerprintSha256: 'AA:BB:CC:DD:EE:FF:00:11',
    derBase64: btoa('mock-der-bytes'),
    extensions: [
      { name: 'crlNumber', oid: '2.5.29.20', critical: false, value: '42' },
      {
        name: 'authorityKeyIdentifier',
        oid: '2.5.29.35',
        critical: true,
        value: '30 16 80 14 AA BB CC DD EE FF 00 11 22 33 44 55 66 77 88 99',
      },
    ],
    revokedCertificates: Array.from({ length: 25 }, (_, i) => ({
      serialNumber: `00AB${(i + 1).toString(16).padStart(4, '0').toUpperCase()}`,
      revocationDate: `2026-09-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
      reason: reasons[i % reasons.length],
    })),
  }
}

describe('CrlInspector', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-crl-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  })

  it('exports both named and default component and renders clean h1 without Trans tags', () => {
    expect(CrlInspectorDefault).toBe(CrlInspector)
    const { container } = render(<CrlInspector />)

    const h1 = screen.getByRole('heading', {
      level: 1,
      name: 'Certificate Revocation List (CRL) Inspector',
    })
    expect(h1).toBeInTheDocument()
    expect(h1.textContent).not.toContain('<0>')

    expect(screen.getByRole('button', { name: /Try Sample CRL/i })).toBeEnabled()
    expect(
      screen.getByRole('button', { name: /Drop a CRL file here or click to browse/i }),
    ).toBeInTheDocument()

    for (const button of container.querySelectorAll('button')) {
      expect(button).toHaveAttribute('type', 'button')
    }
  })

  it('loads Sample CRL, toggles extensions and raw PEM, copies fingerprint, and exports PEM/DER', async () => {
    render(<CrlInspector />)

    const sampleBtn = screen.getByRole('button', { name: /Try Sample CRL/i })
    fireEvent.click(sampleBtn)

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Loaded Files \(1\)/i }),
      ).toBeInTheDocument()
    })
    expect(sampleBtn).toBeDisabled()

    expect(
      screen.getByRole('heading', { level: 3, name: /CRL Overview & Issuer/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/C=US, ST=CA, O=Test PKI Corp, CN=Test Issuing CA/)).toBeInTheDocument()
    expect(screen.getByText('#3')).toBeInTheDocument()

    // Collapse & expand CRL Extensions
    const extToggle = screen.getByRole('button', { name: /CRL Extensions/i })
    expect(extToggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(extToggle)
    expect(extToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('#3')).not.toBeInTheDocument()
    fireEvent.click(extToggle)
    expect(screen.getByText('#3')).toBeInTheDocument()

    // Copy SHA-256 fingerprint
    const copyShaBtn = screen.getByRole('button', {
      name: /Copy to clipboard: SHA-256 Fingerprint/i,
    })
    fireEvent.click(copyShaBtn)
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    })

    // View & Hide Raw PEM
    fireEvent.click(screen.getByRole('button', { name: /View Raw PEM/i }))
    expect(screen.getByText(/BEGIN X509 CRL/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Copy to clipboard: PEM/i }))
    fireEvent.click(screen.getByRole('button', { name: /Hide Raw PEM/i }))
    expect(screen.queryByText(/BEGIN X509 CRL/)).not.toBeInTheDocument()

    // Download PEM and DER
    fireEvent.click(screen.getByRole('button', { name: /Download PEM/i }))
    fireEvent.click(screen.getByRole('button', { name: /Download DER/i }))
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)

    // Clear active CRL
    fireEvent.click(screen.getByRole('button', { name: /^Clear$/i }))
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
  })

  it('supports search filtering, leading-zero serial lookup, reason badges, and pagination', async () => {
    const mockCrl = buildLargeMockCrl()
    render(
      <CrlOverviewPanel
        crl={mockCrl}
        fileName="enterprise.crl"
        onReplace={vi.fn()}
        onClear={vi.fn()}
      >
        <CrlRevokedTable crl={mockCrl} />
      </CrlOverviewPanel>,
    )

    expect(screen.getByText(/Active CRL/i)).toBeInTheDocument()
    expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument()

    // Navigate pagination
    const nextBtn = screen.getByRole('button', { name: 'Next' })
    const prevBtn = screen.getByRole('button', { name: 'Previous' })
    expect(prevBtn).toBeDisabled()
    fireEvent.click(nextBtn)
    expect(screen.getByText(/Page 2 of 2/i)).toBeInTheDocument()
    expect(nextBtn).toBeDisabled()
    fireEvent.click(prevBtn)
    expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument()

    // Search serial without leading zeros
    const searchInput = screen.getByPlaceholderText(/Search by serial or reason/i)
    fireEvent.change(searchInput, { target: { value: 'AB0001' } })
    await waitFor(() => {
      expect(screen.getByText('00AB0001')).toBeInTheDocument()
    })

    // Copy serial number
    fireEvent.click(screen.getByRole('button', { name: /Copy to clipboard: 00AB0001/i }))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('00AB0001')
    })

    // Search by reason text
    fireEvent.change(searchInput, { target: { value: 'Compromise' } })
    await waitFor(() => {
      expect(screen.getAllByText(/Compromise/i).length).toBeGreaterThan(0)
    })

    // Unmatched search query
    fireEvent.change(searchInput, { target: { value: 'zzz-no-match' } })
    await waitFor(() => {
      expect(
        screen.getByText(/No revoked certificates match your search query/i),
      ).toBeInTheDocument()
    })

    // Clear search
    const clearButtons = screen.getAllByRole('button', { name: 'Clear' })
    fireEvent.click(clearButtons[clearButtons.length - 1])
    await waitFor(() => {
      expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument()
    })
  })

  it('renders empty revoked list message when CRL has zero revoked entries', () => {
    const base = parseCrlText(SAMPLE_CRL_PEM)
    const emptyCrl: ParsedCRL = { ...base, revokedCertificates: [] }
    render(<CrlRevokedTable crl={emptyCrl} />)
    expect(
      screen.getByText(/This CRL currently lists no revoked certificates/i),
    ).toBeInTheDocument()
  })

  it('handles DER CRL upload, deduplication, Replace CRL, and Clear All', async () => {
    render(<CrlInspector />)

    const parsedSample = parseCrlText(SAMPLE_CRL_PEM)
    const derBinary = atob(parsedSample.derBase64)
    const derBytes = Uint8Array.from(derBinary, (c) => c.charCodeAt(0))
    const derFile = new File([derBytes.buffer as ArrayBuffer], 'uploaded.crl', {
      type: 'application/pkix-crl',
    })
    const pemFile = new File([SAMPLE_CRL_PEM], 'duplicate.pem', { type: 'text/plain' })

    const dropZone = screen
      .getByRole('button', { name: /Drop a CRL file here or click to browse/i })
      .closest('.drop-zone')!

    fireEvent.dragOver(dropZone)
    expect(dropZone.className).toContain('active')
    fireEvent.dragLeave(dropZone)
    fireEvent.drop(dropZone, { dataTransfer: { files: [derFile, pemFile] } })

    // Duplicate SHA-256 should deduplicate to 1 loaded CRL
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Loaded Files \(1\)/i }),
      ).toBeInTheDocument()
    })
    expect(screen.getByText('uploaded.crl')).toBeInTheDocument()

    // Replace CRL via replace file input
    const replaceInput = screen.getByLabelText('Replace CRL')
    const replacementFile = new File([SAMPLE_CRL_PEM], 'replaced_list.crl', { type: 'text/plain' })
    fireEvent.change(replaceInput, { target: { files: [replacementFile] } })

    await waitFor(() => {
      expect(screen.getByText('replaced_list.crl')).toBeInTheDocument()
    })

    // Clear All
    fireEvent.click(screen.getByRole('button', { name: /Clear All/i }))
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
  })

  it('shows actionable error banners for X.509 PEM/DER, CSR, Key, and invalid files with navigation', async () => {
    const onNavigate = vi.fn()
    render(<CrlInspector onNavigate={onNavigate} />)

    const fileInput = screen.getByLabelText(/Drop a CRL file here or click to browse/i)

    // 1. PEM Certificate -> Trust Store action
    const certPemFile = new File([SAMPLE_MATCHING_CERT_PEM], 'server.crt', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [certPemFile] } })

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Open in Trust Store Inspector/i }),
      ).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Open in Trust Store Inspector/i }))
    expect(onNavigate).toHaveBeenCalledWith('trust-store')

    // 2. DER Certificate -> includes subject & Trust Store action
    const certDerFile = new File([getSampleCertDerBuffer()], 'server.der', {
      type: 'application/x-x509-ca-cert',
    })
    fireEvent.change(fileInput, { target: { files: [certDerFile] } })
    await waitFor(() => {
      expect(screen.getByText(/matcher\.example\.com/)).toBeInTheDocument()
    })

    // 3. CSR -> CSR Inspector action
    const csrFile = new File([SAMPLE_MATCHING_CSR_PEM], 'request.csr', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [csrFile] } })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Open in CSR Inspector/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Open in CSR Inspector/i }))
    expect(onNavigate).toHaveBeenCalledWith('csr-inspector')

    // 4. Private Key & Invalid format + dismiss alert
    const keyFile = new File([SAMPLE_MATCHING_KEY_PEM], 'priv.key', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [keyFile] } })
    await waitFor(() => {
      expect(screen.getByText(/Private Key/i)).toBeInTheDocument()
    })

    const badFile = new File(['not a crl'], 'corrupt.crl', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [badFile] } })
    await waitFor(() => {
      expect(screen.getByText(/not a valid PEM or DER/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.queryByText(/not a valid PEM or DER/i)).not.toBeInTheDocument()
  })

  it('falls back to useAppStore.setMode when onNavigate is omitted', async () => {
    render(<CrlInspector />)
    const fileInput = screen.getByLabelText(/Drop a CRL file here or click to browse/i)
    const certFile = new File([SAMPLE_MATCHING_CERT_PEM], 'cert.pem', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [certFile] } })

    const navBtn = await screen.findByRole('button', { name: /Open in Trust Store Inspector/i })
    fireEvent.click(navBtn)
    expect(useAppStore.getState().mode).toBe('trust-store')
  })

  it('switches and removes CRL tabs, triggers Add/Replace buttons, and covers crl-helpers branches', async () => {
    render(<CrlInspector />)
    fireEvent.click(screen.getByRole('button', { name: /Try Sample CRL/i }))
    await screen.findByRole('heading', { level: 2, name: /Loaded Files \(1\)/i })

    // Clicking sample again keeps single tab active
    fireEvent.click(screen.getByRole('button', { name: /Add CRL/i }))
    fireEvent.click(screen.getByRole('button', { name: /Replace CRL/i }))

    // Select and remove via tab chip buttons
    fireEvent.click(screen.getByTitle('sample_revocation_list.crl'))
    fireEvent.click(screen.getByRole('button', { name: /Remove sample_revocation_list\.crl/i }))
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()

    // Helper unit tests for all reason & error branches
    expect(getReasonKey('key_compromise')).toBe('keyCompromise')
    expect(getReasonKey('ca_compromise')).toBe('caCompromise')
    expect(getReasonKey('aa_compromise')).toBe('aaCompromise')
    expect(getReasonKey('some_compromise')).toBe('keyCompromise')
    expect(getReasonKey('cert_superseded')).toBe('superseded')
    expect(getReasonKey('cessation_op')).toBe('cessationOfOperation')
    expect(getReasonKey('affiliation_mod')).toBe('affiliationChanged')
    expect(getReasonKey('on_hold')).toBe('certificateHold')
    expect(getReasonKey('remove_entry')).toBe('removeFromCRL')
    expect(getReasonKey('privilege_lost')).toBe('privilegeWithdrawn')
    expect(getReasonKey('unknown_xyz')).toBe('unspecified')

    expect(formatCrlDate(null)).toBe('N/A')
    expect(formatCrlDate('not-a-valid-date')).toBe('not-a-valid-date')
    expect(getIssuerCN('')).toBe('')
    expect(getIssuerCN('O=OrgOnly Corp, C=US')).toBe('OrgOnly Corp')
    expect(getIssuerCN('DC=local')).toBe('DC=local')

    const mockT = ((_k: string, def?: string) => def ?? _k) as Parameters<
      typeof formatLocalizedCrlError
    >[1]
    const derNoSubj = buildCrlErrorInfo('a.der', new Error('ERR_CERT_DER_NOT_CRL'))
    expect(formatLocalizedCrlError(derNoSubj, mockT)).toContain('DER format')
    const tsErr = buildCrlErrorInfo('b.jks', new Error('ERR_TRUST_STORE_NOT_CRL'))
    expect(tsErr.action?.targetMode).toBe('trust-store')
    expect(formatLocalizedCrlError(tsErr, mockT)).toContain('Trust Store')
    const pemNoCrl = buildCrlErrorInfo('c.pem', new Error('ERR_PEM_NO_CRL'))
    expect(formatLocalizedCrlError(pemNoCrl, mockT)).toContain('BEGIN X509 CRL')
  })

  it('loads Sample DER CRL and Expired CRL presets with distinct tabs and Expired status badge', async () => {
    render(<CrlInspector />)

    const derBtn = screen.getByRole('button', { name: /Sample DER CRL/i })
    fireEvent.click(derBtn)
    await waitFor(() => {
      expect(screen.getAllByText(/Contoso Binary DER Issuing CA/).length).toBeGreaterThanOrEqual(2)
    })
    expect(derBtn).toBeDisabled()

    const expiredBtn = screen.getByRole('button', { name: /Expired CRL/i })
    fireEvent.click(expiredBtn)
    await waitFor(() => {
      expect(screen.getAllByText(/Legacy Root Revocation Authority/).length).toBeGreaterThanOrEqual(
        2,
      )
    })
    expect(expiredBtn).toBeDisabled()
    expect(screen.getAllByText('Expired CRL').length).toBeGreaterThanOrEqual(2)
  })
})
