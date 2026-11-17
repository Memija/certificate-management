import forge from 'node-forge'

import type { CertChainNode, ParsedCertificate } from '@/types'

export type NodeRole = 'root' | 'intermediate' | 'leaf'

export interface ChainNode extends CertChainNode {
  parent: ChainNode | null
  children: ChainNode[]
  skiHex: string | null
  akiHex: string | null
  akiMatchesParentSki: boolean | null
}

export interface BuiltChainGraph {
  rootNodes: ChainNode[]
  orphanNodes: ChainNode[]
  allNodes: ChainNode[]
}

export interface ChainValidationSummary {
  isComplete: boolean
  hasSignatureMismatch: boolean
  hasExpiredCert: boolean
  totalCount: number
  rootCount: number
  orphanCount: number
}

interface ForgeRawExtension {
  id?: string
  name?: string
  value?: unknown
  subjectKeyIdentifier?: string
}

const SKI_OID = '2.5.29.14'
const AKI_OID = '2.5.29.35'
const OBJECT_TAG_HEX = '5B6F626A656374204F626A6563745D'

function normalizeHex(raw: string): string {
  return raw.replace(/[^0-9a-fA-F]/g, '').toUpperCase()
}

function unwrapDerOctetBytes(bytes: string): string {
  if (
    bytes.length >= 2 &&
    bytes.charCodeAt(0) === 0x04 &&
    bytes.charCodeAt(1) === bytes.length - 2
  ) {
    return bytes.slice(2)
  }
  return bytes
}

export function parseForgeCertSafe(pem: string): forge.pki.Certificate | null {
  if (!pem) {
    return null
  }
  try {
    return forge.pki.certificateFromPem(pem)
  } catch {
    return null
  }
}

export function verifyParsedCerts(
  childCert: forge.pki.Certificate | null,
  parentCert: forge.pki.Certificate | null,
): boolean {
  if (!childCert || !parentCert) {
    return false
  }
  try {
    return parentCert.verify(childCert)
  } catch {
    return false
  }
}

export function verifySignature(childPem: string, parentPem: string): boolean {
  return verifyParsedCerts(parseForgeCertSafe(childPem), parseForgeCertSafe(parentPem))
}

export function verifySelfCert(cert: forge.pki.Certificate | null): boolean {
  if (!cert) {
    return false
  }
  try {
    return cert.verify(cert)
  } catch {
    return false
  }
}

export function extractSkiHex(
  forgeCert: forge.pki.Certificate | null,
  cert: ParsedCertificate,
): string | null {
  const exts = (forgeCert?.extensions ?? []) as ForgeRawExtension[]
  const skiExt = exts.find((e) => e.id === SKI_OID || e.name === 'subjectKeyIdentifier')
  if (typeof skiExt?.subjectKeyIdentifier === 'string' && skiExt.subjectKeyIdentifier) {
    return normalizeHex(skiExt.subjectKeyIdentifier)
  }
  if (typeof skiExt?.value === 'string' && skiExt.value) {
    try {
      const asn1 = forge.asn1.fromDer(skiExt.value)
      if (typeof asn1.value === 'string') {
        return forge.util.bytesToHex(asn1.value).toUpperCase()
      }
    } catch {
      // fall through to parsed cert extension
    }
  }

  const parsed = cert.extensions.find(
    (e) => e.oid === SKI_OID || e.name.toLowerCase().includes('subjectkeyidentifier'),
  )
  if (!parsed?.value) {
    return null
  }
  const hex = normalizeHex(parsed.value)
  return hex.length === 44 && hex.startsWith('0414') ? hex.slice(4) : hex || null
}

export function extractAkiHex(
  forgeCert: forge.pki.Certificate | null,
  cert: ParsedCertificate,
): string | null {
  const exts = (forgeCert?.extensions ?? []) as ForgeRawExtension[]
  const akiExt = exts.find((e) => e.id === AKI_OID || e.name === 'authorityKeyIdentifier')
  if (typeof akiExt?.value === 'string' && akiExt.value) {
    try {
      const seq = forge.asn1.fromDer(akiExt.value)
      if (Array.isArray(seq.value)) {
        const keyNode = seq.value.find(
          (item) =>
            item.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC &&
            item.type === 0 &&
            typeof item.value === 'string',
        )
        if (keyNode && typeof keyNode.value === 'string') {
          const hex = forge.util.bytesToHex(unwrapDerOctetBytes(keyNode.value)).toUpperCase()
          return hex === OBJECT_TAG_HEX ? null : hex
        }
      }
    } catch {
      // fall through to parsed cert extension
    }
  }

  const parsed = cert.extensions.find(
    (e) => e.oid === AKI_OID || e.name.toLowerCase().includes('authoritykeyidentifier'),
  )
  if (!parsed?.value) {
    return null
  }
  const hex = normalizeHex(parsed.value)
  if (hex.includes(OBJECT_TAG_HEX)) {
    return null
  }
  if (hex.startsWith('30168014') && hex.length >= 48) {
    return hex.slice(8, 48)
  }
  if (hex.startsWith('301880160414') && hex.length >= 52) {
    return hex.slice(12, 52)
  }
  return hex || null
}

export function doesAkiMatchSki(childAki: string | null, parentSki: string | null): boolean | null {
  if (!childAki || !parentSki) {
    return null
  }
  return normalizeHex(childAki) === normalizeHex(parentSki)
}

export function formatKeyIdentifier(hex: string): string {
  const clean = normalizeHex(hex)
  return clean.match(/.{1,2}/g)?.join(':') ?? clean
}

export function getSubjectCN(subject: string): string {
  return (
    subject.match(/CN=([^,]+)/)?.[1]?.trim() || subject.match(/O=([^,]+)/)?.[1]?.trim() || subject
  )
}

export function getNodeRole(node: Pick<ChainNode, 'isSelfSigned' | 'cert' | 'children'>): NodeRole {
  if (node.isSelfSigned) {
    return 'root'
  }
  return node.cert.isIntermediate || node.children.length > 0 ? 'intermediate' : 'leaf'
}

export function isCertExpired(validTo: string, now: Date = new Date()): boolean {
  return new Date(validTo) < now
}

function indexPush(map: Map<string, number[]>, key: string, idx: number): void {
  if (!key) {
    return
  }
  const list = map.get(key)
  if (list) {
    list.push(idx)
  } else {
    map.set(key, [idx])
  }
}

function findVerifiedParentIndex(
  childIdx: number,
  childForge: forge.pki.Certificate | null,
  prioritized: Set<number>,
  forgeCerts: (forge.pki.Certificate | null)[],
): number {
  for (const pIdx of prioritized) {
    if (pIdx !== childIdx && verifyParsedCerts(childForge, forgeCerts[pIdx] ?? null)) {
      return pIdx
    }
  }
  if (!childForge) {
    return -1
  }
  for (let pIdx = 0; pIdx < forgeCerts.length; pIdx += 1) {
    if (
      pIdx !== childIdx &&
      !prioritized.has(pIdx) &&
      verifyParsedCerts(childForge, forgeCerts[pIdx] ?? null)
    ) {
      return pIdx
    }
  }
  return -1
}

export function buildChains(certs: ParsedCertificate[]): BuiltChainGraph {
  const forgeCerts = certs.map((c) => parseForgeCertSafe(c.pem))
  const allNodes: ChainNode[] = certs.map((c, idx) => {
    const fc = forgeCerts[idx] ?? null
    return {
      id: `node-${idx}-${c.fingerprintSha256 || 'cert'}`,
      cert: c,
      isSelfSigned: c.isRoot || (c.subject === c.issuer && verifySelfCert(fc)),
      parent: null,
      children: [],
      signatureVerified: null,
      skiHex: extractSkiHex(fc, c),
      akiHex: extractAkiHex(fc, c),
      akiMatchesParentSki: null,
    }
  })

  const bySki = new Map<string, number[]>()
  const bySubject = new Map<string, number[]>()
  const byCn = new Map<string, number[]>()

  for (let i = 0; i < allNodes.length; i += 1) {
    const n = allNodes[i]!
    if (n.skiHex) {
      indexPush(bySki, n.skiHex, i)
    }
    indexPush(bySubject, n.cert.subject, i)
    indexPush(byCn, getSubjectCN(n.cert.subject), i)
  }

  for (let i = 0; i < allNodes.length; i += 1) {
    const node = allNodes[i]!
    if (node.isSelfSigned) {
      node.signatureVerified = verifySelfCert(forgeCerts[i] ?? null) || node.cert.isRoot
      node.akiMatchesParentSki = doesAkiMatchSki(node.akiHex, node.skiHex)
      continue
    }

    const prioritized = new Set<number>([
      ...(node.akiHex ? (bySki.get(node.akiHex) ?? []) : []),
      ...(bySubject.get(node.cert.issuer) ?? []),
      ...(byCn.get(getSubjectCN(node.cert.issuer)) ?? []),
    ])

    const verifiedIdx = findVerifiedParentIndex(i, forgeCerts[i] ?? null, prioritized, forgeCerts)
    if (verifiedIdx !== -1) {
      const parent = allNodes[verifiedIdx]!
      node.parent = parent
      parent.children.push(node)
      node.signatureVerified = true
      node.akiMatchesParentSki = doesAkiMatchSki(node.akiHex, parent.skiHex)
      continue
    }

    for (const pIdx of prioritized) {
      if (pIdx !== i) {
        const fallback = allNodes[pIdx]!
        node.parent = fallback
        fallback.children.push(node)
        node.signatureVerified = false
        node.akiMatchesParentSki = doesAkiMatchSki(node.akiHex, fallback.skiHex)
        break
      }
    }
  }

  return {
    rootNodes: allNodes.filter((n) => n.isSelfSigned && n.parent === null),
    orphanNodes: allNodes.filter((n) => !n.isSelfSigned && n.parent === null),
    allNodes,
  }
}

export function computeChainSummary(
  certs: ParsedCertificate[],
  graph: BuiltChainGraph,
  now: Date = new Date(),
): ChainValidationSummary {
  const { rootNodes, orphanNodes, allNodes } = graph
  const hasSignatureMismatch =
    allNodes.some((n) => n.signatureVerified === false) ||
    certs.some((c) => {
      const iss = certs.find((p) => p.subject === c.issuer && p !== c)
      return Boolean(iss && !verifySignature(c.pem, iss.pem))
    })
  const hasExpiredCert = allNodes.some((n) => isCertExpired(n.cert.validTo, now))
  const isComplete =
    certs.length > 0 && orphanNodes.length === 0 && rootNodes.length > 0 && !hasSignatureMismatch

  return {
    isComplete,
    hasSignatureMismatch,
    hasExpiredCert,
    totalCount: certs.length,
    rootCount: rootNodes.length,
    orphanCount: orphanNodes.length,
  }
}
