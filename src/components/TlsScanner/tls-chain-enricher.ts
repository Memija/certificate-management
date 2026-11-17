import forge from 'node-forge'

import type { CertExtension, TlsChainCertificate } from '@/types'

export function formatDn(dn: string | Record<string, string> | null | undefined): string {
  if (!dn) {
    return ''
  }
  if (typeof dn === 'string') {
    return dn.split('\n').filter(Boolean).join(', ')
  }
  return Object.entries(dn)
    .filter(([, val]) => Boolean(val))
    .map(([key, val]) => `${key}=${val}`)
    .join(', ')
}

export function derB64ToPem(b64: string): string {
  if (!b64) {
    return ''
  }
  const formatted = b64.match(/.{1,64}/g)?.join('\n') || b64
  return `-----BEGIN CERTIFICATE-----\n${formatted}\n-----END CERTIFICATE-----\n`
}

function parseFallbackExtensionsFromB64(rawB64: string): CertExtension[] {
  try {
    const asn1 = forge.asn1.fromDer(forge.util.decode64(rawB64))
    const tbs = Array.isArray(asn1.value) ? asn1.value[0] : undefined
    if (!tbs || !Array.isArray(tbs.value)) {
      return []
    }
    const wrapper = tbs.value.find(
      (el) => el.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && el.type === 3,
    )
    const seq = wrapper && Array.isArray(wrapper.value) ? wrapper.value[0] : undefined
    if (!seq || !Array.isArray(seq.value)) {
      return []
    }
    const forgeOids = forge.pki.oids as Record<string, string>
    return seq.value.map((node): CertExtension => {
      const items = Array.isArray(node.value) ? node.value : []
      const oid = typeof items[0]?.value === 'string' ? forge.asn1.derToOid(items[0].value) : ''
      const valNode = items.length === 3 ? items[2] : items[1]
      const rawBytes = typeof valNode?.value === 'string' ? valNode.value : ''
      const hex = forge.util.bytesToHex(rawBytes).toUpperCase()
      return {
        id: oid,
        oid,
        name: forgeOids[oid] || oid,
        critical: items.length === 3 ? Boolean(items[1]?.value) : false,
        value: hex.match(/.{1,2}/g)?.join(' ') || hex,
      }
    })
  } catch {
    return []
  }
}

export function enrichTlsChain(chain: TlsChainCertificate[]): TlsChainCertificate[] {
  return chain.map((cert) => ({
    ...cert,
    pem: cert.pem || (cert.rawB64 ? derB64ToPem(cert.rawB64) : ''),
    subjectCN: cert.subjectCN || formatDn(cert.subject) || 'Unknown',
    issuerCN: cert.issuerCN || formatDn(cert.issuer) || 'Unknown',
    extensions:
      cert.extensions && cert.extensions.length > 0
        ? cert.extensions
        : cert.rawB64
          ? parseFallbackExtensionsFromB64(cert.rawB64)
          : [],
  }))
}
