import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import forge from 'node-forge'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getSampleCertDerBuffer,
  getSampleKeyDerBuffer,
  PEM_DER_PRESETS,
  PFX_PRESETS,
  SAMPLE_MATCHING_CERT_PEM,
  SAMPLE_MATCHING_KEY_PEM,
} from '@/data'
import i18n from '@/i18n'
import { useToastStore } from '@/store'

import {
  buildPfxArchive,
  convertPemDerContent,
  formatFileSize,
  getLocalizedError,
  getLocalizedMessage,
  getLocalizedPemDerPresetName,
  getLocalizedPfxPresetName,
  hasAllowedExtension,
  validateSourceFileBytes,
} from './format-converter-logic'
import FormatConverterDefault, { FormatConverter } from './index'

describe('FormatConverter', () => {
  let createUrlSpy: ReturnType<typeof vi.spyOn>
  let revokeUrlSpy: ReturnType<typeof vi.spyOn>
  let anchorClickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-converted')
    revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exports both named and default FormatConverter and enforces accessible markup with zero inline styles', () => {
    expect(FormatConverterDefault).toBe(FormatConverter)

    const { container } = render(<FormatConverter />)

    // Heading hierarchy: ModuleHeader renders h1, section panel renders h2
    const h1s = container.querySelectorAll('h1')
    const h2s = container.querySelectorAll('h2')
    const h3s = container.querySelectorAll('h3')
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent('Certificate Format Converter & PFX Builder')
    expect(h2s).toHaveLength(1)
    expect(h2s[0]).toHaveTextContent('PEM ↔ DER File Converter')
    expect(h3s).toHaveLength(0)

    // Every button has type="button" and zero elements have inline style
    for (const btn of container.querySelectorAll('button')) {
      expect(btn).toHaveAttribute('type', 'button')
    }
    expect(container.querySelector('[style]')).toBeNull()

    // Accessible labels on form controls
    expect(screen.getByLabelText('Select Source File')).toBeInTheDocument()
    expect(screen.getByLabelText('Content Type')).toBeDisabled()
    expect(screen.getByLabelText('Target Output Format')).toBeDisabled()
    expect(screen.getByRole('button', { name: /Convert & Download/i })).toBeDisabled()
  })

  it('loads all PEM <-> DER presets, converts to DER and PEM, and clears staged file', () => {
    const { container } = render(<FormatConverter />)

    // 1. Cert (PEM -> DER)
    fireEvent.click(screen.getByRole('button', { name: /Cert \(PEM → DER\)/i }))
    expect(screen.getByText('sample_webserver_cert.pem')).toBeInTheDocument()
    expect(screen.getByText('PEM (Text)')).toBeInTheDocument()
    expect(screen.getByText('Auto-detected')).toBeInTheDocument()
    expect(screen.getByText('Auto-selected')).toBeInTheDocument()
    expect(container.querySelector('[style]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Convert & Download/i }))
    expect(createUrlSpy).toHaveBeenCalledTimes(1)
    expect(anchorClickSpy).toHaveBeenCalledTimes(1)
    expect(revokeUrlSpy).toHaveBeenCalledWith('blob:mock-converted')
    expect(screen.getByRole('status')).toHaveTextContent('DER file downloaded!')

    // 2. Cert (DER -> PEM)
    fireEvent.click(screen.getByRole('button', { name: /Cert \(DER → PEM\)/i }))
    expect(screen.getByText('sample_webserver_cert.der')).toBeInTheDocument()
    expect(screen.getByText('DER (Binary)')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Convert & Download/i }))
    expect(createUrlSpy).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('status')).toHaveTextContent('PEM file downloaded!')

    // 3. Key (PEM -> DER)
    fireEvent.click(screen.getByRole('button', { name: /Key \(PEM → DER\)/i }))
    expect(screen.getByText('sample_rsa_key.pem')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Convert & Download/i }))
    expect(createUrlSpy).toHaveBeenCalledTimes(3)

    // 4. Key (DER -> PEM)
    fireEvent.click(screen.getByRole('button', { name: /Key \(DER → PEM\)/i }))
    expect(screen.getByText('sample_rsa_key.der')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Convert & Download/i }))
    expect(createUrlSpy).toHaveBeenCalledTimes(4)

    // Remove file via icon-only button
    fireEvent.click(screen.getByRole('button', { name: 'Remove file' }))
    expect(screen.queryByText('sample_rsa_key.der')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Convert & Download/i })).toBeDisabled()
  })

  it('handles file upload, drag-and-drop, and validation errors for invalid or empty files', async () => {
    const { container } = render(<FormatConverter />)
    const fileInput = screen.getByLabelText('Select Source File') as HTMLInputElement

    // Unsupported extension
    const badExtFile = new File(['hello'], 'archive.exe', { type: 'application/octet-stream' })
    fireEvent.change(fileInput, { target: { files: [badExtFile] } })
    expect(screen.getByRole('alert')).toHaveTextContent(/Unsupported file type/i)

    // Empty file
    const emptyFile = new File([], 'empty.pem', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [emptyFile] } })
    expect(screen.getByRole('alert')).toHaveTextContent('The selected file is empty.')

    // Corrupt PEM content
    const corruptPemFile = new File(
      ['-----BEGIN CERTIFICATE-----\nINVALID\n-----END CERTIFICATE-----'],
      'corrupt.pem',
      { type: 'text/plain' },
    )
    fireEvent.change(fileInput, { target: { files: [corruptPemFile] } })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'File is not a valid PEM or DER certificate or private key.',
      )
    })

    // Valid PEM Certificate via Drag and Drop
    const dropTarget = fileInput.parentElement!
    fireEvent.dragOver(dropTarget)
    expect(container.querySelector('[style]')).toBeNull()
    fireEvent.dragLeave(dropTarget)

    const validCertFile = new File([SAMPLE_MATCHING_CERT_PEM], 'uploaded_cert.crt', {
      type: 'application/x-x509-ca-cert',
    })
    fireEvent.drop(dropTarget, { dataTransfer: { files: [validCertFile] } })

    await waitFor(() => {
      expect(screen.getByText('uploaded_cert.crt')).toBeInTheDocument()
    })

    // Clear via desktop clear button
    const clearButtons = screen.getAllByRole('button', { name: /Clear/i })
    fireEvent.click(clearButtons[0]!)
    expect(screen.queryByText('uploaded_cert.crt')).not.toBeInTheDocument()
  })

  it('switches to PFX Builder mode, loads presets, toggles password visibility, and exports PFX', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(<FormatConverter />)

    fireEvent.click(screen.getByRole('button', { name: /Build PFX \(PKCS#12\)/i }))

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Package PFX Archive')
    expect(container.querySelector('[style]')).toBeNull()
    for (const btn of container.querySelectorAll('button')) {
      expect(btn).toHaveAttribute('type', 'button')
    }

    const certArea = screen.getByLabelText(/Certificate \(PEM\)/i) as HTMLTextAreaElement
    const keyArea = screen.getByLabelText(/Private Key \(PEM\)/i) as HTMLTextAreaElement
    const passwordInput = screen.getByLabelText('PFX Archive Password') as HTMLInputElement
    const downloadBtn = screen.getByRole('button', { name: /Download PFX Archive/i })

    expect(downloadBtn).toBeDisabled()

    // Select RSA 2048 PFX Preset
    fireEvent.click(screen.getByRole('button', { name: /Web Server \(RSA 2048\)/i }))
    expect(certArea.value).toContain('BEGIN CERTIFICATE')
    expect(keyArea.value).toContain('PRIVATE KEY')
    expect(passwordInput.value).toBe('export123')
    expect(passwordInput.type).toBe('password')

    // Toggle password visibility
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(passwordInput.type).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(passwordInput.type).toBe('password')

    // Build and download PFX
    fireEvent.click(downloadBtn)
    expect(createUrlSpy).toHaveBeenCalledTimes(1)
    expect(anchorClickSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('PFX file downloaded!')

    // Select RSA 4096 PFX Preset
    fireEvent.click(screen.getByRole('button', { name: /Enterprise Vault \(RSA 4096\)/i }))
    expect(passwordInput.value).toBe('vault2026')

    // Whitespace-only cert triggers CERT_AND_KEY_REQUIRED
    fireEvent.change(certArea, { target: { value: '   ' } })
    fireEvent.click(downloadBtn)
    expect(screen.getByRole('alert')).toHaveTextContent('Certificate and Private Key are required.')

    // Invalid PEM triggers PFX_FAILED
    fireEvent.change(certArea, { target: { value: 'INVALID_PEM' } })
    fireEvent.click(downloadBtn)
    expect(screen.getByRole('alert')).toHaveTextContent(/PFX generation failed/i)
    expect(useToastStore.getState().toasts.some((item) => item.type === 'error')).toBe(true)

    // Clear resets all PFX inputs
    const clearButtons = screen.getAllByRole('button', { name: /Clear/i })
    fireEvent.click(clearButtons[0]!)
    expect(certArea.value).toBe('')
    expect(keyArea.value).toBe('')
    expect(passwordInput.value).toBe('')
  })

  it('covers pure helper edge cases in format-converter-logic', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')

    expect(hasAllowedExtension('cert.PEM')).toBe(true)
    expect(hasAllowedExtension('key.p8')).toBe(true)
    expect(hasAllowedExtension('notes.txt')).toBe(false)

    // Empty ArrayBuffer
    const emptyRes = validateSourceFileBytes('empty.der', new ArrayBuffer(0))
    expect(emptyRes).toEqual({ ok: false, error: { code: 'EMPTY_FILE' } })

    // Unknown PEM header
    const unknownHeaderBytes = new TextEncoder().encode(
      '-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----',
    )
    expect(validateSourceFileBytes('pub.pem', unknownHeaderBytes.buffer)).toEqual({
      ok: false,
      error: { code: 'INVALID_FORMAT' },
    })

    // Valid PEM key validation & DER validation
    const keyPemBytes = new TextEncoder().encode(SAMPLE_MATCHING_KEY_PEM)
    const validKeyRes = validateSourceFileBytes('key.pem', keyPemBytes.buffer)
    expect(validKeyRes.ok).toBe(true)

    // Fallback PKCS#8-like PRIVATE KEY PEM body
    const fakePkcs8Pem = `-----BEGIN EC PRIVATE KEY-----\n${btoa('dummy-key-bytes')}\n-----END EC PRIVATE KEY-----`
    const fakePkcs8Res = validateSourceFileBytes(
      'ec.key',
      new TextEncoder().encode(fakePkcs8Pem).buffer,
    )
    expect(fakePkcs8Res.ok).toBe(true)

    // Valid DER cert & DER key buffers
    const validDerCertRes = validateSourceFileBytes('cert.der', getSampleCertDerBuffer())
    expect(validDerCertRes).toMatchObject({
      ok: true,
      contentType: 'cert',
      outputFormat: 'pem',
    })

    const validDerKeyRes = validateSourceFileBytes('key.der', getSampleKeyDerBuffer())
    expect(validDerKeyRes).toMatchObject({
      ok: true,
      contentType: 'key',
      outputFormat: 'pem',
    })

    // Generic ASN.1 SEQUENCE fallback in DER
    const genericSeq = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SEQUENCE,
      true,
      [forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, '\x01')],
    )
    const seqDerStr = forge.asn1.toDer(genericSeq).getBytes()
    const seqBytes = new Uint8Array(seqDerStr.length)
    for (let i = 0; i < seqDerStr.length; i += 1) {
      seqBytes[i] = seqDerStr.charCodeAt(i)
    }
    expect(validateSourceFileBytes('my_key.der', seqBytes.buffer)).toMatchObject({
      ok: true,
      contentType: 'key',
    })
    expect(validateSourceFileBytes('my_cert.der', seqBytes.buffer)).toMatchObject({
      ok: true,
      contentType: 'cert',
    })

    // Base64 DER string conversion without PEM header
    const rawB64 = SAMPLE_MATCHING_CERT_PEM.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, '')
    const convertedFromB64 = convertPemDerContent('.der', rawB64, 'cert')
    expect(convertedFromB64.feedbackCode).toBe('DER_DOWNLOADED')
    expect(convertedFromB64.filename).toBe('converted_converted_file.der')

    // Cert without CN falls back to certificate.pfx
    const certObj = forge.pki.certificateFromPem(SAMPLE_MATCHING_CERT_PEM)
    const keyObj = forge.pki.privateKeyFromPem(SAMPLE_MATCHING_KEY_PEM)
    certObj.setSubject([{ name: 'organizationName', value: 'OrgOnly' }])
    certObj.sign(keyObj, forge.md.sha256.create())
    const noCnPem = forge.pki.certificateToPem(certObj)
    const pfxNoCn = buildPfxArchive(noCnPem, SAMPLE_MATCHING_KEY_PEM, 'secret')
    expect(pfxNoCn.filename).toBe('certificate.pfx')

    // Localization fallbacks
    expect(getLocalizedError(null, i18n.t)).toBe('')
    expect(getLocalizedError({ code: 'PASSWORD_REQUIRED' }, i18n.t)).toContain('password')
    expect(getLocalizedError({ code: 'CUSTOM', customMessage: 'Custom err' }, i18n.t)).toBe(
      'Custom err',
    )
    expect(getLocalizedMessage(null, i18n.t)).toBe('')
    expect(getLocalizedMessage({ code: 'CUSTOM', customMessage: 'Custom ok' }, i18n.t)).toBe(
      'Custom ok',
    )
    expect(
      getLocalizedPemDerPresetName(
        { ...PEM_DER_PRESETS[0]!, id: 'custom-id', name: 'Fallback' },
        i18n.t,
      ),
    ).toBe('Fallback')
    expect(
      getLocalizedPfxPresetName(
        { ...PFX_PRESETS[0]!, id: 'custom-id', name: 'PfxFallback' },
        i18n.t,
      ),
    ).toBe('PfxFallback')
  })
})
