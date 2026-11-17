import forge from 'node-forge'

import type { ParsedCSR, SimpleTranslateFn, TranslateFn } from '@/types'
import { parseCSRFromText } from '@/utils/csr-parser'
import { isValidIpv4, isValidIpv6 } from '@/utils/csr-validation'
import { generateRsaKeyPairAsync } from '@/utils/rsa-key-generator'

export type CsrKeyMode = 'generate' | 'existing'

export interface CsrKeyUsages {
  digitalSignature: boolean
  nonRepudiation: boolean
  keyEncipherment: boolean
  dataEncipherment: boolean
  keyAgreement: boolean
  keyCertSign: boolean
  cRLSign: boolean
}

export interface CsrExtKeyUsages {
  serverAuth: boolean
  clientAuth: boolean
  codeSigning: boolean
  emailProtection: boolean
  timeStamping: boolean
}

export interface CsrEditorSubjectValues {
  cn: string
  org: string
  ou: string
  country: string
  state: string
  locality: string
  email: string
}

export interface InitialCsrEditorState {
  subject: CsrEditorSubjectValues
  sans: string
  keyUsages: CsrKeyUsages
  extKeyUsages: CsrExtKeyUsages
  keySize: number
}

export interface BuildSignedCsrOptions {
  subject: CsrEditorSubjectValues
  sans: string
  keyUsages: CsrKeyUsages
  extKeyUsages: CsrExtKeyUsages
  keyMode: CsrKeyMode
  keySize: number
  existingKeyPem: string
  initialName: string
  t: TranslateFn
}

export interface SignedCsrResult {
  parsedCsr: ParsedCSR
  fileName: string
  generatedPrivateKeyPem?: string
}

const DEFAULT_KEY_USAGES: CsrKeyUsages = {
  digitalSignature: true,
  nonRepudiation: false,
  keyEncipherment: true,
  dataEncipherment: false,
  keyAgreement: false,
  keyCertSign: false,
  cRLSign: false,
}

const DEFAULT_EXT_KEY_USAGES: CsrExtKeyUsages = {
  serverAuth: true,
  clientAuth: false,
  codeSigning: false,
  emailProtection: false,
  timeStamping: false,
}

function getSubjectField(csr: ParsedCSR, keys: string[]): string {
  const match = csr.subjectFields.find((f) => keys.includes(f.shortName) || keys.includes(f.name))
  return match ? match.value : ''
}

export function extractInitialEditorState(csr: ParsedCSR): InitialCsrEditorState {
  const cn = getSubjectField(csr, ['CN', 'commonName', 'Common Name'])
  const subject: CsrEditorSubjectValues = {
    cn,
    org: getSubjectField(csr, ['O', 'organizationName', 'Organization']),
    ou: getSubjectField(csr, ['OU', 'organizationalUnitName', 'Organizational Unit']),
    country: getSubjectField(csr, ['C', 'countryName', 'Country']),
    state: getSubjectField(csr, ['ST', 'stateOrProvinceName', 'State / Province']),
    locality: getSubjectField(csr, ['L', 'localityName', 'Locality']),
    email: getSubjectField(csr, ['E', 'emailAddress', 'Email']),
  }

  const sanExt = csr.requestedExtensions.find(
    (e) => e.name.toLowerCase().includes('subjectaltname') || e.oid === '2.5.29.17',
  )
  const sans = sanExt?.value
    ? sanExt.value
        .split(',')
        .map((s) => s.trim().replace(/^(DNS|IP|Email|URI|Type\s*\d+):\s*/i, ''))
        .filter(Boolean)
        .join(', ')
    : cn

  const kuExt = csr.requestedExtensions.find(
    (e) => e.name.toLowerCase().includes('keyusage') || e.oid === '2.5.29.15',
  )
  let keyUsages: CsrKeyUsages = { ...DEFAULT_KEY_USAGES }
  if (kuExt?.value) {
    const val = kuExt.value.toLowerCase()
    keyUsages = {
      digitalSignature: val.includes('digital signature'),
      nonRepudiation: val.includes('non-repudiation') || val.includes('nonrepudiation'),
      keyEncipherment: val.includes('key encipherment'),
      dataEncipherment: val.includes('data encipherment'),
      keyAgreement: val.includes('key agreement'),
      keyCertSign: val.includes('certificate sign') || val.includes('key cert sign'),
      cRLSign: val.includes('crl sign'),
    }
  }

  const ekuExt = csr.requestedExtensions.find(
    (e) => e.name.toLowerCase().includes('extkeyusage') || e.oid === '2.5.29.37',
  )
  let extKeyUsages: CsrExtKeyUsages = { ...DEFAULT_EXT_KEY_USAGES }
  if (ekuExt?.value) {
    const val = ekuExt.value.toLowerCase()
    extKeyUsages = {
      serverAuth: val.includes('server auth'),
      clientAuth: val.includes('client auth'),
      codeSigning: val.includes('code signing'),
      emailProtection: val.includes('email protection'),
      timeStamping: val.includes('time stamping'),
    }
  }

  const keySize =
    csr.publicKeySize && [2048, 3072, 4096].includes(csr.publicKeySize) ? csr.publicKeySize : 2048

  return {
    subject,
    sans,
    keyUsages,
    extKeyUsages,
    keySize,
  }
}

function buildSubjectAttributes(subject: CsrEditorSubjectValues): forge.pki.CertificateField[] {
  const attrs: forge.pki.CertificateField[] = []
  if (subject.cn.trim()) {
    attrs.push({ name: 'commonName', value: subject.cn.trim() })
  }
  if (subject.country.trim()) {
    attrs.push({ name: 'countryName', value: subject.country.trim().toUpperCase() })
  }
  if (subject.state.trim()) {
    attrs.push({ name: 'stateOrProvinceName', value: subject.state.trim() })
  }
  if (subject.locality.trim()) {
    attrs.push({ name: 'localityName', value: subject.locality.trim() })
  }
  if (subject.org.trim()) {
    attrs.push({ name: 'organizationName', value: subject.org.trim() })
  }
  if (subject.ou.trim()) {
    attrs.push({ name: 'organizationalUnitName', value: subject.ou.trim() })
  }
  if (subject.email.trim()) {
    attrs.push({ name: 'emailAddress', value: subject.email.trim() })
  }
  return attrs
}

function buildRequestedExtensions(
  sans: string,
  keyUsages: CsrKeyUsages,
  extKeyUsages: CsrExtKeyUsages,
): Array<Record<string, unknown>> {
  const extensions: Array<Record<string, unknown>> = []

  const sanItems = sans
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (sanItems.length > 0) {
    const altNames = sanItems.map((item) => {
      if (item.startsWith('http://') || item.startsWith('https://')) {
        return { type: 6, value: item }
      }
      if (isValidIpv4(item) || isValidIpv6(item)) {
        return { type: 7, ip: item }
      }
      if (item.includes('@') && !item.includes('/')) {
        return { type: 1, value: item }
      }
      return { type: 2, value: item }
    })
    extensions.push({ name: 'subjectAltName', altNames })
  }

  const kuEntries = Object.entries(keyUsages).filter(([, enabled]) => enabled)
  if (kuEntries.length > 0) {
    extensions.push({
      name: 'keyUsage',
      ...Object.fromEntries(kuEntries),
    })
  }

  const ekuEntries = Object.entries(extKeyUsages).filter(([, enabled]) => enabled)
  if (ekuEntries.length > 0) {
    extensions.push({
      name: 'extKeyUsage',
      ...Object.fromEntries(ekuEntries),
    })
  }

  return extensions
}

export async function buildAndSignCsr(options: BuildSignedCsrOptions): Promise<SignedCsrResult> {
  const {
    subject,
    sans,
    keyUsages,
    extKeyUsages,
    keyMode,
    keySize,
    existingKeyPem,
    initialName,
    t,
  } = options
  const translate = t as SimpleTranslateFn

  let privKey: forge.pki.rsa.PrivateKey
  let pubKey: forge.pki.rsa.PublicKey
  let generatedPrivateKeyPem: string | undefined

  if (keyMode === 'generate') {
    const keypair = await generateRsaKeyPairAsync(keySize)
    privKey = keypair.privateKey
    pubKey = keypair.publicKey
    generatedPrivateKeyPem = forge.pki.privateKeyToPem(privKey)
  } else {
    if (!existingKeyPem.trim()) {
      throw new Error(
        translate(
          'app.csr.editor.keyRequired',
          'Please provide or generate a private key to sign the CSR.',
        ),
      )
    }
    privKey = forge.pki.privateKeyFromPem(existingKeyPem.trim())
    pubKey = forge.pki.setRsaPublicKey(privKey.n, privKey.e)
  }

  const req = forge.pki.createCertificationRequest()
  req.publicKey = pubKey
  req.setSubject(buildSubjectAttributes(subject))

  const extensions = buildRequestedExtensions(sans, keyUsages, extKeyUsages)
  if (extensions.length > 0) {
    req.setAttributes([
      {
        name: 'extensionRequest',
        extensions,
      },
    ])
  }

  req.sign(privKey, forge.md.sha256.create())

  const pem = forge.pki.certificationRequestToPem(req)
  const parsedCsr = parseCSRFromText(pem)

  const baseName = initialName.replace(/\.[^/.]+$/, '')
  const safeCn = (subject.cn.trim() || baseName || 'edited_csr').replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileName = `${safeCn}.csr`

  return {
    parsedCsr,
    fileName,
    generatedPrivateKeyPem,
  }
}
