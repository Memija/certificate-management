import forge from 'node-forge'

// Pre-generated RSA keypair PEM for instant, deterministic in-browser X.509 certificate synthesis
const FALLBACK_PRIVATE_KEY_PEM = `-----BEGIN RSA PRIVATE KEY-----
MIICWwIBAAKBgQDHKYzylCLkey4dZxjBZig8t0ZPMWbj91dnG5wg9e0cjvEOz1Gw
TBOFAG1/EG8H6p4X4Egmim9TMvlly4EATzZsBbhaSMAWLVIzeKT6twaN++fioJFA
NptGXOk3D9IaDVtbTxgy+4cws9fAv4r7SI2wZYD5mxCHOAbF1th6RkPwkwIDAQAB
AoGAKYYgPPNl0v1bwAWew7Po77/GiPxj12PadUTsaHLd3PZwjAXtojQ6XaCZM8TZ
YW0pSREZ+e8jBtW56d9kJgxd7Amawo/jcOMyb5ZCbDHgcMb4y19QngsBrTomql7t
bYVQ9fyZmkXmQYPEWZwRQUvQikD3uHe5wp6NEvvDawIFywECQQDk/7ljdqz6gJXY
UNaNmqVKgt47hMoyEbYKJvNO3xa/WO0b5qUdcnmGvFCeSIrSQKe47PzFhqdX1CfM
kc0fjB/vAkEA3qU3Lbe10G7wzFtKJsli28gyG2Gk3Pk43q0yQzOHczV6iTvqzeI3
ScZaiflYiSbZlSjLYhZFVzXi0hmVquZVnQJAch0Esw3mcQY2pY7S+8l+aL0CJUKs
x3qP7ksun7UHzt5veaHb0erDqGKbAeVAWDmj2sEtzPim11t/Ya+eOgRHvQJAfFX5
rZ9VerQp54XnsCdw/NodGWt7PSg02S4RzrOdJfqslq0OYLG/PIT4FOtZxSYcBo+E
nR9g0+Y06C3/hjQhhQJAFu0rDmPM67+eu5BByomIt50KOAfmhybI6yk36atKS990
liEn5jOhvAQ3IvfSACKWkejOShsu8xV4cuxSOy/Z6g==
-----END RSA PRIVATE KEY-----`

let cachedKeyPair: forge.pki.rsa.KeyPair | null = null

export function getFallbackKeyPair(): forge.pki.rsa.KeyPair {
  if (cachedKeyPair) {
    return cachedKeyPair
  }
  try {
    const priv = forge.pki.privateKeyFromPem(FALLBACK_PRIVATE_KEY_PEM) as forge.pki.rsa.PrivateKey
    const pub = forge.pki.setRsaPublicKey(priv.n, priv.e)
    cachedKeyPair = { privateKey: priv, publicKey: pub }
    return cachedKeyPair
  } catch {
    cachedKeyPair = forge.pki.rsa.generateKeyPair(1024)
    return cachedKeyPair
  }
}

export interface SynthCertSpec {
  serialHex: string
  subject: { shortName: string; value: string }[]
  issuer: { shortName: string; value: string }[]
  notBefore: Date
  notAfter: Date
  isCA: boolean
  keyUsage?: {
    digitalSignature?: boolean
    keyEncipherment?: boolean
    keyCertSign?: boolean
    cRLSign?: boolean
  }
  extKeyUsage?: {
    serverAuth?: boolean
    clientAuth?: boolean
    codeSigning?: boolean
    timeStamping?: boolean
  }
  sanDns?: string[]
}

export interface SynthesizedCert {
  derBytes: Uint8Array
  pem: string
  certB64: string
  thumbprintSha1: string
  fingerprintSha1Colon: string
  fingerprintSha256Colon: string
}

export function buildDerAndPemCert(spec: SynthCertSpec): SynthesizedCert {
  const keys = getFallbackKeyPair()
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = spec.serialHex
  cert.validity.notBefore = spec.notBefore
  cert.validity.notAfter = spec.notAfter
  cert.setSubject(spec.subject)
  cert.setIssuer(spec.issuer)

  const exts: Record<string, unknown>[] = [
    { name: 'basicConstraints', cA: spec.isCA, critical: true },
    {
      name: 'keyUsage',
      digitalSignature: spec.keyUsage?.digitalSignature ?? true,
      keyEncipherment: spec.keyUsage?.keyEncipherment ?? !spec.isCA,
      keyCertSign: spec.keyUsage?.keyCertSign ?? spec.isCA,
      cRLSign: spec.keyUsage?.cRLSign ?? spec.isCA,
      critical: true,
    },
    { name: 'subjectKeyIdentifier' },
  ]

  if (spec.extKeyUsage) {
    exts.push({
      name: 'extKeyUsage',
      ...spec.extKeyUsage,
    })
  }

  if (spec.sanDns && spec.sanDns.length > 0) {
    exts.push({
      name: 'subjectAltName',
      altNames: spec.sanDns.map((d) => ({ type: 2, value: d })),
    })
  }

  cert.setExtensions(exts)
  cert.sign(keys.privateKey, forge.md.sha256.create())

  const pem = forge.pki.certificateToPem(cert)
  const derByteStr = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
  const certB64 = forge.util.encode64(derByteStr)

  const derBytes = new Uint8Array(derByteStr.length)
  for (let i = 0; i < derByteStr.length; i++) {
    derBytes[i] = derByteStr.charCodeAt(i)
  }

  const sha1Hex = forge.md.sha1.create().update(derByteStr).digest().toHex().toUpperCase()
  const sha256Hex = forge.md.sha256.create().update(derByteStr).digest().toHex().toUpperCase()

  return {
    derBytes,
    pem,
    certB64,
    thumbprintSha1: sha1Hex,
    fingerprintSha1Colon: sha1Hex.match(/.{1,2}/g)?.join(':') || sha1Hex,
    fingerprintSha256Colon: sha256Hex.match(/.{1,2}/g)?.join(':') || sha256Hex,
  }
}
