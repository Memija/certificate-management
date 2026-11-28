import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import forge from 'node-forge'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAppStore } from '@/store'
import type { ParsedCertificate } from '@/types'
import { createCryptographicChain } from '@/utils/sample-chain-generator'
import { parsePemToCerts } from '@/utils/trust-store-parser'

import {
  buildChains,
  computeChainSummary,
  doesAkiMatchSki,
  extractAkiHex,
  extractSkiHex,
  formatKeyIdentifier,
  getNodeRole,
  getSubjectCN,
  isCertExpired,
  parseForgeCertSafe,
  verifySignature,
} from './chain-validator-logic'
import ChainValidatorDefault, { ChainValidator } from './index'

function createRfc5280AkiSkiChainPems(): { rootPem: string; interPem: string } {
  const rootKeys = forge.pki.rsa.generateKeyPair(1024)
  const rootCert = forge.pki.createCertificate()
  rootCert.publicKey = rootKeys.publicKey
  rootCert.serialNumber = '01020304'
  rootCert.validity.notBefore = new Date(Date.now() - 86_400_000)
  rootCert.validity.notAfter = new Date(Date.now() + 86_400_000 * 365)
  const rootAttrs = [{ name: 'commonName', value: 'RFC5280 Root CA' }]
  rootCert.setSubject(rootAttrs)
  rootCert.setIssuer(rootAttrs)
  rootCert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'subjectKeyIdentifier' },
  ])
  rootCert.sign(rootKeys.privateKey, forge.md.sha256.create())

  const interKeys = forge.pki.rsa.generateKeyPair(1024)
  const interCert = forge.pki.createCertificate()
  interCert.publicKey = interKeys.publicKey
  interCert.serialNumber = '05060708'
  interCert.validity.notBefore = new Date(Date.now() - 86_400_000)
  interCert.validity.notAfter = new Date(Date.now() + 86_400_000 * 180)
  interCert.setSubject([{ name: 'commonName', value: 'RFC5280 Issuing CA' }])
  interCert.setIssuer(rootAttrs)
  interCert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'subjectKeyIdentifier' },
    { name: 'authorityKeyIdentifier', keyIdentifier: true },
  ])
  // Populate AKI from issuer's SKI bytes properly per RFC 5280
  const rootSkiBytes = rootCert.generateSubjectKeyIdentifier().getBytes()
  interCert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'subjectKeyIdentifier' },
    { name: 'authorityKeyIdentifier', keyIdentifier: rootSkiBytes },
  ])
  interCert.sign(rootKeys.privateKey, forge.md.sha256.create())

  return {
    rootPem: forge.pki.certificateToPem(rootCert),
    interPem: forge.pki.certificateToPem(interCert),
  }
}

function createPasswordProtectedPfxFile(certPem: string, password: string): File {
  const forgeCert = forge.pki.certificateFromPem(certPem)
  const keys = forge.pki.rsa.generateKeyPair(1024)
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [forgeCert], password, {
    algorithm: '3des',
  })
  const derStr = forge.asn1.toDer(p12Asn1).getBytes()
  const bytes = new Uint8Array(derStr.length)
  for (let i = 0; i < derStr.length; i += 1) {
    bytes[i] = derStr.charCodeAt(i)
  }
  return new File([bytes], 'protected-bundle.pfx', { type: 'application/x-pkcs12' })
}

describe('chain-validator-logic pure helpers', () => {
  it('parses certificates, verifies signatures, and extracts RFC 5280 SKI/AKI identifiers', () => {
    const { rootPem, interPem } = createRfc5280AkiSkiChainPems()
    const parsedPair = parsePemToCerts(`${rootPem}\n${interPem}`)
    expect(parsedPair).toHaveLength(2)

    const rootCert = parsedPair[0]!
    const interCert = parsedPair[1]!

    expect(parseForgeCertSafe('')).toBeNull()
    expect(parseForgeCertSafe('not-a-pem')).toBeNull()
    expect(verifySignature(interCert.pem, rootCert.pem)).toBe(true)
    expect(verifySignature(rootCert.pem, interCert.pem)).toBe(false)
    expect(verifySignature('bad', rootCert.pem)).toBe(false)

    const rootForge = parseForgeCertSafe(rootCert.pem)
    const interForge = parseForgeCertSafe(interCert.pem)
    const rootSki = extractSkiHex(rootForge, rootCert)
    const interAki = extractAkiHex(interForge, interCert)

    expect(rootSki).toHaveLength(40)
    expect(interAki).toBe(rootSki)
    expect(doesAkiMatchSki(interAki, rootSki)).toBe(true)
    expect(doesAkiMatchSki(interAki, '00112233445566778899AABBCCDDEEFF00112233')).toBe(false)
    expect(doesAkiMatchSki(null, rootSki)).toBeNull()
    expect(formatKeyIdentifier('aabbcc')).toBe('AA:BB:CC')

    // Fallback extension hex extraction when forgeCert is null
    expect(extractSkiHex(null, rootCert)).toBe(rootSki)
    expect(extractAkiHex(null, interCert)).toBe(interAki)
  })

  it('handles subject CN fallbacks, roles, expiry, and bad signature fallback linking', () => {
    expect(getSubjectCN('CN=api.example.com, O=Example')).toBe('api.example.com')
    expect(getSubjectCN('O=Fallback Org, C=US')).toBe('Fallback Org')
    expect(getSubjectCN('SERIALNUMBER=1234')).toBe('SERIALNUMBER=1234')

    expect(isCertExpired('2020-01-01T00:00:00.000Z', new Date('2025-01-01T00:00:00.000Z'))).toBe(
      true,
    )
    expect(isCertExpired('2030-01-01T00:00:00.000Z', new Date('2025-01-01T00:00:00.000Z'))).toBe(
      false,
    )

    const sample = createCryptographicChain('3-tier-web')
    const graph = buildChains(sample)
    expect(graph.rootNodes).toHaveLength(1)
    expect(graph.orphanNodes).toHaveLength(0)
    expect(getNodeRole(graph.rootNodes[0]!)).toBe('root')
    expect(getNodeRole(graph.rootNodes[0]!.children[0]!)).toBe('intermediate')
    expect(getNodeRole(graph.rootNodes[0]!.children[0]!.children[0]!)).toBe('leaf')

    const validSummary = computeChainSummary(sample, graph)
    expect(validSummary.isComplete).toBe(true)
    expect(validSummary.hasSignatureMismatch).toBe(false)

    // Simulate tampered PEM where DN matches parent but cryptographic verification fails
    const tamperedLeaf: ParsedCertificate = {
      ...sample[2]!,
      pem: sample[0]!.pem,
      isRoot: false,
    }
    const mismatchPool = [sample[0]!, sample[1]!, tamperedLeaf]
    const mismatchGraph = buildChains(mismatchPool)
    const mismatchSummary = computeChainSummary(mismatchPool, mismatchGraph)
    expect(mismatchSummary.hasSignatureMismatch).toBe(true)
    expect(mismatchSummary.isComplete).toBe(false)
  })
})

describe('ChainValidator component', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exports both named and default exports and renders accessible initial state with zero inline styles', () => {
    expect(ChainValidatorDefault).toBe(ChainValidator)
    const { container } = render(<ChainValidator />)

    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent(/Certificate Chain Visualizer & Validator/i)

    const h2s = screen.getAllByRole('heading', { level: 2 })
    expect(h2s.length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('h3, h4')).toBeNull()
    expect(container.querySelector('[style]')).toBeNull()

    for (const button of container.querySelectorAll('button')) {
      expect(button).toHaveAttribute('type', 'button')
    }
  })

  it('loads and validates all 4 sample presets accurately', () => {
    const { container } = render(<ChainValidator />)

    // 1. 3-tier-web
    const threeTierBtn = screen.getByRole('button', { name: /3-Tier Web PKI/i })
    fireEvent.click(threeTierBtn)
    expect(threeTierBtn).toBeEnabled()
    expect(threeTierBtn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Valid Complete Trust Hierarchy/i)).toBeInTheDocument()
    expect(screen.getByText(/3 Loaded Certs/i)).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /CyberTrust Global Root CA R1/i }).length,
    ).toBeGreaterThanOrEqual(1)
    expect(
      screen.getAllByRole('button', { name: 'CyberTrust TLS Issuing CA 1A' }).length,
    ).toBeGreaterThanOrEqual(2)
    expect(
      screen.getAllByRole('button', { name: '*.cloudsecurity.io' }).length,
    ).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('[style]')).toBeNull()

    // 2. 4-tier-enterprise
    fireEvent.click(screen.getByRole('button', { name: /4-Tier Enterprise PKI/i }))
    expect(screen.getByText(/4 Loaded Certs/i)).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'CyberTrust Enterprise Policy CA' }).length,
    ).toBeGreaterThanOrEqual(2)
    expect(
      screen.getAllByRole('button', { name: 'identity.secure-enterprise.net' }).length,
    ).toBeGreaterThanOrEqual(2)

    // 3. multi-leaf-branch
    fireEvent.click(screen.getByRole('button', { name: /Multi-Leaf Branch/i }))
    expect(
      screen.getAllByRole('button', { name: 'app.cybercloud.io' }).length,
    ).toBeGreaterThanOrEqual(2)
    expect(
      screen.getAllByRole('button', { name: 'api.cybercloud.io' }).length,
    ).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/Signs & Issues \(2\)/i)).toBeInTheDocument()

    // 4. broken-intermediate
    fireEvent.click(screen.getByRole('button', { name: /Broken Chain Warning/i }))
    expect(
      screen.getByText(/Incomplete Chain \(Missing Intermediate or Issuer in Pool\)/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Orphaned \/ Incomplete Chains/i)).toBeInTheDocument()
    expect(screen.getByText(/Missing Parent/i)).toBeInTheDocument()

    // 5. expired-chain
    fireEvent.click(screen.getByRole('button', { name: /Expired Certificate/i }))
    expect(
      screen.getAllByRole('button', { name: 'expired.cloudsecurity.io' }).length,
    ).toBeGreaterThanOrEqual(2)

    // 6. invalid-signature
    fireEvent.click(screen.getByRole('button', { name: /Invalid Signature/i }))
    expect(
      screen.getAllByRole('button', { name: 'tampered.cloudsecurity.io' }).length,
    ).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/Bad Sig/i)).toBeInTheDocument()
  })

  it('opens ChainNodeInspectorModal, navigates parent/child links, exports PEM/DER, and closes via Escape/backdrop', () => {
    const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:chain-node')
    const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const { container } = render(<ChainValidator />)
    fireEvent.click(screen.getByRole('button', { name: /3-Tier Web PKI/i }))

    // Click Inspect details on one of the tree nodes (Root is first, Inter second, Leaf third)
    const inspectBtns = screen.getAllByRole('button', { name: /Inspect details/i })
    expect(inspectBtns).toHaveLength(3)
    fireEvent.click(inspectBtns[2]!)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByRole('heading', { level: 2 })).toHaveTextContent(
      '*.cloudsecurity.io',
    )
    expect(within(dialog).getByText(/Cryptographically Verified/i)).toBeInTheDocument()
    expect(container.querySelector('[style]')).toBeNull()

    // Navigate to Issuer (Intermediate CA) inside modal
    fireEvent.click(within(dialog).getByRole('button', { name: /View Issuer Cert/i }))
    expect(within(dialog).getByRole('heading', { level: 2 })).toHaveTextContent(
      'CyberTrust TLS Issuing CA 1A',
    )

    // Navigate back down to child via Signs & Issues pill
    const childBtns = within(dialog).getAllByRole('button', { name: /\*\.cloudsecurity\.io/i })
    fireEvent.click(childBtns[childBtns.length - 1]!)
    expect(within(dialog).getByRole('heading', { level: 2 })).toHaveTextContent(
      '*.cloudsecurity.io',
    )

    // Export PEM and DER
    fireEvent.click(within(dialog).getByRole('button', { name: /Download PEM/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: /Download DER/i }))
    expect(createUrlSpy).toHaveBeenCalledTimes(2)
    expect(clickSpy).toHaveBeenCalledTimes(2)
    expect(revokeUrlSpy).toHaveBeenCalledTimes(2)

    // Close via Escape key
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Reopen via node title button and close via backdrop click
    fireEvent.click(screen.getByRole('button', { name: 'CyberTrust Global Root CA R1' }))
    const reopened = screen.getByRole('dialog')
    fireEvent.click(reopened.parentElement!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('supports Classic Stack view, individual certificate tabs, node removal, and Clear', () => {
    render(<ChainValidator />)
    fireEvent.click(screen.getByRole('button', { name: /3-Tier Web PKI/i }))

    // Switch to Classic Stack
    fireEvent.click(screen.getByRole('button', { name: /Classic Stack/i }))
    expect(screen.getAllByText(/Intermediate \/ Leaf/i)).toHaveLength(2)

    // Switch back to Visual Graph
    fireEvent.click(screen.getByRole('button', { name: /Visual Graph/i }))

    // Click individual certificate tab (first button matching Leaf CN in tabs bar)
    const leafTabBtns = screen.getAllByRole('button', { name: /\*\.cloudsecurity\.io/i })
    fireEvent.click(leafTabBtns[0]!)
    expect(screen.getByRole('button', { name: /View Full Chain/i })).toBeInTheDocument()

    // Inspect modal from Single Certificate View
    fireEvent.click(screen.getByRole('button', { name: /Inspect details/i }))
    const modal = screen.getByRole('dialog')
    fireEvent.click(within(modal).getByRole('button', { name: /Close Inspector/i }))

    // Return to Full Chain
    fireEvent.click(screen.getByRole('button', { name: /View Full Chain/i }))
    expect(screen.getByText(/Valid Complete Trust Hierarchy/i)).toBeInTheDocument()

    // Remove Leaf certificate from pool via tab remove button
    fireEvent.click(screen.getByRole('button', { name: 'Remove *.cloudsecurity.io' }))
    expect(screen.getByText(/2 Loaded Certs/i)).toBeInTheDocument()

    // Clear all
    fireEvent.click(screen.getByRole('button', { name: /^Clear$/i }))
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Drop certificates here to reconstruct trust graph/i,
      }),
    ).toBeInTheDocument()
  })

  it('parses pasted PEM chains with AKI=SKI badge, handles inline PEM drawer, and surfaces CSR/CRL/invalid error states', () => {
    const onNavigate = vi.fn()
    render(<ChainValidator onNavigate={onNavigate} />)

    // 1. Empty PEM error
    fireEvent.click(screen.getByRole('button', { name: /View PEM/i }))
    const emptyAlert = screen.getByRole('alert')
    expect(emptyAlert).toBeInTheDocument()

    // Dismiss error
    fireEvent.click(within(emptyAlert).getByRole('button', { name: /Close/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // 2. CSR pasted -> suggests CSR Inspector navigation
    const pemTextarea = screen.getByLabelText(/Certificate \(PEM \/ DER\)/i)
    fireEvent.change(pemTextarea, {
      target: {
        value: '-----BEGIN CERTIFICATE REQUEST-----\nMIIB\n-----END CERTIFICATE REQUEST-----',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: /View PEM/i }))
    fireEvent.click(screen.getByRole('button', { name: /Open in CSR Inspector/i }))
    expect(onNavigate).toHaveBeenCalledWith('csr-inspector')

    // 3. CRL pasted -> suggests CRL Inspector navigation
    fireEvent.change(pemTextarea, {
      target: { value: '-----BEGIN X509 CRL-----\nMIIB\n-----END X509 CRL-----' },
    })
    fireEvent.click(screen.getByRole('button', { name: /View PEM/i }))
    fireEvent.click(screen.getByRole('button', { name: /Open in CRL Inspector/i }))
    expect(onNavigate).toHaveBeenCalledWith('crl-inspector')

    // 4. Corrupt PEM -> invalid PEM error
    fireEvent.change(pemTextarea, {
      target: { value: '-----BEGIN CERTIFICATE-----\nNOT_VALID_ASN1\n-----END CERTIFICATE-----' },
    })
    fireEvent.click(screen.getByRole('button', { name: /View PEM/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/Invalid PEM/i)

    // 5. Valid RFC 5280 AKI/SKI PEM bundle paste -> displays AKI = SKI badge in tree & modal
    const { rootPem, interPem } = createRfc5280AkiSkiChainPems()
    fireEvent.change(pemTextarea, { target: { value: `${rootPem}\n${interPem}` } })
    fireEvent.click(screen.getByRole('button', { name: /View PEM/i }))
    expect(screen.getByText(/Valid Complete Trust Hierarchy/i)).toBeInTheDocument()
    expect(screen.getByText('AKI = SKI')).toBeInTheDocument()

    // 6. Toggle inline PEM drawer while certs are loaded
    fireEvent.click(screen.getByRole('button', { name: /^PEM$/i }))
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
  })

  it('uploads PEM files, handles drag-and-drop, invalid uploads, and unlocks password-protected PFX files', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ChainValidator />)

    const sampleChain = createCryptographicChain('3-tier-web')
    const rootPem = sampleChain[0]!.pem
    const pemFile = new File([rootPem], 'root-ca.pem', { type: 'application/x-pem-file' })

    const fileInput = document.getElementById('chain-file-input') as HTMLInputElement
    expect(fileInput).toBeTruthy()

    // Upload invalid file first -> triggers warning / error alert
    const invalidFile = new File(['not a cert at all'], 'broken.txt', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    // Upload valid PEM file via drag-and-drop
    const mainContainer = fileInput.closest('div')!.parentElement!
    fireEvent.dragOver(mainContainer)
    fireEvent.dragLeave(mainContainer, { relatedTarget: document.body })
    fireEvent.drop(mainContainer, { dataTransfer: { files: [pemFile] } })

    await waitFor(() => {
      expect(screen.getAllByText('CyberTrust Global Root CA R1').length).toBeGreaterThanOrEqual(1)
    })

    // Upload password-protected PFX file
    const pfxFile = createPasswordProtectedPfxFile(sampleChain[1]!.pem, 'secretPass123')
    fireEvent.change(fileInput, { target: { files: [pfxFile] } })

    const unlockDialog = await screen.findByRole('dialog')
    expect(within(unlockDialog).getByText(/Unlock PKCS#12 \/ PFX Keystore/i)).toBeInTheDocument()

    // Submit empty password -> shows required password message
    fireEvent.click(within(unlockDialog).getByRole('button', { name: /^Unlock$/i }))
    expect(within(unlockDialog).getByText(/requires a password/i)).toBeInTheDocument()

    // Toggle show/hide password
    const pwInput = within(unlockDialog).getByPlaceholderText(/Enter keystore password/i)
    expect(pwInput).toHaveAttribute('type', 'password')
    fireEvent.click(within(unlockDialog).getByRole('button', { name: /Show password/i }))
    expect(pwInput).toHaveAttribute('type', 'text')

    // Wrong password -> shows Incorrect password
    fireEvent.change(pwInput, { target: { value: 'wrong-password' } })
    fireEvent.click(within(unlockDialog).getByRole('button', { name: /^Unlock$/i }))
    await waitFor(() => {
      expect(within(unlockDialog).getByText(/Incorrect password/i)).toBeInTheDocument()
    })

    // Correct password -> unlocks and loads certificate into pool
    fireEvent.change(pwInput, { target: { value: 'secretPass123' } })
    fireEvent.click(within(unlockDialog).getByRole('button', { name: /^Unlock$/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByText(/2 Loaded Certs/i)).toBeInTheDocument()
    })

    const parsedCheck = parsePemToCerts(rootPem)
    expect(parsedCheck).toHaveLength(1)
    expect(useAppStore.getState().mode).toBe('secure-boot')
    errorSpy.mockRestore()
  })

  it('covers single-cert roles, modal tab switching, expired certs, inline PEM add, and PFX modal dismissal', async () => {
    render(<ChainValidator />)

    // Type into empty-state PEM textarea and click Clear
    const pemTextarea = screen.getByLabelText(/Certificate \(PEM \/ DER\)/i)
    fireEvent.change(pemTextarea, { target: { value: 'draft text' } })
    fireEvent.click(screen.getByRole('button', { name: /^Clear$/i }))
    expect(pemTextarea).toHaveValue('')

    // Load 3-tier chain and inspect via Classic Stack
    fireEvent.click(screen.getByRole('button', { name: /3-Tier Web PKI/i }))
    fireEvent.click(screen.getByRole('button', { name: /Classic Stack/i }))
    const stackInspectBtns = screen.getAllByRole('button', { name: /Inspect details/i })
    fireEvent.click(stackInspectBtns[0]!)

    // Switch nodes using modal tabs bar inside ChainNodeInspectorModal
    const dialog = screen.getByRole('dialog')
    const modalTabBtns = within(dialog).getAllByRole('button', {
      name: /CyberTrust TLS Issuing CA 1A/i,
    })
    fireEvent.click(modalTabBtns[0]!)
    expect(within(dialog).getByRole('heading', { level: 2 })).toHaveTextContent(
      'CyberTrust TLS Issuing CA 1A',
    )
    fireEvent.click(within(dialog).getByRole('button', { name: /Close Inspector/i }))

    // Select Root tab & Intermediate tab & remove from ChainSingleCertView
    const rootTabBtns = screen.getAllByRole('button', { name: /CyberTrust Global Root CA R1/i })
    fireEvent.click(rootTabBtns[0]!)
    expect(screen.getByText(/Root CA \(Self-Signed\)/i)).toBeInTheDocument()

    const interTabBtns = screen.getAllByRole('button', { name: 'CyberTrust TLS Issuing CA 1A' })
    fireEvent.click(interTabBtns[0]!)
    expect(screen.getByText(/Intermediate CA/i)).toBeInTheDocument()
    const singlePanel = screen
      .getByRole('heading', {
        level: 2,
        name: 'CyberTrust TLS Issuing CA 1A',
      })
      .closest('section')!
    fireEvent.click(
      within(singlePanel).getByRole('button', { name: /Remove CyberTrust TLS Issuing CA 1A/i }),
    )

    // Add an expired self-signed certificate via inline PEM drawer
    const expiredKeys = forge.pki.rsa.generateKeyPair(1024)
    const expiredCert = forge.pki.createCertificate()
    expiredCert.publicKey = expiredKeys.publicKey
    expiredCert.serialNumber = '99'
    expiredCert.validity.notBefore = new Date('2018-01-01T00:00:00Z')
    expiredCert.validity.notAfter = new Date('2019-01-01T00:00:00Z')
    expiredCert.setSubject([{ name: 'commonName', value: 'Expired Legacy Root' }])
    expiredCert.setIssuer([{ name: 'commonName', value: 'Expired Legacy Root' }])
    expiredCert.sign(expiredKeys.privateKey, forge.md.sha256.create())
    const expiredPem = forge.pki.certificateToPem(expiredCert)

    fireEvent.click(screen.getByRole('button', { name: /^PEM$/i }))
    const inlineTextarea = screen.getByLabelText(/Certificate \(PEM \/ DER\)/i)
    fireEvent.change(inlineTextarea, { target: { value: expiredPem } })
    const drawerSection = inlineTextarea.closest('section')!
    fireEvent.click(within(drawerSection).getByRole('button', { name: /Add Certs/i }))
    expect(screen.getAllByText(/Expired/i).length).toBeGreaterThanOrEqual(1)

    // PFX modal blur validation + Escape close + X close
    const sampleChain = createCryptographicChain('3-tier-web')
    const pfxFile = createPasswordProtectedPfxFile(sampleChain[0]!.pem, 'pw123')
    const fileInput = document.getElementById('chain-file-input') as HTMLInputElement

    fireEvent.change(fileInput, { target: { files: [pfxFile] } })
    const pfxModal1 = await screen.findByRole('dialog')
    const pwField1 = within(pfxModal1).getByPlaceholderText(/Enter keystore password/i)
    fireEvent.blur(pwField1)
    expect(within(pfxModal1).getByText(/requires a password/i)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.change(fileInput, { target: { files: [pfxFile] } })
    const pfxModal2 = await screen.findByRole('dialog')
    fireEvent.click(pfxModal2.parentElement!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
