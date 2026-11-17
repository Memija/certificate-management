import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import forge from 'node-forge'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getSampleCertDerBuffer,
  SAMPLE_MATCHING_CSR_PEM,
  SAMPLE_MATCHING_KEY_PEM,
  SAMPLE_RSA4096_CERT_PEM,
} from '@/data'
import { useAppStore } from '@/store'
import type { TranslateFn } from '@/types'
import { SAMPLE_CRL_PEM } from '@/utils/crl-parser'

import TrustStoreInspectorDefault, { TrustStoreInspector } from './index'
import { getFormatMeta, isSameEntry, localizeTrustStoreWarning } from './trust-store-helpers'
import { TrustStoreEntryDetail } from './TrustStoreEntryDetail'

function buildEncryptedJksBytes(
  alias: string,
  certDerBuffer: ArrayBuffer,
  password: string,
): Uint8Array {
  const certBytes = new Uint8Array(certDerBuffer)
  const key = forge.pki.privateKeyFromPem(SAMPLE_MATCHING_KEY_PEM)
  const pkcs8Asn1 = forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(key))
  const plainKeyDerStr = forge.asn1.toDer(pkcs8Asn1).getBytes()
  const plainKeyBytes = Uint8Array.from(plainKeyDerStr, (c) => c.charCodeAt(0))

  const salt = new Uint8Array(20)
  for (let i = 0; i < 20; i += 1) {
    salt[i] = i + 1
  }

  const passwdBytes = new Uint8Array(password.length * 2)
  for (let i = 0; i < password.length; i += 1) {
    const code = password.charCodeAt(i)
    passwdBytes[i * 2] = code >> 8
    passwdBytes[i * 2 + 1] = code & 0xff
  }
  const passwdByteStr = Array.from(passwdBytes, (b) => String.fromCharCode(b)).join('')

  const numRounds = Math.ceil(plainKeyBytes.length / 20)
  const xorKey = new Uint8Array(numRounds * 20)
  let digest = salt
  for (let r = 0; r < numRounds; r += 1) {
    const md = forge.md.sha1.create()
    md.update(passwdByteStr)
    md.update(Array.from(digest, (b) => String.fromCharCode(b)).join(''))
    const dStr = md.digest().getBytes()
    digest = Uint8Array.from(dStr, (c) => c.charCodeAt(0))
    xorKey.set(digest, r * 20)
  }

  const encrKey = new Uint8Array(plainKeyBytes.length)
  for (let i = 0; i < plainKeyBytes.length; i += 1) {
    encrKey[i] = plainKeyBytes[i] ^ xorKey[i]
  }

  const finalMd = forge.md.sha1.create()
  finalMd.update(passwdByteStr)
  finalMd.update(plainKeyDerStr)
  const checkBytes = Uint8Array.from(finalMd.digest().getBytes(), (c) => c.charCodeAt(0))

  const protectedPayload = new Uint8Array(20 + encrKey.length + 20)
  protectedPayload.set(salt, 0)
  protectedPayload.set(encrKey, 20)
  protectedPayload.set(checkBytes, 20 + encrKey.length)

  const protectedStr = Array.from(protectedPayload, (b) => String.fromCharCode(b)).join('')
  const epkiAsn1 = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.OID,
        false,
        forge.asn1.oidToDer('1.3.6.1.4.1.42.2.17.1.1').getBytes(),
      ),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ''),
    ]),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false, protectedStr),
  ])
  const epkiDer = Uint8Array.from(forge.asn1.toDer(epkiAsn1).getBytes(), (c) => c.charCodeAt(0))

  const aliasBytes = new TextEncoder().encode(alias)
  const certTypeBytes = new TextEncoder().encode('X.509')

  const totalLen =
    12 +
    4 +
    2 +
    aliasBytes.length +
    8 +
    4 +
    epkiDer.length +
    4 +
    2 +
    certTypeBytes.length +
    4 +
    certBytes.length +
    20
  const out = new Uint8Array(totalLen)
  const view = new DataView(out.buffer)
  let offset = 0

  view.setUint32(offset, 0xfeedfeed, false)
  offset += 4
  view.setUint32(offset, 2, false)
  offset += 4
  view.setUint32(offset, 1, false)
  offset += 4

  view.setUint32(offset, 1, false)
  offset += 4
  view.setUint16(offset, aliasBytes.length, false)
  offset += 2
  out.set(aliasBytes, offset)
  offset += aliasBytes.length
  offset += 8 // timestamp

  view.setUint32(offset, epkiDer.length, false)
  offset += 4
  out.set(epkiDer, offset)
  offset += epkiDer.length

  view.setUint32(offset, 1, false)
  offset += 4
  view.setUint16(offset, certTypeBytes.length, false)
  offset += 2
  out.set(certTypeBytes, offset)
  offset += certTypeBytes.length
  view.setUint32(offset, certBytes.length, false)
  offset += 4
  out.set(certBytes, offset)

  return out
}

describe('TrustStoreInspector', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-truststore-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  })

  it('exports both named and default component and renders accessible header and controls', () => {
    expect(TrustStoreInspectorDefault).toBe(TrustStoreInspector)
    const { container } = render(<TrustStoreInspector />)

    expect(
      screen.getByRole('heading', { level: 1, name: /Trust Store & Keystore Inspector/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('In-Memory Parsing')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Drop certificate files here/i })).toBeInTheDocument()

    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      expect(button).toHaveAttribute('type', 'button')
    }
  })

  it('loads PEM Bundle and DER sample presets, switches entries, filters sidebar, and clears all', async () => {
    render(<TrustStoreInspector />)

    const pemBundleBtn = screen.getByRole('button', { name: /PEM Bundle/i })
    fireEvent.click(pemBundleBtn)

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Loaded Files \(1\)/i }),
      ).toBeInTheDocument()
    })

    expect(
      screen.getByRole('heading', { level: 3, name: 'matcher.example.com' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/2 certs/i)).toBeInTheDocument()

    // Clicking same sample preset again keeps count at 1
    fireEvent.click(pemBundleBtn)
    expect(
      screen.getByRole('heading', { level: 2, name: /Loaded Files \(1\)/i }),
    ).toBeInTheDocument()

    // Select second entry in sidebar
    const secondCertBtn = screen.getByRole('button', { name: /vault\.internal\.sec/i })
    fireEvent.click(secondCertBtn)
    expect(
      screen.getByRole('heading', { level: 3, name: 'vault.internal.sec' }),
    ).toBeInTheDocument()

    // Filter sidebar entries
    const searchInput = screen.getByPlaceholderText(/Filter by subject, issuer, or thumbprint/i)
    fireEvent.change(searchInput, { target: { value: 'nonexistent-xyz' } })
    expect(screen.getByText(/No certificates match your filter/i)).toBeInTheDocument()

    // Clear search button restores list
    const clearSearchBtn = screen.getByRole('button', { name: 'Clear' })
    fireEvent.click(clearSearchBtn)
    expect(screen.getByRole('button', { name: /matcher\.example\.com/i })).toBeInTheDocument()

    // Load DER preset too and switch tabs
    fireEvent.click(screen.getByRole('button', { name: /DER Certificate/i }))
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Loaded Files \(2\)/i }),
      ).toBeInTheDocument()
    })
    expect(screen.getByText(/1 cert$/i)).toBeInTheDocument()

    // Switch back to first tab and remove active first tab
    fireEvent.click(screen.getByRole('button', { name: 'sample_trust_bundle.pem' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove sample_trust_bundle.pem' })[0])
    expect(
      screen.getByRole('heading', { level: 2, name: /Loaded Files \(1\)/i }),
    ).toBeInTheDocument()

    // Clear all files
    fireEvent.click(screen.getByRole('button', { name: /Clear All/i }))
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
  })

  it('prompts for PKCS#12 password, validates empty/wrong password, unlocks, and exports private key', async () => {
    render(<TrustStoreInspector />)

    fireEvent.click(screen.getByRole('button', { name: /PKCS#12 \/ PFX/i }))

    const passwordInput = await screen.findByPlaceholderText(/Enter keystore password/i)
    expect(screen.getByText('export123')).toBeInTheDocument()

    // Toggle password visibility
    const showPwdBtn = screen.getByRole('button', { name: /Show password/i })
    fireEvent.click(showPwdBtn)
    expect(passwordInput).toHaveAttribute('type', 'text')
    fireEvent.click(screen.getByRole('button', { name: /Hide password/i }))
    expect(passwordInput).toHaveAttribute('type', 'password')

    // Blur empty shows required error
    fireEvent.blur(passwordInput)
    expect(screen.getByText(/This PKCS#12 file requires a password/i)).toBeInTheDocument()

    // Wrong password via Enter key
    fireEvent.change(passwordInput, { target: { value: 'wrong-pass' } })
    fireEvent.keyDown(passwordInput, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText(/Incorrect password/i)).toBeInTheDocument()
    })

    // Unlock with valid password
    fireEvent.change(passwordInput, { target: { value: 'export123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 3, name: 'matcher.example.com' }),
      ).toBeInTheDocument()
    })

    expect(screen.getByText(/This file contains 1 private key/i)).toBeInTheDocument()

    // View / Hide Private Key
    const viewKeyBtn = screen.getByRole('button', { name: /View Private Key/i })
    fireEvent.click(viewKeyBtn)
    expect(screen.getByText(/BEGIN RSA PRIVATE KEY/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Hide Private Key/i }))
    expect(screen.queryByText(/BEGIN RSA PRIVATE KEY/)).not.toBeInTheDocument()

    // Download .key and Copy private key
    fireEvent.click(screen.getByRole('button', { name: /Download \.key/i }))
    expect(URL.createObjectURL).toHaveBeenCalled()

    const copyBtns = screen.getAllByRole('button', { name: /^Copy$/i })
    fireEvent.click(copyBtns[0])
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('BEGIN RSA PRIVATE KEY'),
      )
    })
  })

  it('unlocks encrypted JKS private keys and handles wrong JKS password', async () => {
    render(<TrustStoreInspector />)

    const jksBytes = buildEncryptedJksBytes('jks-server-key', getSampleCertDerBuffer(), 'changeit')
    const jksFile = new File([jksBytes.buffer as ArrayBuffer], 'keystore.jks', {
      type: 'application/octet-stream',
    })

    const fileInput = screen.getByLabelText(/Drop certificate files here/i)
    fireEvent.change(fileInput, { target: { files: [jksFile] } })

    await waitFor(() => {
      expect(screen.getByText(/Unlock Private Keys/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/JKS MAC verification skipped/i)).toBeInTheDocument()

    const pwdInput = screen.getByPlaceholderText(/Enter keystore password/i)
    fireEvent.change(pwdInput, { target: { value: 'bad-jks-pwd' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(screen.getByText(/Incorrect password/i)).toBeInTheDocument()

    fireEvent.change(pwdInput, { target: { value: 'changeit' } })
    fireEvent.keyDown(pwdInput, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /View Private Key/i })).toBeInTheDocument()
    })
  })

  it('handles PKCS#7, CRL, CSR, Private Key, and invalid files via dropzone and navigation', async () => {
    const onNavigate = vi.fn()
    render(<TrustStoreInspector onNavigate={onNavigate} />)

    const dropZone = screen
      .getByRole('button', { name: /Drop certificate files here/i })
      .closest('.drop-zone')!

    // Drag enter/leave and drop CRL file
    fireEvent.dragOver(dropZone)
    expect(dropZone.className).toContain('active')
    fireEvent.dragLeave(dropZone)

    const crlFile = new File([SAMPLE_CRL_PEM], 'revoked.crl', { type: 'application/pkix-crl' })
    fireEvent.drop(dropZone, { dataTransfer: { files: [crlFile] } })

    await waitFor(() => {
      expect(screen.getByText(/Certificate Revocation List Detected/i)).toBeInTheDocument()
    })

    const openCrlBtns = screen.getAllByRole('button', { name: /Open in CRL Inspector/i })
    fireEvent.click(openCrlBtns[0])
    expect(onNavigate).toHaveBeenCalledWith('crl-inspector')

    // Upload CSR file and navigate via store fallback when rendered standalone
    const csrFile = new File([SAMPLE_MATCHING_CSR_PEM], 'req.csr', { type: 'text/plain' })
    const pkcs7Obj = forge.pkcs7.createSignedData()
    pkcs7Obj.addCertificate(forge.pki.certificateFromPem(SAMPLE_RSA4096_CERT_PEM))
    const p7Pem = forge.pkcs7.messageToPem(pkcs7Obj)
    const p7File = new File([p7Pem], 'chain.p7b', { type: 'application/x-pkcs7-certificates' })

    const fileInput = screen.getByLabelText(/Drop certificate files here/i)
    fireEvent.change(fileInput, { target: { files: [csrFile, p7File] } })

    await waitFor(() => {
      expect(screen.getByText(/PKCS#7 Chain/i)).toBeInTheDocument()
    })

    // Switch to CSR tab and test navigation
    fireEvent.click(screen.getByRole('button', { name: 'req.csr' }))
    fireEvent.click(screen.getByRole('button', { name: /Open in CSR Inspector/i }))
    expect(onNavigate).toHaveBeenCalledWith('csr-inspector')
  })

  it('falls back to useAppStore.setMode when onNavigate prop is omitted', async () => {
    render(<TrustStoreInspector />)
    const crlFile = new File([SAMPLE_CRL_PEM], 'test.crl', { type: 'text/plain' })
    const fileInput = screen.getByLabelText(/Drop certificate files here/i)
    fireEvent.change(fileInput, { target: { files: [crlFile] } })

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /Open in CRL Inspector/i }).length,
      ).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByRole('button', { name: /Open in CRL Inspector/i })[0])
    expect(useAppStore.getState().mode).toBe('crl-inspector')
  })

  it('covers helper edge cases and empty entry detail state', () => {
    render(<TrustStoreEntryDetail entry={null} />)
    expect(screen.getByText(/Select a certificate from the list/i)).toBeInTheDocument()

    const mockT: TranslateFn = ((_key: string, fallback?: string) =>
      fallback ?? _key) as TranslateFn
    expect(localizeTrustStoreWarning('ERR_PRIVATE_KEY_FILE', 'Unknown', mockT).text).toContain(
      'Private Key',
    )
    expect(localizeTrustStoreWarning('ERR_COULD_NOT_PARSE_PEM', 'Unknown', mockT).text).toContain(
      'Could not parse PEM',
    )
    expect(localizeTrustStoreWarning('ERR_COULD_NOT_PARSE_DER', 'Unknown', mockT).text).toContain(
      'Could not parse this DER',
    )
    expect(localizeTrustStoreWarning('ERR_UNRECOGNIZED_FORMAT', 'Unknown', mockT).text).toContain(
      'Unrecognized file format',
    )
    expect(localizeTrustStoreWarning('Custom warning', 'Unknown', mockT).text).toBe(
      'Custom warning',
    )
    expect(isSameEntry(null, null)).toBe(false)
    expect(getFormatMeta('X509-PEM').tone).toBe('info')
    expect(within(document.body).queryByText('Select a certificate from the list')).toBeTruthy()
  })
})
