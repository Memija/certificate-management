import forge from 'node-forge'

type Asn1Node = forge.asn1.Asn1

export interface ParsedTlsExtension {
  id: string
  oid: string
  name: string
  critical: boolean
  value: string
}

interface ForgeAltName {
  type: number
  value: string
}

interface ForgeCertificateExtension {
  id?: string
  name?: string
  critical?: boolean
  value?: string
  digitalSignature?: boolean
  nonRepudiation?: boolean
  keyEncipherment?: boolean
  dataEncipherment?: boolean
  keyAgreement?: boolean
  keyCertSign?: boolean
  cRLSign?: boolean
  encipherOnly?: boolean
  decipherOnly?: boolean
  serverAuth?: boolean
  clientAuth?: boolean
  codeSigning?: boolean
  emailProtection?: boolean
  timeStamping?: boolean
  ocspSigning?: boolean
  cA?: boolean
  pathLenConstraint?: number
  altNames?: ForgeAltName[]
}

interface ForgePkiWithExtensionParser {
  certificateExtensionFromAsn1?: (node: Asn1Node) => ForgeCertificateExtension
}

const ASN1_CLASS_CONTEXT_SPECIFIC = 0x80

const KEY_USAGE_FLAGS: ReadonlyArray<readonly [keyof ForgeCertificateExtension, string]> = [
  ['digitalSignature', 'Digital Signature'],
  ['nonRepudiation', 'Non-Repudiation'],
  ['keyEncipherment', 'Key Encipherment'],
  ['dataEncipherment', 'Data Encipherment'],
  ['keyAgreement', 'Key Agreement'],
  ['keyCertSign', 'Certificate Signing'],
  ['cRLSign', 'CRL Signing'],
  ['encipherOnly', 'Encipher Only'],
  ['decipherOnly', 'Decipher Only'],
]

const KNOWN_EKU_LABELS: Record<string, string> = {
  '1.3.6.1.5.5.7.3.1': 'Server Authentication (1.3.6.1.5.5.7.3.1)',
  '1.3.6.1.5.5.7.3.2': 'Client Authentication (1.3.6.1.5.5.7.3.2)',
  '1.3.6.1.5.5.7.3.3': 'Code Signing (1.3.6.1.5.5.7.3.3)',
  '1.3.6.1.5.5.7.3.4': 'Email Protection (1.3.6.1.5.5.7.3.4)',
  '1.3.6.1.5.5.7.3.8': 'Time Stamping (1.3.6.1.5.5.7.3.8)',
  '1.3.6.1.5.5.7.3.9': 'OCSP Signing (1.3.6.1.5.5.7.3.9)',
}

const EKU_FLAGS: ReadonlyArray<readonly [keyof ForgeCertificateExtension, string]> = [
  ['serverAuth', '1.3.6.1.5.5.7.3.1'],
  ['clientAuth', '1.3.6.1.5.5.7.3.2'],
  ['codeSigning', '1.3.6.1.5.5.7.3.3'],
  ['emailProtection', '1.3.6.1.5.5.7.3.4'],
  ['timeStamping', '1.3.6.1.5.5.7.3.8'],
  ['ocspSigning', '1.3.6.1.5.5.7.3.9'],
]

const SAN_PREFIXES: Record<number, string> = { 1: 'email:', 2: 'DNS:', 6: 'URI:', 7: 'IP:' }

const AIA_METHOD_NAMES: Record<string, string> = {
  '1.3.6.1.5.5.7.48.1': 'OCSP',
  '1.3.6.1.5.5.7.48.2': 'CA Issuers',
}

function getExtensionValueBytes(node: Asn1Node): string | null {
  if (!Array.isArray(node.value)) {
    return null
  }
  const valNode = node.value.length === 3 ? node.value[2] : node.value[1]
  return valNode && typeof valNode.value === 'string' ? valNode.value : null
}

function parseInnerExtensionAsn1(node: Asn1Node): Asn1Node | null {
  try {
    const rawBytes = getExtensionValueBytes(node)
    return rawBytes ? forge.asn1.fromDer(rawBytes) : null
  } catch {
    return null
  }
}

function unwrapOctetStringBytes(node: Asn1Node): string | null {
  const rawBytes = getExtensionValueBytes(node)
  if (!rawBytes) {
    return null
  }
  try {
    const inner = forge.asn1.fromDer(rawBytes)
    return typeof inner.value === 'string' ? inner.value : rawBytes
  } catch {
    return rawBytes
  }
}

function formatHexWithSeparator(bytes: string, separator: string): string {
  const upperHex = forge.util.bytesToHex(bytes).toUpperCase()
  const pairs = upperHex.match(/.{2}/g)
  return pairs ? pairs.join(separator) : upperHex
}

function hasNonPrintableBytes(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if ((code >= 0x00 && code <= 0x08) || (code >= 0x0e && code <= 0x1f) || code >= 0x7f) {
      return true
    }
  }
  return false
}

function formatKeyUsage(ext: ForgeCertificateExtension): string {
  return KEY_USAGE_FLAGS.filter(([flag]) => Boolean(ext[flag]))
    .map(([, label]) => label)
    .join(', ')
}

function formatExtKeyUsage(ext: ForgeCertificateExtension, node: Asn1Node): string {
  const ekus = EKU_FLAGS.filter(([flag]) => Boolean(ext[flag])).map(
    ([, oid]) => KNOWN_EKU_LABELS[oid],
  )
  const innerAsn1 = parseInnerExtensionAsn1(node)
  if (innerAsn1 && Array.isArray(innerAsn1.value)) {
    for (const item of innerAsn1.value) {
      if (typeof item.value === 'string') {
        const itemOid = forge.asn1.derToOid(item.value)
        const label = KNOWN_EKU_LABELS[itemOid] || itemOid
        if (!ekus.includes(label)) {
          ekus.push(label)
        }
      }
    }
  }
  return ekus.join(', ')
}

function formatBasicConstraints(ext: ForgeCertificateExtension): string {
  const caLabel = ext.cA ? 'Yes' : 'No'
  const pathLenSuffix =
    ext.pathLenConstraint !== undefined ? `, Path Length Constraint: ${ext.pathLenConstraint}` : ''
  return `Is CA: ${caLabel}${pathLenSuffix}`
}

function formatSubjectAltName(ext: ForgeCertificateExtension): string {
  if (!ext.altNames || ext.altNames.length === 0) {
    return ''
  }
  return ext.altNames.map((an) => `${SAN_PREFIXES[an.type] ?? ''}${an.value}`).join(', ')
}

function formatSubjectKeyIdentifier(ext: ForgeCertificateExtension, node: Asn1Node): string {
  const bytes = unwrapOctetStringBytes(node)
  return bytes ? formatHexWithSeparator(bytes, ':') : ext.value || ''
}

function formatAuthorityKeyIdentifier(ext: ForgeCertificateExtension, node: Asn1Node): string {
  const rawBytes = getExtensionValueBytes(node)
  if (!rawBytes) {
    return ext.value || ''
  }
  const inner = parseInnerExtensionAsn1(node)
  const keyIdObj =
    inner && Array.isArray(inner.value)
      ? inner.value.find((item) => item.tagClass === ASN1_CLASS_CONTEXT_SPECIFIC && item.type === 0)
      : undefined
  if (keyIdObj && typeof keyIdObj.value === 'string') {
    return `KeyID: ${formatHexWithSeparator(keyIdObj.value, ':')}`
  }
  return formatHexWithSeparator(rawBytes, ':')
}

function formatAuthorityInfoAccess(ext: ForgeCertificateExtension, node: Asn1Node): string {
  const items: string[] = []
  const inner = parseInnerExtensionAsn1(node)
  if (inner && Array.isArray(inner.value)) {
    for (const accessDesc of inner.value) {
      if (
        Array.isArray(accessDesc.value) &&
        accessDesc.value.length >= 2 &&
        typeof accessDesc.value[0].value === 'string' &&
        typeof accessDesc.value[1].value === 'string'
      ) {
        const methodOid = forge.asn1.derToOid(accessDesc.value[0].value)
        const method = AIA_METHOD_NAMES[methodOid] || methodOid
        items.push(`${method} - URI:${accessDesc.value[1].value}`)
      }
    }
  }
  return items.length > 0 ? items.join('\n') : typeof ext.value === 'string' ? ext.value : ''
}

function collectDistributionPointUris(node: Asn1Node, uris: string[]): void {
  if (
    typeof node.value === 'string' &&
    (node.value.startsWith('http') || node.value.startsWith('ldap'))
  ) {
    uris.push(`URI:${node.value}`)
    return
  }
  if (Array.isArray(node.value)) {
    for (const child of node.value) {
      collectDistributionPointUris(child, uris)
    }
  }
}

function formatCrlDistributionPoints(ext: ForgeCertificateExtension, node: Asn1Node): string {
  const uris: string[] = []
  const inner = parseInnerExtensionAsn1(node)
  if (inner) {
    collectDistributionPointUris(inner, uris)
  }
  return uris.length > 0 ? uris.join('\n') : typeof ext.value === 'string' ? ext.value : ''
}

function formatSinglePolicyQualifiers(qualifiersNode: Asn1Node, policyIndex: number): string {
  if (!Array.isArray(qualifiersNode.value)) {
    return ''
  }
  let suffix = ''
  qualifiersNode.value.forEach((qual, qIdx) => {
    if (
      Array.isArray(qual.value) &&
      typeof qual.value[0]?.value === 'string' &&
      typeof qual.value[1]?.value === 'string' &&
      forge.asn1.derToOid(qual.value[0].value) === '1.3.6.1.5.5.7.2.1'
    ) {
      suffix += `\n[${policyIndex + 1},${qIdx + 1}]Policy Qualifier Info: CPS: ${qual.value[1].value}`
    }
  })
  return suffix
}

function formatCertificatePolicies(ext: ForgeCertificateExtension, node: Asn1Node): string {
  const policies: string[] = []
  const inner = parseInnerExtensionAsn1(node)
  if (inner && Array.isArray(inner.value)) {
    inner.value.forEach((polInfo, idx) => {
      if (!Array.isArray(polInfo.value) || typeof polInfo.value[0]?.value !== 'string') {
        return
      }
      const polOid = forge.asn1.derToOid(polInfo.value[0].value)
      const qualifiers = polInfo.value[1] ? formatSinglePolicyQualifiers(polInfo.value[1], idx) : ''
      policies.push(`[${idx + 1}]Certificate Policy: Policy Identifier=${polOid}${qualifiers}`)
    })
  }
  return policies.length > 0 ? policies.join('\n') : typeof ext.value === 'string' ? ext.value : ''
}

function formatTimestampList(node: Asn1Node): string {
  const bytes = unwrapOctetStringBytes(node)
  return bytes
    ? `Embedded Signed Certificate Timestamps (${bytes.length} bytes)`
    : 'Embedded Signed Certificate Timestamps'
}

function formatFallbackExtension(ext: ForgeCertificateExtension, node: Asn1Node): string {
  const rawVal = typeof ext.value === 'string' ? ext.value : ''
  if (hasNonPrintableBytes(rawVal) || !rawVal) {
    const bytes = getExtensionValueBytes(node)
    if (bytes) {
      return formatHexWithSeparator(bytes, ' ')
    }
    return rawVal ? forge.util.bytesToHex(rawVal).toUpperCase() : ''
  }
  return rawVal
}

interface ExtensionFormatterSpec {
  oid: string
  name: string
  format: (ext: ForgeCertificateExtension, node: Asn1Node) => string
}

const EXTENSION_FORMATTERS: readonly ExtensionFormatterSpec[] = [
  { oid: '2.5.29.15', name: 'keyUsage', format: (ext) => formatKeyUsage(ext) },
  { oid: '2.5.29.37', name: 'extKeyUsage', format: formatExtKeyUsage },
  { oid: '2.5.29.19', name: 'basicConstraints', format: (ext) => formatBasicConstraints(ext) },
  { oid: '2.5.29.17', name: 'subjectAltName', format: (ext) => formatSubjectAltName(ext) },
  { oid: '2.5.29.14', name: 'subjectKeyIdentifier', format: formatSubjectKeyIdentifier },
  { oid: '2.5.29.35', name: 'authorityKeyIdentifier', format: formatAuthorityKeyIdentifier },
  { oid: '1.3.6.1.5.5.7.1.1', name: 'authorityInfoAccess', format: formatAuthorityInfoAccess },
  { oid: '2.5.29.31', name: 'cRLDistributionPoints', format: formatCrlDistributionPoints },
  { oid: '2.5.29.32', name: 'certificatePolicies', format: formatCertificatePolicies },
  {
    oid: '1.3.6.1.4.1.11129.2.4.2',
    name: 'timestampList',
    format: (_ext, n) => formatTimestampList(n),
  },
]

function parseExtensionNode(node: Asn1Node): ParsedTlsExtension {
  const rawOidBytes =
    Array.isArray(node.value) && typeof node.value[0]?.value === 'string' ? node.value[0].value : ''
  const fallbackOid = rawOidBytes ? forge.asn1.derToOid(rawOidBytes) : ''

  let ext: ForgeCertificateExtension
  try {
    const parser = (forge.pki as unknown as ForgePkiWithExtensionParser)
      .certificateExtensionFromAsn1
    ext = parser ? parser(node) : { id: fallbackOid }
  } catch {
    ext = { id: fallbackOid }
  }

  const oid = ext.id || fallbackOid
  const critical =
    typeof ext.critical === 'boolean'
      ? ext.critical
      : Array.isArray(node.value) && node.value.length === 3
        ? Boolean(node.value[1].value)
        : false

  const matched = EXTENSION_FORMATTERS.find((spec) => ext.name === spec.name || oid === spec.oid)
  if (matched) {
    return { id: oid, oid, name: matched.name, critical, value: matched.format(ext, node) }
  }

  const name = ext.name || forge.pki.oids[oid] || oid
  return { id: oid, oid, name, critical, value: formatFallbackExtension(ext, node) }
}

export function parseExtensionsFromRaw(rawBuffer: Buffer): ParsedTlsExtension[] {
  try {
    const asn1 = forge.asn1.fromDer(rawBuffer.toString('binary'))
    const tbsCert = Array.isArray(asn1.value) ? asn1.value[0] : undefined
    if (!tbsCert || !Array.isArray(tbsCert.value)) {
      return []
    }
    const extWrapper = tbsCert.value.find(
      (el) => el.tagClass === ASN1_CLASS_CONTEXT_SPECIFIC && el.type === 3,
    )
    const extSeq = extWrapper && Array.isArray(extWrapper.value) ? extWrapper.value[0] : undefined
    return extSeq && Array.isArray(extSeq.value) ? extSeq.value.map(parseExtensionNode) : []
  } catch {
    return []
  }
}
