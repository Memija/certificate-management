import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import forge from 'node-forge'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/components/shared'
import {
  OCSP_SAMPLE_PRESETS,
  SAMPLE_OFFLINE_SELFSIGNED_PEM,
  SAMPLE_REVOKED_BADSSL_PEM,
  SAMPLE_VALID_DIGICERT_PEM,
  SAMPLE_VALID_GITHUB_PEM,
} from '@/data'
import i18n from '@/i18n'
import { useAppStore } from '@/store'
import type { AppMode, OcspRevocationResult } from '@/types'
import * as apiClient from '@/utils/api-client'
import { WebApiUnavailableError } from '@/utils/api-client'

import OcspCheckerDefault, { OcspChecker } from './index'
import { extractAiaOcspUrl, extractCdpCrlUrl } from './ocsp-asn1'
import {
  detectNonCertInputType,
  getLocalizedPresetMeta,
  isValidX509Der,
  parseOcspCertInput,
  parseUploadedOcspFileBytes,
  validateOcspFileExtension,
  validateOcspPemBeforeCheck,
} from './ocsp-helpers'

function renderOcsp(onNavigate?: (mode: AppMode) => void) {
  return render(
    <ToastProvider>
      <OcspChecker onNavigate={onNavigate} />
    </ToastProvider>,
  )
}

function pemToUint8Der(pem: string): Uint8Array<ArrayBuffer> {
  const b64 = pem
    .replace(/-----BEGIN[^-]+-----/g, '')
    .replace(/-----END[^-]+-----/g, '')
    .replace(/\s+/g, '')
  const bin = forge.util.decode64(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) {
    arr[i] = bin.charCodeAt(i)
  }
  return arr
}

describe('ocsp-helpers & ocsp-asn1', () => {
  it('detects non-certificate PEM inputs (CSR, Private Key, CRL)', () => {
    expect(detectNonCertInputType('')).toBeNull()
    expect(detectNonCertInputType(SAMPLE_VALID_DIGICERT_PEM)).toBeNull()
    expect(
      detectNonCertInputType(
        '-----BEGIN CERTIFICATE REQUEST-----\nAAA\n-----END CERTIFICATE REQUEST-----',
      ),
    ).toBe('csr')
    expect(
      detectNonCertInputType('-----BEGIN RSA PRIVATE KEY-----\nAAA\n-----END RSA PRIVATE KEY-----'),
    ).toBe('key')
    expect(detectNonCertInputType('-----BEGIN X509 CRL-----\nAAA\n-----END X509 CRL-----')).toBe(
      'crl',
    )
  })

  it('validates X.509 DER structures and parses RSA, ECDSA, and offline PEM certificates', () => {
    const digicertDer = forge.util.decode64(
      SAMPLE_VALID_DIGICERT_PEM.replace(/-----BEGIN[^-]+-----/g, '')
        .replace(/-----END[^-]+-----/g, '')
        .replace(/\s+/g, ''),
    )
    expect(isValidX509Der(digicertDer)).toBe(true)
    expect(isValidX509Der('not-der-bytes')).toBe(false)

    // Direct RSA parse without preset
    const rsaParsed = parseOcspCertInput(SAMPLE_VALID_DIGICERT_PEM, null, i18n.t)
    expect(rsaParsed?.subject).toContain('CN=www.digicert.com')
    expect(rsaParsed?.ocspUrl).toBe('http://ocsp.digicert.com')
    expect(rsaParsed?.crlUrl).toBe('http://crl3.digicert.com/DigiCertEVRSACAG2.crl')

    // Direct ECDSA parse without preset (exercises ECC ASN.1 fallback)
    const eccParsed = parseOcspCertInput(SAMPLE_REVOKED_BADSSL_PEM, null, i18n.t)
    expect(eccParsed?.subject).toContain('CN=revoked.badssl.com')
    expect(eccParsed?.ocspUrl).toBeNull()
    expect(eccParsed?.crlUrl).toBe('http://ye2.c.lencr.org/74.crl')

    // Offline self-signed parse without preset
    const offlineParsed = parseOcspCertInput(SAMPLE_OFFLINE_SELFSIGNED_PEM, null, i18n.t)
    expect(offlineParsed?.ocspUrl).toBeNull()
    expect(offlineParsed?.crlUrl).toBeNull()

    // Invalid PEM & non-cert return null
    expect(
      parseOcspCertInput(
        '-----BEGIN CERTIFICATE-----\n@@@\n-----END CERTIFICATE-----',
        null,
        i18n.t,
      ),
    ).toBeNull()
    expect(
      parseOcspCertInput('-----BEGIN CRL-----\nAAA\n-----END CRL-----', null, i18n.t),
    ).toBeNull()

    // Regex URL fallbacks for non-DER string extension values
    expect(extractAiaOcspUrl('OCSP - URI:http://ocsp.example.org/check')).toBe(
      'http://ocsp.example.org/check',
    )
    expect(extractCdpCrlUrl('URI:http://crl.example.org/root.crl')).toBe(
      'http://crl.example.org/root.crl',
    )
    expect(extractAiaOcspUrl(null)).toBeNull()
    expect(extractCdpCrlUrl(null)).toBeNull()
  })

  it('validates file extensions, uploaded PEM/DER bytes, and pre-check inputs', () => {
    expect(validateOcspFileExtension('server.cer', i18n.t)).toBeNull()
    expect(validateOcspFileExtension('config.json', i18n.t)).toContain('JSON')
    expect(validateOcspFileExtension('req.csr', i18n.t)).toContain('CSR')
    expect(validateOcspFileExtension('priv.key', i18n.t)).toContain('Private Key')
    expect(validateOcspFileExtension('revoked.crl', i18n.t)).toContain('CRL')
    expect(validateOcspFileExtension('notes.txt', i18n.t)).toContain('Unsupported file type')

    const encoder = new TextEncoder()
    expect(
      parseUploadedOcspFileBytes(encoder.encode(SAMPLE_VALID_GITHUB_PEM), i18n.t).pem,
    ).toContain('BEGIN CERTIFICATE')
    const derBytes = pemToUint8Der(SAMPLE_VALID_GITHUB_PEM)
    expect(parseUploadedOcspFileBytes(derBytes, i18n.t).pem).toContain('BEGIN CERTIFICATE')
    expect(parseUploadedOcspFileBytes(encoder.encode('{"a":1}'), i18n.t).error).toContain('JSON')
    expect(
      parseUploadedOcspFileBytes(
        encoder.encode('-----BEGIN CERTIFICATE-----\nINVALID\n-----END CERTIFICATE-----'),
        i18n.t,
      ).error,
    ).toContain('Invalid PEM')
    expect(parseUploadedOcspFileBytes(new Uint8Array([0x01, 0x02, 0x03]), i18n.t).error).toContain(
      'Could not parse',
    )

    expect(validateOcspPemBeforeCheck('', i18n.t).error).toContain('Please provide')
    expect(validateOcspPemBeforeCheck('[1,2]', i18n.t).error).toContain('JSON')
    expect(validateOcspPemBeforeCheck('plain-text', i18n.t).error).toContain('BEGIN CERTIFICATE')
    expect(
      validateOcspPemBeforeCheck(
        '-----BEGIN CERTIFICATE-----\nBAD_BASE64\n-----END CERTIFICATE-----',
        i18n.t,
      ).error,
    ).toContain('Invalid PEM')
    expect(validateOcspPemBeforeCheck(SAMPLE_VALID_DIGICERT_PEM, i18n.t).certB64).toBeTruthy()

    const customPreset = { ...OCSP_SAMPLE_PRESETS[0], id: 'custom-unknown' }
    expect(getLocalizedPresetMeta(customPreset, i18n.t).name).toBe(customPreset.name)
  })
})

describe('OcspChecker component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('exports named and default component and renders accessible header, presets, and inputs', () => {
    expect(OcspCheckerDefault).toBe(OcspChecker)
    renderOcsp()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Online Revocation Checker' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Certificate (PEM / DER)')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Revoked Certificate \(BadSSL\)/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Check Revocation Status/i })).toBeDisabled()
  })

  it('selects presets, verifies revocation via client-side fallback, and maintains h1 -> h2 -> h3 hierarchy', async () => {
    vi.spyOn(apiClient, 'fetchLocalApiJson').mockRejectedValue(new WebApiUnavailableError())

    renderOcsp()

    // 1. Revoked preset
    fireEvent.click(screen.getByRole('button', { name: /Revoked Certificate \(BadSSL\)/i }))
    expect(screen.getByText('CN=revoked.badssl.com')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Verify This Example/i }))

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Certificate is Revoked' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Matches Expected Preset Verdict/i)).toBeInTheDocument()

    // Check strict sequential heading levels (h1 -> h2 -> h3)
    const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName.slice(1)))
    expect(levels).toEqual([1, 2, 3, 3])

    // Clear Result button re-enables verification
    fireEvent.click(screen.getByRole('button', { name: /Clear Result/i }))
    expect(screen.queryByRole('heading', { level: 2, name: 'Certificate is Revoked' })).toBeNull()

    // 2. Valid DigiCert preset
    fireEvent.click(screen.getByRole('button', { name: /DigiCert EV RSA/i }))
    fireEvent.click(screen.getByRole('button', { name: /Check Revocation Status/i }))
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Certificate is Valid (Not Revoked)',
      }),
    ).toBeInTheDocument()

    // 3. Offline Self-Signed preset
    fireEvent.click(screen.getByRole('button', { name: /Internal \/ Self-Signed/i }))
    fireEvent.click(screen.getByRole('button', { name: /Check Revocation Status/i }))
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Revocation Status Unknown / Offline',
      }),
    ).toBeInTheDocument()

    // Clear all inputs
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear' })[0])
    expect(screen.getByLabelText('Certificate (PEM / DER)')).toHaveValue('')
  })

  it('handles local API POST responses, diagnostic log viewer, copy, new-tab open, and API errors', async () => {
    const apiResponse: OcspRevocationResult = {
      status: 'unknown',
      output: 'CertUtil: -verify command completed.\n<tag>&test</tag>',
      ocspVerified: false,
      crlVerified: false,
      ocspUrl: 'http://ocsp.digicert.com',
      crlUrl: 'http://crl3.digicert.com/DigiCertEVRSACAG2.crl',
    }
    vi.spyOn(apiClient, 'fetchLocalApiJson')
      .mockResolvedValueOnce({ data: apiResponse })
      .mockRejectedValueOnce(new Error('Backend certutil process failed'))

    const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:diagnostic-html')
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    renderOcsp()

    fireEvent.click(screen.getByRole('button', { name: /DigiCert EV RSA/i }))
    fireEvent.click(screen.getByRole('button', { name: /Check Revocation Status/i }))

    expect(await screen.findByText(/Differs from Expected Preset/i)).toBeInTheDocument()
    expect(screen.getAllByText('Endpoint Present')).toHaveLength(2)

    // Toggle diagnostic output, copy, and open in new tab
    const logToggle = screen.getByRole('button', {
      name: /View Raw Native Diagnostic Output/i,
    })
    expect(logToggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(logToggle)
    expect(logToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/CertUtil: -verify command completed/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(apiResponse.output)
    })

    fireEvent.click(screen.getByRole('button', { name: /Open in New Tab/i }))
    expect(createUrlSpy).toHaveBeenCalled()
    expect(openSpy).toHaveBeenCalledWith('blob:diagnostic-html', '_blank', 'noopener,noreferrer')

    // Dismiss result and trigger API error
    fireEvent.click(screen.getByRole('button', { name: /Clear Result/i }))
    fireEvent.click(screen.getByRole('button', { name: /Check Revocation Status/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Backend certutil process failed')
  })

  it('detects CSR/CRL/Private Key inputs and navigates via useAppStore fallback or onNavigate prop', () => {
    // 1. Without onNavigate prop -> falls back to useAppStore.setMode
    const { unmount } = renderOcsp()
    const textarea = screen.getByLabelText('Certificate (PEM / DER)')

    fireEvent.change(textarea, {
      target: {
        value: '-----BEGIN CERTIFICATE REQUEST-----\nMIIB...\n-----END CERTIFICATE REQUEST-----',
      },
    })
    expect(screen.getByText('Certificate Signing Request (CSR) Detected')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open in CSR Inspector' }))
    expect(useAppStore.getState().mode).toBe('csr-inspector')
    unmount()

    // 2. With explicit onNavigate prop for CRL and Private Key
    const onNavigate = vi.fn()
    renderOcsp(onNavigate)
    const textarea2 = screen.getByLabelText('Certificate (PEM / DER)')

    fireEvent.change(textarea2, {
      target: { value: '-----BEGIN X509 CRL-----\nMIIB...\n-----END X509 CRL-----' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open in CRL Inspector' }))
    expect(onNavigate).toHaveBeenCalledWith('crl-inspector')

    fireEvent.change(textarea2, {
      target: { value: '-----BEGIN PRIVATE KEY-----\nMIIB...\n-----END PRIVATE KEY-----' },
    })
    expect(screen.getByText('Private Key Detected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Check Revocation Status/i })).toBeDisabled()
  })

  it('supports binary DER certificate file upload and rejects unsupported file types', async () => {
    renderOcsp()
    const fileInput = document.getElementById('ocsp-file-upload') as HTMLInputElement

    const derBytes = pemToUint8Der(SAMPLE_VALID_GITHUB_PEM)
    const validDerFile = new File([derBytes], 'github.der', {
      type: 'application/x-x509-ca-cert',
    })
    fireEvent.change(fileInput, { target: { files: [validDerFile] } })

    await waitFor(() => {
      expect(
        (screen.getByLabelText('Certificate (PEM / DER)') as HTMLTextAreaElement).value,
      ).toContain('-----BEGIN CERTIFICATE-----')
    })

    const badJsonFile = new File(['{"hello":"world"}'], 'bad.json', { type: 'application/json' })
    fireEvent.change(fileInput, { target: { files: [badJsonFile] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('JSON')
  })
})
