import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SAMPLE_MATCHING_CERT_PEM, SAMPLE_MATCHING_CSR_PEM, SAMPLE_MATCHING_KEY_PEM } from '@/data'
import { useAppStore, useToastStore } from '@/store'

import CsrInspectorDefault, { CsrEditorModal, CsrInspector } from './index'

const SAMPLE_CRL_PEM = `-----BEGIN X509 CRL-----
MIIBpzCBkAIBATANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDEwlUZXN0IENSTCAX
DTI2MDEwMTAwMDAwMFoXDTI3MDEwMTAwMDAwMFowNDAyAgEBFw0yNjAxMDEwMDAw
MDBaMBowGAYDVR0VBBEwD4INZXhhbXBsZS5jb20wDQYJKoZIhvcNAQELBQADggEB
AA==
-----END X509 CRL-----`

describe('CsrInspector', () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    writeTextMock.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-csr-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('renders ModuleHeader h1 without literal <0> tags and maintains sequential headings', () => {
    expect(CsrInspectorDefault).toBe(CsrInspector)
    expect(CsrEditorModal).toBeDefined()
    const { container } = render(<CsrInspector />)

    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('Certificate Signing Request (CSR) Inspector')
    expect(h1.textContent).not.toContain('<0>')

    const h2 = screen.getByRole('heading', { level: 2, name: /Drop CSR files here/i })
    expect(h2).toBeInTheDocument()

    const buttons = container.querySelectorAll('button')
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute('type', 'button')
    })
  })

  it('loads the sample CSR, displays cryptographic details, copies fingerprint, toggles PEM, and downloads files', async () => {
    render(<CsrInspector />)

    const sampleBtn = screen.getByRole('button', { name: /Try Sample CSR/i })
    expect(sampleBtn).toBeEnabled()
    fireEvent.click(sampleBtn)

    expect(await screen.findByText(/Loaded Files/i)).toBeInTheDocument()
    expect(sampleBtn).toBeDisabled()
    expect(screen.getByText('Self-Signature Valid')).toBeInTheDocument()
    expect(screen.getAllByText('example.com').length).toBeGreaterThan(0)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText(/RSA \(2048 bits\)/i)).toBeInTheDocument()

    const copyBtn = screen.getByRole('button', { name: /Copy to clipboard/i })
    fireEvent.click(copyBtn)
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1)
    })

    const viewPemBtn = screen.getByRole('button', { name: /View PEM/i })
    fireEvent.click(viewPemBtn)
    expect(screen.getByText(/-----BEGIN CERTIFICATE REQUEST-----/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Hide PEM/i }))
    expect(screen.queryByText(/-----BEGIN CERTIFICATE REQUEST-----/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Download \.csr/i }))
    fireEvent.click(screen.getByRole('button', { name: /Download \.der/i }))
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
  })

  it('loads Multi-SAN DER CSR and Invalid Signature CSR sample presets', async () => {
    render(<CsrInspector />)

    const derBtn = screen.getByRole('button', { name: /Multi-SAN DER CSR/i })
    fireEvent.click(derBtn)
    expect(await screen.findByText('Cloud Edge Security Ltd')).toBeInTheDocument()
    expect(derBtn).toBeDisabled()
    expect(screen.getByText('Self-Signature Valid')).toBeInTheDocument()
    expect(screen.getByText(/Requested Extensions/i)).toBeInTheDocument()

    const badSigBtn = screen.getByRole('button', { name: /Invalid Signature CSR/i })
    fireEvent.click(badSigBtn)
    expect(await screen.findByText('Security Audit Lab')).toBeInTheDocument()
    expect(badSigBtn).toBeDisabled()
    expect(screen.getByText('Self-Signature Invalid')).toBeInTheDocument()
  })

  it('uploads CSR files with extensions, supports drag-and-drop, deduplicates, switches tabs, collapses, and clears all', async () => {
    render(<CsrInspector />)

    const dropInput = screen.getByLabelText(/Drop CSR files here/i) as HTMLInputElement
    const csrFile = new File([SAMPLE_MATCHING_CSR_PEM], 'matcher.csr', {
      type: 'application/pkcs10',
    })

    fireEvent.change(dropInput, { target: { files: [csrFile] } })

    expect(await screen.findByText('Key Matcher Corp')).toBeInTheDocument()
    expect(screen.getByText(/Requested Extensions/i)).toBeInTheDocument()

    const extToggle = screen.getByRole('button', { name: /Requested Extensions/i })
    fireEvent.click(extToggle)
    expect(extToggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(extToggle)
    expect(extToggle).toHaveAttribute('aria-expanded', 'true')

    // Load sample CSR via button so there are 2 tabs
    fireEvent.click(screen.getByRole('button', { name: /Try Sample CSR/i }))
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument()

    // Re-uploading duplicate file focuses existing tab instead of duplicating
    const addInput = screen.getAllByLabelText(/Add CSR/i)[0] as HTMLInputElement
    fireEvent.change(addInput, { target: { files: [csrFile] } })
    expect(await screen.findByText('Key Matcher Corp')).toBeInTheDocument()

    // Drag and drop an unsupported file (ignored) and a valid file
    const dropZone = screen
      .getByRole('heading', { level: 2, name: /Drop CSR files here/i })
      .closest('.drop-zone')!
    fireEvent.dragOver(dropZone)
    fireEvent.dragLeave(dropZone)
    const badExtFile = new File(['noop'], 'readme.exe', { type: 'application/octet-stream' })
    fireEvent.drop(dropZone, { dataTransfer: { files: [badExtFile] } })

    // Collapse and expand card header
    const cardToggle = screen.getByText('matcher.csr').closest('button') as HTMLButtonElement
    fireEvent.click(cardToggle)
    expect(cardToggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(cardToggle)
    expect(cardToggle).toHaveAttribute('aria-expanded', 'true')

    // Remove one tab via tab remove button
    const removeMatcherBtns = screen.getAllByRole('button', { name: /Remove matcher\.csr/i })
    fireEvent.click(removeMatcherBtns[0]!)
    expect(screen.queryByText('Key Matcher Corp')).not.toBeInTheDocument()

    // Clear all
    fireEvent.click(screen.getByRole('button', { name: /Clear All/i }))
    expect(screen.queryByText(/Loaded Files/i)).not.toBeInTheDocument()
  })

  it('handles non-CSR files (X.509 cert, CRL, private key, invalid format) and navigates via callback or store fallback', async () => {
    const onNavigate = vi.fn()
    const { unmount } = render(<CsrInspector onNavigate={onNavigate} />)

    const dropInput = screen.getByLabelText(/Drop CSR files here/i) as HTMLInputElement
    const certFile = new File([SAMPLE_MATCHING_CERT_PEM], 'server.crt', {
      type: 'application/x-x509-ca-cert',
    })
    fireEvent.change(dropInput, { target: { files: [certFile] } })

    const trustStoreBtn = await screen.findByRole('button', {
      name: /Open in Trust Store Inspector/i,
    })
    fireEvent.click(trustStoreBtn)
    expect(onNavigate).toHaveBeenCalledWith('trust-store')

    unmount()

    // Now test Zustand store fallback when onNavigate prop is omitted
    render(<CsrInspector />)
    const dropInput2 = screen.getByLabelText(/Drop CSR files here/i) as HTMLInputElement

    const crlFile = new File([SAMPLE_CRL_PEM], 'revoked.crl', { type: 'text/plain' })
    const keyFile = new File([SAMPLE_MATCHING_KEY_PEM], 'private.pem', { type: 'text/plain' })
    const corruptFile = new File(['not-a-valid-csr-at-all'], 'corrupt.csr', { type: 'text/plain' })

    fireEvent.change(dropInput2, { target: { files: [crlFile] } })
    const crlBtn = await screen.findByRole('button', { name: /Open in CRL Inspector/i })
    fireEvent.click(crlBtn)
    expect(useAppStore.getState().mode).toBe('crl-inspector')

    fireEvent.change(dropInput2, { target: { files: [keyFile] } })
    expect(await screen.findByText(/contains a Private Key/i)).toBeInTheDocument()

    fireEvent.change(dropInput2, { target: { files: [corruptFile] } })
    expect(
      await screen.findByText(/not a valid PEM or DER Certificate Signing Request/i),
    ).toBeInTheDocument()
  })

  it('validates fields and re-signs CSR in CsrEditorModal using both existing key and generated key modes', async () => {
    render(<CsrInspector />)
    fireEvent.click(screen.getByRole('button', { name: /Try Sample CSR/i }))

    const editBtn = await screen.findByRole('button', { name: /Edit CSR/i })
    fireEvent.click(editBtn)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: /Edit & Re-sign CSR/i }),
    ).toBeInTheDocument()

    // Escape closes modal
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Re-open modal
    fireEvent.click(screen.getByRole('button', { name: /Edit CSR/i }))

    const cnInput = screen.getByLabelText(/Common Name \(CN\)/i)
    const sansInput = screen.getByLabelText(/Subject Alternative Names \(SANs\)/i)
    const countryInput = screen.getByLabelText(/Country Code \(C\)/i)

    // Clear CN and SANs -> triggers validation error & RFC 2818 SAN warning
    fireEvent.change(cnInput, { target: { value: '' } })
    fireEvent.change(sansInput, { target: { value: '' } })
    expect(screen.getByText(/TLS Server Authentication is selected/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Generate & Re-sign CSR/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Valid subject + SANs + country lookup
    fireEvent.change(cnInput, { target: { value: 'api.acme-pki.internal' } })
    fireEvent.change(screen.getByLabelText(/Organization \(O\)/i), {
      target: { value: 'Acme Security' },
    })
    fireEvent.change(screen.getByLabelText(/Organizational Unit \(OU\)/i), {
      target: { value: 'PKI Ops' },
    })
    fireEvent.change(countryInput, { target: { value: 'de' } })
    expect(screen.getByText('Germany')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/State \/ Province \(ST\)/i), {
      target: { value: 'Bavaria' },
    })
    fireEvent.change(screen.getByLabelText(/City \/ Locality \(L\)/i), {
      target: { value: 'Munich' },
    })
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'pki@acme-pki.internal' },
    })
    fireEvent.change(sansInput, {
      target: {
        value:
          'api.acme-pki.internal, 10.0.0.1, https://acme-pki.internal/ca, pki@acme-pki.internal',
      },
    })

    // Toggle a Key Usage & Extended Key Usage checkbox and upload key file
    fireEvent.click(screen.getByLabelText(/Code Signing/i))
    fireEvent.click(screen.getByLabelText(/Data Encipherment/i))

    // Switch to existing key mode, verify invalid key feedback, then upload/provide valid key
    fireEvent.click(screen.getByLabelText(/Provide Existing Private Key/i))
    const keyFileInput = screen.getByLabelText(/Upload \.key \/ \.pem/i) as HTMLInputElement
    const uploadedKeyFile = new File([SAMPLE_MATCHING_KEY_PEM], 'uploaded.key', {
      type: 'text/plain',
    })
    fireEvent.change(keyFileInput, { target: { files: [uploadedKeyFile] } })

    const keyTextarea = screen.getByLabelText(/Paste Private Key/i)
    fireEvent.change(keyTextarea, { target: { value: 'not-a-pem-key' } })
    expect(screen.getByRole('button', { name: /Generate & Re-sign CSR/i })).toBeDisabled()

    fireEvent.change(keyTextarea, { target: { value: SAMPLE_MATCHING_KEY_PEM } })
    expect(screen.getByText(/Valid 2048-bit RSA private key loaded/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Generate & Re-sign CSR/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(screen.getAllByText('api.acme-pki.internal').length).toBeGreaterThan(0)
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success')).toBe(true)

    // Re-open and test "Generate New Key Pair" mode so generated .key download button appears
    fireEvent.click(screen.getByRole('button', { name: /Edit CSR/i }))
    fireEvent.click(screen.getByRole('button', { name: /Generate & Re-sign CSR/i }))

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /Download \.key/i })).toBeInTheDocument()
      },
      { timeout: 10000 },
    )
    fireEvent.click(screen.getByRole('button', { name: /Download \.key/i }))
    expect(URL.createObjectURL).toHaveBeenCalled()
  })
})
