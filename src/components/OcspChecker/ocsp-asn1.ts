import forge from 'node-forge'

export interface ForgeCertExtension {
  id?: string
  name?: string
  value?: unknown
}

const NON_RSA_OIDS = new Set([
  '1.2.840.10045.2.1',
  '1.3.101.112',
  '1.3.101.113',
  '1.2.840.10040.4.1',
])

const HTTP_URL_RE = /https?:\/\/[a-zA-Z0-9_.-]+(?::\d+)?(?:\/[a-zA-Z0-9_.~!$&'()*+,;=:@%/-]*)?/g

export function isValidX509Der(derBytes: string): boolean {
  try {
    const asn1 = forge.asn1.fromDer(derBytes)
    if (asn1.tagClass !== forge.asn1.Class.UNIVERSAL || asn1.type !== forge.asn1.Type.SEQUENCE) {
      return false
    }
    if (!Array.isArray(asn1.value) || asn1.value.length !== 3) {
      return false
    }
    const [tbs, sigAlg, sigVal] = asn1.value
    if (
      tbs?.type !== forge.asn1.Type.SEQUENCE ||
      !Array.isArray(tbs.value) ||
      tbs.value.length < 6 ||
      sigAlg?.type !== forge.asn1.Type.SEQUENCE ||
      sigVal?.type !== forge.asn1.Type.BITSTRING
    ) {
      return false
    }
    const isTime = (n: forge.asn1.Asn1) =>
      n.type === forge.asn1.Type.UTCTIME || n.type === forge.asn1.Type.GENERALIZEDTIME
    return tbs.value.some(
      (el) =>
        el.type === forge.asn1.Type.SEQUENCE &&
        Array.isArray(el.value) &&
        el.value.length === 2 &&
        isTime(el.value[0]) &&
        isTime(el.value[1]),
    )
  } catch {
    return false
  }
}

export function stripPemToCleanBase64(pem: string): string {
  const clean = pem
    .replace(/-----BEGIN[^-]+-----/g, '')
    .replace(/-----END[^-]+-----/g, '')
    .replace(/\s+/g, '')
  if (!clean || !isValidX509Der(forge.util.decode64(clean))) {
    throw new Error('Invalid PEM X.509')
  }
  atob(clean)
  return clean
}

export function parseForgeCertWithEccSupport(pem: string): forge.pki.Certificate | null {
  try {
    return forge.pki.certificateFromPem(pem)
  } catch {
    try {
      const clean = pem
        .replace(/-----BEGIN[^-]+-----/g, '')
        .replace(/-----END[^-]+-----/g, '')
        .replace(/\s+/g, '')
      const obj = forge.asn1.fromDer(forge.util.decode64(clean))
      const origPubKey = forge.pki.publicKeyFromAsn1
      const origDerToOid = forge.asn1.derToOid
      try {
        forge.asn1.derToOid = (bytes: forge.Bytes | forge.util.ByteStringBuffer) => {
          const oid = origDerToOid(bytes)
          return NON_RSA_OIDS.has(oid) ? forge.pki.oids.rsaEncryption : oid
        }
        forge.pki.publicKeyFromAsn1 = () => ({}) as forge.pki.rsa.PublicKey
        return forge.pki.certificateFromAsn1(obj)
      } finally {
        forge.pki.publicKeyFromAsn1 = origPubKey
        forge.asn1.derToOid = origDerToOid
      }
    } catch {
      return null
    }
  }
}

export function extractAiaOcspUrl(extValue: unknown): string | null {
  if (typeof extValue !== 'string') {
    return null
  }
  try {
    const asn = forge.asn1.fromDer(extValue)
    if (!Array.isArray(asn.value)) {
      return null
    }
    let found: string | null = null
    for (const item of asn.value) {
      if (
        Array.isArray(item.value) &&
        item.value.length >= 2 &&
        typeof item.value[0].value === 'string' &&
        typeof item.value[1].value === 'string' &&
        forge.asn1.derToOid(item.value[0].value) === '1.3.6.1.5.5.7.48.1'
      ) {
        found = item.value[1].value
      }
    }
    return found
  } catch {
    return (extValue.match(HTTP_URL_RE) || []).find((u) => u.includes('ocsp')) ?? null
  }
}

function findFirstCrlUri(node: forge.asn1.Asn1): string | null {
  if (
    node.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC &&
    node.type === 6 &&
    typeof node.value === 'string' &&
    node.value.includes('crl')
  ) {
    return node.value
  }
  if (Array.isArray(node.value)) {
    for (const child of node.value) {
      const hit = findFirstCrlUri(child)
      if (hit) {
        return hit
      }
    }
  }
  return null
}

export function extractCdpCrlUrl(extValue: unknown): string | null {
  if (typeof extValue !== 'string') {
    return null
  }
  try {
    return findFirstCrlUri(forge.asn1.fromDer(extValue))
  } catch {
    return (extValue.match(HTTP_URL_RE) || []).find((u) => u.includes('crl')) ?? null
  }
}
