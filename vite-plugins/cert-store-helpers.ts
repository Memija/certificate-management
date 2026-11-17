export const VALID_CERT_STORES = ['Root', 'CA', 'My', 'TrustedPublisher', 'Disallowed'] as const
export type CertStoreName = (typeof VALID_CERT_STORES)[number]

export const VALID_CERT_LOCATIONS = ['CurrentUser', 'LocalMachine'] as const
export type CertStoreLocation = (typeof VALID_CERT_LOCATIONS)[number]

export interface CertExtensionItem {
  name: string
  oid: string
  critical: boolean
  value: string
}

interface RawCertStoreEntry {
  thumbprint?: string
  subject?: string
  issuer?: string
  notBefore?: string
  notAfter?: string
  serialNumber?: string
  signatureAlgorithm?: string
  publicKeyAlgorithm?: string
  publicKeySize?: number | null
  friendlyName?: string
  purposes?: string[]
  isRoot?: boolean
  isIntermediate?: boolean
  isExpired?: boolean
  isExpiringSoon?: boolean
  certB64?: string
  extensions?: CertExtensionItem[]
}

export interface EnrichedCertStoreEntry {
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
  certB64: string
  extensions: CertExtensionItem[]
}

export interface ExpiryBatchEntry {
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

export function isValidCertStore(value: string): value is CertStoreName {
  return (VALID_CERT_STORES as readonly string[]).includes(value)
}

export function isValidCertLocation(value: string): value is CertStoreLocation {
  return (VALID_CERT_LOCATIONS as readonly string[]).includes(value)
}

export function buildExpiryBatchPsScript(): string {
  return `
$now = Get-Date
$thirtyDays = $now.AddDays(30)
$results = [System.Collections.Generic.List[object]]::new()
foreach ($loc in @('CurrentUser', 'LocalMachine')) {
    foreach ($st in @('My', 'Root', 'CA')) {
        try {
            $certs = Get-ChildItem -Path "Cert:\\\\$loc\\\\$st" -ErrorAction Stop
            foreach ($cert in $certs) {
                $isExpired = $cert.NotAfter -lt $now
                $expiringSoon = (-not $isExpired) -and ($cert.NotAfter -lt $thirtyDays)
                if ($isExpired -or $expiringSoon) {
                    [void]$results.Add([PSCustomObject]@{
                        thumbprint     = $cert.Thumbprint
                        subject        = $cert.Subject
                        issuer         = $cert.Issuer
                        notBefore      = $cert.NotBefore.ToString("o")
                        notAfter       = $cert.NotAfter.ToString("o")
                        isExpired      = $isExpired
                        isExpiringSoon = $expiringSoon
                        storeName      = $st
                        location       = $loc
                    })
                }
            }
        } catch {}
    }
}
ConvertTo-Json -InputObject @($results.ToArray()) -Depth 3 -Compress
exit 0
`
}

export function buildSingleStorePsBody(
  storeLocation: CertStoreLocation,
  storeName: CertStoreName,
): string {
  return `
$ErrorActionPreference = 'Stop'
$results = [System.Collections.Generic.List[object]]::new()
$now = Get-Date
$thirtyDays = $now.AddDays(30)
$storePath = "Cert:\\\\${storeLocation}\\\\${storeName}"
$certs = Get-ChildItem -Path $storePath -ErrorAction Stop
foreach ($cert in $certs) {
    try {
        $certBytes = $cert.RawData
        if (-not $certBytes) {
            $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
        }
        $b64 = [Convert]::ToBase64String($certBytes)

        $purposes = [System.Collections.Generic.List[string]]::new()
        $exts = [System.Collections.Generic.List[object]]::new()
        $isSelfSigned = ($cert.Subject -eq $cert.Issuer)
        $hasBc = $false
        $isCA = $false

        foreach ($ext in $cert.Extensions) {
            $oidVal = $ext.Oid.Value
            $friendly = $ext.Oid.FriendlyName
            if ($oidVal -eq "2.5.29.15" -or $friendly -eq "Key Usage") {
                $kuRaw = $ext.Format(0) -replace '\\s*\\([^)]*\\)', ''
                foreach ($part in ($kuRaw -split ',')) {
                    $trimmed = $part.Trim()
                    if ($trimmed -and -not $purposes.Contains($trimmed)) { [void]$purposes.Add($trimmed) }
                }
            } elseif ($oidVal -eq "2.5.29.37" -or $friendly -eq "Enhanced Key Usage") {
                if ($ext -is [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]) {
                    foreach ($u in $ext.EnhancedKeyUsages) {
                        $trimmed = if ($u.FriendlyName) { $u.FriendlyName.Trim() } else { $u.Value }
                        if ($trimmed -and -not $purposes.Contains($trimmed)) { [void]$purposes.Add($trimmed) }
                    }
                }
            } elseif ($oidVal -eq "2.5.29.19" -or $oidVal -eq "2.5.29.10" -or $friendly -eq "Basic Constraints") {
                $hasBc = $true
                if ($ext -is [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]) {
                    $isCA = [bool]$ext.CertificateAuthority
                } else {
                    $formatted = $ext.Format($false)
                    $isCA = ($formatted -match "CA" -or $formatted -match "IsCertificateAuthority=True")
                }
            }

            try {
                [void]$exts.Add([PSCustomObject]@{
                    name     = if ($friendly) { $friendly } else { $oidVal }
                    oid      = $oidVal
                    critical = $ext.Critical
                    value    = try { $ext.Format(0) } catch { "" }
                })
            } catch {}
        }

        if ($purposes.Count -eq 0) { [void]$purposes.Add("General Purpose") }
        if (-not $hasBc) { $isCA = $isSelfSigned }

        $pubKeyAlg = ""
        $pubKeySize = $null
        try {
            $pubKeyAlg = $cert.PublicKey.Oid.FriendlyName
            if ($cert.PublicKey.Key) {
                $pubKeySize = $cert.PublicKey.Key.KeySize
            }
        } catch {}

        $isExpired    = $cert.NotAfter -lt $now
        $expiringSoon = (-not $isExpired) -and ($cert.NotAfter -lt $thirtyDays)
        $isRoot = $isCA -and $isSelfSigned
        $isIntermediate = $isCA -and (-not $isRoot)

        [void]$results.Add([PSCustomObject]@{
            thumbprint         = $cert.Thumbprint
            subject            = $cert.Subject
            issuer             = $cert.Issuer
            notBefore          = $cert.NotBefore.ToString("o")
            notAfter           = $cert.NotAfter.ToString("o")
            serialNumber       = $cert.SerialNumber
            signatureAlgorithm = $cert.SignatureAlgorithm.FriendlyName
            publicKeyAlgorithm = $pubKeyAlg
            publicKeySize      = $pubKeySize
            friendlyName       = $cert.FriendlyName
            purposes           = $purposes.ToArray()
            isRoot             = $isRoot
            isIntermediate     = $isIntermediate
            isExpired          = $isExpired
            isExpiringSoon     = $expiringSoon
            certB64            = $b64
            extensions         = $exts.ToArray()
        })
    } catch {}
}
`
}

function mapRawCertEntry(entry: RawCertStoreEntry): EnrichedCertStoreEntry {
  const b64 = entry.certB64 || ''
  const wrapped = b64 ? (b64.match(/.{1,64}/g)?.join('\n') ?? b64) : ''
  const pem = wrapped ? `-----BEGIN CERTIFICATE-----\n${wrapped}\n-----END CERTIFICATE-----\n` : ''

  return {
    thumbprint: entry.thumbprint || '',
    subject: entry.subject || '',
    issuer: entry.issuer || '',
    notBefore: entry.notBefore || '',
    notAfter: entry.notAfter || '',
    serialNumber: entry.serialNumber || '',
    signatureAlgorithm: entry.signatureAlgorithm || '',
    publicKeyAlgorithm: entry.publicKeyAlgorithm || '',
    publicKeySize: entry.publicKeySize ?? null,
    friendlyName: entry.friendlyName || '',
    purposes: Array.isArray(entry.purposes) ? entry.purposes : [],
    isRoot: Boolean(entry.isRoot),
    isIntermediate: Boolean(entry.isIntermediate),
    isExpired: Boolean(entry.isExpired),
    isExpiringSoon: Boolean(entry.isExpiringSoon),
    pem,
    certB64: b64,
    extensions: Array.isArray(entry.extensions) ? entry.extensions : [],
  }
}

export function parseExpiryBatchOutput(clean: string): ExpiryBatchEntry[] {
  if (!clean) {
    return []
  }
  const parsed: unknown = JSON.parse(clean)
  if (Array.isArray(parsed)) {
    return parsed as ExpiryBatchEntry[]
  }
  if (parsed && typeof parsed === 'object') {
    return [parsed as ExpiryBatchEntry]
  }
  return []
}

export function parseAndMapStoreOutput(clean: string): EnrichedCertStoreEntry[] {
  if (!clean) {
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error(`Could not parse PowerShell output: ${clean.substring(0, 200)}`)
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'error' in parsed) {
    const errorRecord = parsed as { error?: unknown }
    if (errorRecord.error) {
      throw new Error(String(errorRecord.error))
    }
  }

  const rawList: RawCertStoreEntry[] = Array.isArray(parsed)
    ? (parsed as RawCertStoreEntry[])
    : parsed && typeof parsed === 'object'
      ? [parsed as RawCertStoreEntry]
      : []

  return rawList.map(mapRawCertEntry)
}
