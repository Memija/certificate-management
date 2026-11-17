import type { TranslateFn } from './app'

export type StoreLocation = 'CurrentUser' | 'LocalMachine'

export type StoreName = 'Root' | 'CA' | 'My' | 'TrustedPublisher' | 'Disallowed'

export type SecureBootVarName = 'PK' | 'KEK' | 'db' | 'dbx'

export interface CertExtension {
  id?: string
  name: string
  oid: string
  critical: boolean
  value: string
}

export interface ParsedCertificate {
  issuer: string
  subject: string
  validFrom: string
  validTo: string
  serialNumber: string
  signatureType: string
  pem: string
  isRoot: boolean
  isIntermediate: boolean
  isLeaf: boolean
  isExpired: boolean
  purposes: string[]
  version: number
  signatureOid: string
  signatureAlgorithm: string
  publicKeyAlgorithm: string
  publicKeySize: number | null
  fingerprintSha1: string
  fingerprintSha256: string
  extensions: CertExtension[]
}

export interface WinCertEntry {
  thumbprint: string
  subject: string
  issuer: string
  notBefore: string
  notAfter: string
  serialNumber: string
  signatureAlgorithm: string
  publicKeyAlgorithm: string
  publicKeySize: number | null
  friendlyName: string
  purposes: string[]
  isRoot: boolean
  isIntermediate: boolean
  isExpired: boolean
  isExpiringSoon: boolean
  pem: string
  certB64?: string
  extensions: CertExtension[]
  storeName?: StoreName | string
  location?: StoreLocation | string
}

export type FallbackCertStoreEntry = WinCertEntry

export interface ExpiryDashboardCertEntry {
  thumbprint: string
  subject: string
  issuer: string
  notBefore: string
  notAfter: string
  isExpired: boolean
  isExpiringSoon: boolean
  storeName: string
  location: string
}

export interface EfiSignatureData {
  signatureOwner: string
  certificate?: ParsedCertificate
  hashData?: string
  rawData: Uint8Array
}

export interface EfiSignatureList {
  signatureTypeGuid: string
  signatureTypeName: string
  signatureListSize: number
  signatureHeaderSize: number
  signatureSize: number
  signatures: EfiSignatureData[]
}

export type TrustStoreFormat =
  'X509-DER' | 'X509-PEM' | 'PEM-Bundle' | 'PKCS7' | 'PKCS12' | 'JKS' | 'CRL' | 'Unknown'

export interface TrustStoreEntry {
  alias: string
  certificate: ParsedCertificate
  privateKeyPem?: string
  isEncryptedJksKey?: boolean
  encryptedJksKeyData?: Uint8Array
}

export interface ParsedTrustStore {
  format: TrustStoreFormat
  entries: TrustStoreEntry[]
  warnings: string[]
  needsPassword?: boolean
}

export interface CSRSubjectField {
  shortName: string
  name: string
  value: string
}

export interface CSRExtension {
  name: string
  oid: string
  critical: boolean
  value: string
}

export interface ParsedCSR {
  /** Full subject DN string, e.g. "CN=example.com, O=Acme, C=US" */
  subject: string
  /** Parsed subject fields for individual row display */
  subjectFields: CSRSubjectField[]
  publicKeyAlgorithm: string
  publicKeySize: number | null
  signatureAlgorithm: string
  signatureOid: string
  /** Whether the CSR's self-signature is cryptographically valid */
  signatureValid: boolean
  requestedExtensions: CSRExtension[]
  requestedPurposes: string[]
  pem: string
  /** SHA-256 fingerprint of the DER-encoded CSR */
  fingerprintSha256: string
  /** Raw DER bytes as base64, for download */
  derBase64: string
}

export interface CsrValidationSubject {
  cn: string
  country?: string
  state?: string
  locality?: string
  org?: string
  ou?: string
  email?: string
}

export type CsrTranslateFn = TranslateFn

export interface CsrValidationOptions {
  /** If true, cn cannot be empty. If false, either cn OR at least one SAN must be present. */
  requireCn?: boolean
  /** Whether to validate SAN items syntax */
  sans?: string
  /** Whether TLS Server Authentication is requested (triggers SAN advisory warning if missing) */
  serverAuthEnabled?: boolean
  /** Validate an existing private key PEM */
  existingKeyPem?: string
  /** Check for placeholder-only subject values */
  checkPlaceholders?: boolean
  /** Optional i18next translation function */
  t?: CsrTranslateFn
}

export interface CsrFieldErrors {
  cn?: string
  country?: string
  state?: string
  locality?: string
  org?: string
  ou?: string
  email?: string
  sans?: string
  existingKey?: string
  general?: string
}

export interface CsrValidationResult {
  isValid: boolean
  errors: CsrFieldErrors
  warnings: string[]
}

export interface RevokedCertificate {
  serialNumber: string
  revocationDate: string
  reason: string
}

export interface CrlExtension {
  name: string
  oid: string
  critical: boolean
  value: string
}

export interface ParsedCRL {
  version: number
  issuer: string
  thisUpdate: string
  nextUpdate: string | null
  isExpired: boolean
  revokedCertificates: RevokedCertificate[]
  extensions: CrlExtension[]
  pem: string
  fingerprintSha256: string
  derBase64: string
}

export type ChainPreset =
  '3-tier-web' | '4-tier-enterprise' | 'multi-leaf-branch' | 'broken-intermediate'

export interface CertChainNode {
  id: string
  cert: ParsedCertificate
  isSelfSigned: boolean
  parent: CertChainNode | null
  children: CertChainNode[]
  signatureVerified: boolean | null
}

export interface PublicKeyModulusInfo {
  type: 'Certificate' | 'CSR'
  modulus: string
  modulusHex: string
  bits: number
  sha256: string
}

export interface PrivateKeyModulusInfo {
  type: 'PrivateKey'
  modulus: string
  modulusHex: string
  bits: number
  sha256: string
}

export interface KeyMatchResult {
  matched: boolean
  publicInfo: PublicKeyModulusInfo
  privateInfo: PrivateKeyModulusInfo
}

export interface KeyMatcherSamplePreset {
  id: string
  name: string
  badge?: string
  description: string
  certOrCsr: string
  privateKey: string
  expectedMatch: boolean
}

export interface PemDerSamplePreset {
  id: string
  name: string
  badge: string
  description: string
  filename: string
  contentType: 'cert' | 'key'
  outputFormat: 'pem' | 'der'
  isBinary: boolean
  createFile: () => File
  getContent: () => string | ArrayBuffer
}

export interface PfxSamplePreset {
  id: string
  name: string
  badge: string
  description: string
  certPem: string
  keyPem: string
  defaultPassword: string
  keyBits: number
  commonName: string
}

export interface TlsKeyDetails {
  namedCurve?: string
  modulusLength?: number
}

export interface TlsChainCertificate {
  subject: string | Record<string, string>
  issuer: string | Record<string, string>
  subjectCN?: string
  issuerCN?: string
  valid_from: string
  valid_to: string
  fingerprint: string
  fingerprint256: string
  serialNumber: string
  rawB64: string
  pem: string
  keyType?: string
  bits?: number
  keyDetails?: TlsKeyDetails
  ca?: boolean
  subjectAltNames?: string[]
  extensions: CertExtension[]
}

export interface TlsCipherInfo {
  name: string
  standardName?: string
  version: string
}

export interface TlsScanResult {
  chain: TlsChainCertificate[]
  protocol: string
  cipher: TlsCipherInfo
  authorized: boolean
  authorizationError: string | null
  host: string
  port: number
}

export type OcspStatus = 'good' | 'revoked' | 'unknown'

export interface OcspParsedCertInput {
  subject: string
  issuer: string
  serialNumber: string
  notBefore: Date
  notAfter: Date
  isExpired: boolean
  isValidPeriod?: boolean
  ocspUrl: string | null
  crlUrl: string | null
}

export interface OcspRevocationResult {
  status: OcspStatus
  output: string
  ocspVerified: boolean
  crlVerified: boolean
  ocspUrl: string | null
  crlUrl: string | null
}

export interface OcspSamplePreset {
  id: string
  name: string
  badge: string
  badgeType: 'danger' | 'success' | 'warning' | 'info'
  expectedStatus: OcspStatus
  description: string
  category: string
  subject: string
  issuer: string
  ocspUrl: string | null
  crlUrl: string | null
  certificatePem: string
}

export type CtLogProvider = 'crt.sh' | 'certspotter' | 'sample'

export interface CtEntry {
  id: number
  issuer_ca_id: number
  issuer_name: string
  common_name: string
  name_value: string
  entry_timestamp: string
  not_before: string
  not_after: string
  serial_number: string
}

export interface CtLogPreset {
  id: string
  domain: string
  badgeType?: 'success' | 'warning' | 'purple' | 'info' | 'danger'
  sampleData: CtEntry[]
  isSpecial?: boolean
}

export interface CtSearchResult {
  data: CtEntry[]
  provider: CtLogProvider
  rateLimited: boolean
}
