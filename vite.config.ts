import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { exec, execFile } from 'child_process'
import { promisify } from 'util'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as crypto from 'crypto'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

function createAsyncCache<T>(ttlMs: number) {
  const store = new Map<string, { value: T; expiresAt: number }>()
  const inflight = new Map<string, Promise<T>>()

  return {
    getOrLoad(key: string, bypassCache: boolean, loader: () => Promise<T>): Promise<T> {
      const now = Date.now()
      if (!bypassCache) {
        const hit = store.get(key)
        if (hit && hit.expiresAt > now) {
          return Promise.resolve(hit.value)
        }
        const pending = inflight.get(key)
        if (pending) {
          return pending
        }
      }

      const p = loader()
        .then((val) => {
          store.set(key, { value: val, expiresAt: Date.now() + ttlMs })
          return val
        })
        .finally(() => {
          inflight.delete(key)
        })

      inflight.set(key, p)
      return p
    },
    set(key: string, value: T) {
      store.set(key, { value, expiresAt: Date.now() + ttlMs })
    },
  }
}

async function runPowerShellEncoded(script: string, timeout = 30000): Promise<string> {
  const fullScript = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n${script}`
  const encoded = Buffer.from(fullScript, 'utf16le').toString('base64')
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
    {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      timeout,
      windowsHide: true,
    }
  )
  return stdout.replace(/^\uFEFF/, '').trim()
}

function secureBootApiPlugin() {
  const cache = createAsyncCache<any>(30_000)

  return {
    name: 'secure-boot-api',
    configureServer(server: any) {
      server.middlewares.use('/api/secureboot', async (req: any, res: any) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const varName = url.searchParams.get('var');
        const elevate = url.searchParams.get('elevate') === 'true';
        const refresh = url.searchParams.get('refresh') === 'true';

        if (!varName) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing "var" query parameter' }));
          return;
        }

        const VALID_VARS = ['all', 'PK', 'KEK', 'db', 'dbx'];
        if (!VALID_VARS.includes(varName)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid "var" query parameter' }));
          return;
        }

        try {
          const cacheKey = `sb:${varName}`;
          const resultData = await cache.getOrLoad(cacheKey, elevate || refresh, async () => {
            if (varName === 'all') {
              if (elevate) {
                const tmpdir = os.tmpdir();
                const runId = crypto.randomUUID();
                const outPath = path.join(tmpdir, `secureboot_all_out_${runId}.json`);
                const scriptPath = path.join(tmpdir, `secureboot_all_get_${runId}.ps1`);

                const psScript = `
$ErrorActionPreference = 'Stop'
$results = @{}
$vars = @('PK', 'KEK', 'db', 'dbx')
try {
    foreach ($v in $vars) {
        $bytes = (Get-SecureBootUEFI -Name $v).Bytes
        if ($bytes) {
            $results[$v] = [Convert]::ToBase64String($bytes)
        }
    }
    $results | ConvertTo-Json -Compress | Out-File -FilePath '${outPath}' -Encoding utf8
} catch {
    $_.Exception.Message | Out-File -FilePath '${outPath}' -Encoding utf8
}
`;
                await fs.writeFile(scriptPath, psScript, 'utf8');
                try {
                  const command = `powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \\"${scriptPath}\\"' -Verb RunAs -Wait"`;
                  await execAsync(command);
                  const output = await fs.readFile(outPath, 'utf8');
                  const cleanOutput = output.replace(/^\uFEFF/, '').trim();
                  try {
                    return JSON.parse(cleanOutput);
                  } catch {
                    throw new Error(`Elevated process error: ${cleanOutput}`);
                  }
                } finally {
                  try { await fs.unlink(outPath); } catch {}
                  try { await fs.unlink(scriptPath); } catch {}
                }
              } else {
                // Batched single PowerShell call for all 4 variables
                const psScript = `
$results = @{}
foreach ($v in @('PK', 'KEK', 'db', 'dbx')) {
    try {
        $b = (Get-SecureBootUEFI -Name $v -ErrorAction Stop).Bytes
        if ($b) { $results[$v] = [Convert]::ToBase64String($b) }
    } catch {}
}
$results | ConvertTo-Json -Compress
exit 0
`;
                const stdout = await runPowerShellEncoded(psScript);
                const parsed = stdout ? JSON.parse(stdout) : {};
                if (!parsed || Object.keys(parsed).length === 0) {
                  throw new Error('Access was denied');
                }
                return parsed;
              }
            } else {
              let base64Str = '';
              if (elevate) {
                const tmpdir = os.tmpdir();
                const runId = crypto.randomUUID();
                const outPath = path.join(tmpdir, `secureboot_${varName}_out_${runId}.txt`);
                const scriptPath = path.join(tmpdir, `secureboot_${varName}_get_${runId}.ps1`);

                const psScript = `
$ErrorActionPreference = 'Stop'
try {
    $bytes = (Get-SecureBootUEFI -Name '${varName}').Bytes
    [Convert]::ToBase64String($bytes) | Out-File -FilePath '${outPath}' -Encoding ascii
} catch {
    $_.Exception.Message | Out-File -FilePath '${outPath}' -Encoding ascii
}
`;
                await fs.writeFile(scriptPath, psScript, 'utf8');
                try {
                  const command = `powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \\"${scriptPath}\\"' -Verb RunAs -Wait"`;
                  await execAsync(command);
                  const output = await fs.readFile(outPath, 'utf8');
                  base64Str = output.trim();
                } finally {
                  try { await fs.unlink(outPath); } catch {}
                  try { await fs.unlink(scriptPath); } catch {}
                }

                if (base64Str.includes(' ')) {
                  throw new Error(`Elevated process error: ${base64Str}`);
                }
              } else {
                base64Str = await runPowerShellEncoded(
                  `try { $b = (Get-SecureBootUEFI -Name '${varName}' -ErrorAction Stop).Bytes; if ($b) { [Convert]::ToBase64String($b) } } catch { throw }`
                );
              }
              return base64Str;
            }
          });

          if (!resultData || (typeof resultData === 'string' && !resultData.trim())) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Variable ${varName} not found or empty.` }));
            return;
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ data: resultData }));
        } catch (error: any) {
          console.error(`Failed to get Secure Boot variable ${varName}:`, error.message);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: `Failed to access variable. ${error.message}`
          }));
        }
      });
    },
    configurePreviewServer(server: any) {
      this.configureServer(server);
    }
  }
}

// ─── Windows Certificate Store API ───────────────────────────────────────────
function certStoreApiPlugin() {
  const cache = createAsyncCache<any>(30_000)

  const buildSingleStorePsBody = (storeLocation: string, storeName: string) => `
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

  const mapEnrichedCerts = (parsed: any) => {
    const certsArray: any[] = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
    return certsArray.map((entry: any) => {
      const b64 = entry.certB64 || '';
      const pem = b64
        ? `-----BEGIN CERTIFICATE-----\n${b64.match(/.{1,64}/g)?.join('\n') || b64}\n-----END CERTIFICATE-----\n`
        : '';

      return {
        thumbprint:         entry.thumbprint || '',
        subject:            entry.subject || '',
        issuer:             entry.issuer || '',
        notBefore:          entry.notBefore || '',
        notAfter:           entry.notAfter || '',
        serialNumber:       entry.serialNumber || '',
        signatureAlgorithm: entry.signatureAlgorithm || '',
        publicKeyAlgorithm: entry.publicKeyAlgorithm || '',
        publicKeySize:      entry.publicKeySize ?? null,
        friendlyName:       entry.friendlyName || '',
        purposes:           entry.purposes || [],
        isRoot:             Boolean(entry.isRoot),
        isIntermediate:     Boolean(entry.isIntermediate),
        isExpired:          entry.isExpired || false,
        isExpiringSoon:     entry.isExpiringSoon || false,
        pem,
        certB64:            b64,
        extensions:         entry.extensions || [],
      };
    });
  }

  return {
    name: 'cert-store-api',
    configureServer(server: any) {
      server.middlewares.use('/api/certstore', async (req: any, res: any) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const batchMode     = url.searchParams.get('batch');
        const refresh       = url.searchParams.get('refresh') === 'true';

        // Fast single-process scan across all 6 stores for ExpiryDashboard
        if (batchMode === 'expiry') {
          try {
            const data = await cache.getOrLoad('certstore:batch:expiry', refresh, async () => {
              const batchScript = `
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
`;
              const clean = await runPowerShellEncoded(batchScript);
              if (!clean) return [];
              const parsed = JSON.parse(clean);
              return Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
            });

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ data }));
          } catch (error: any) {
            const msg: string = error.message || String(error);
            console.error('[certstore:batch]', msg);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: msg }));
          }
          return;
        }

        const storeName     = url.searchParams.get('store')    || 'Root';
        const storeLocation = url.searchParams.get('location') || 'CurrentUser';
        const elevate       = url.searchParams.get('elevate')  === 'true';

        // Allowlist to prevent injection
        const VALID_STORES    = ['Root', 'CA', 'My', 'TrustedPublisher', 'Disallowed'];
        const VALID_LOCATIONS = ['CurrentUser', 'LocalMachine'];
        if (!VALID_STORES.includes(storeName) || !VALID_LOCATIONS.includes(storeLocation)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid store or location parameter' }));
          return;
        }

        try {
          const cacheKey = `certstore:${storeLocation}:${storeName}`;
          const enriched = await cache.getOrLoad(cacheKey, elevate || refresh, async () => {
            const coreBody = buildSingleStorePsBody(storeLocation, storeName);
            let clean = '';

            if (elevate) {
              const tmpdir     = os.tmpdir();
              const runId      = crypto.randomUUID();
              const outPath    = path.join(tmpdir, `certstore_out_${runId}.json`);
              const scriptPath = path.join(tmpdir, `certstore_get_${runId}.ps1`);
              const psScript = `
try {
${coreBody}
    ConvertTo-Json -InputObject @($results.ToArray()) -Depth 5 -Compress | Out-File -FilePath '${outPath}' -Encoding utf8
} catch {
    [PSCustomObject]@{ error = $_.Exception.Message } | ConvertTo-Json -Compress | Out-File -FilePath '${outPath}' -Encoding utf8
}
`;
              await fs.writeFile(scriptPath, psScript, 'utf8');
              try {
                const command = `powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \\"${scriptPath}\\"' -Verb RunAs -Wait"`;
                await execAsync(command, { timeout: 30000 });
                const raw = await fs.readFile(outPath, 'utf8');
                clean = raw.replace(/^\uFEFF/, '').trim();
              } finally {
                try { await fs.unlink(outPath); } catch {}
                try { await fs.unlink(scriptPath); } catch {}
              }
            } else {
              const psScript = `
try {
${coreBody}
    ConvertTo-Json -InputObject @($results.ToArray()) -Depth 5 -Compress
} catch {
    [PSCustomObject]@{ error = $_.Exception.Message } | ConvertTo-Json -Compress
}
exit 0
`;
              clean = await runPowerShellEncoded(psScript);
            }

            if (!clean) return [];

            let parsed: any;
            try {
              parsed = JSON.parse(clean);
            } catch {
              throw new Error(`Could not parse PowerShell output: ${clean.substring(0, 200)}`);
            }

            if (parsed && !Array.isArray(parsed) && parsed.error) {
              throw new Error(String(parsed.error));
            }

            return mapEnrichedCerts(parsed);
          });

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ data: enriched }));
        } catch (error: any) {
          const msg: string = error.message || String(error);
          console.error('[certstore]', msg);

          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: msg }));
        }
      });
    },
    configurePreviewServer(server: any) {
      this.configureServer(server);
    },
  };
}

// ─── TLS Scanner API ──────────────────────────────────────────────────────────
function tlsScannerApiPlugin() {
  const cache = createAsyncCache<any>(15_000)

  return {
    name: 'tls-scanner-api',
    configureServer(server: any) {
      server.middlewares.use('/api/tlsscanner', async (req: any, res: any) => {
        const sendJson = (statusCode: number, payload: any) => {
          if (res.writableEnded) return;
          res.statusCode = statusCode;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(payload));
        };

        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const rawHost = url.searchParams.get('host') || '';
        const rawPort = url.searchParams.get('port') || '443';
        const refresh = url.searchParams.get('refresh') === 'true';

        if (!rawHost.trim()) {
          sendJson(400, { error: 'Missing "host" query parameter' });
          return;
        }

        // Sanitize host and port
        let host = rawHost.trim();
        let port = parseInt(rawPort, 10);
        if (isNaN(port) || port <= 0 || port > 65535) port = 443;

        if (host.includes('://')) {
          try {
            const parsed = new URL(host);
            host = parsed.hostname;
            if (parsed.port) port = parseInt(parsed.port, 10);
          } catch {
            host = host.replace(/^[a-zA-Z]+:\/\//, '');
            const slash = host.indexOf('/');
            if (slash !== -1) host = host.substring(0, slash);
          }
        }
        const slashIdx = host.indexOf('/');
        if (slashIdx !== -1) host = host.substring(0, slashIdx);

        if (host.startsWith('[')) {
          const endBracket = host.indexOf(']');
          if (endBracket !== -1) {
            const portPart = host.substring(endBracket + 1);
            if (portPart.startsWith(':')) {
              const p = parseInt(portPart.substring(1), 10);
              if (!isNaN(p)) port = p;
            }
            host = host.substring(1, endBracket);
          }
        } else if (host.includes(':')) {
          const parts = host.split(':');
          if (parts.length === 2 && !isNaN(Number(parts[1]))) {
            host = parts[0];
            port = parseInt(parts[1], 10);
          }
        }

        host = host.trim().toLowerCase();

        if (!host) {
          sendJson(400, { error: 'Invalid hostname provided' });
          return;
        }

        try {
          const resultPayload = await cache.getOrLoad(`tls:${host}:${port}`, refresh, async () => {
            const tls = await import('tls');
            const crypto = await import('crypto');
            const net = await import('net');
            const forgeModule = await import('node-forge');
            const forge = forgeModule.default || forgeModule;

            const isIp = net.isIP(host) !== 0;

            const options: any = {
              host,
              port,
              rejectUnauthorized: false,
            };
            if (!isIp) {
              options.servername = host;
            }

            return await new Promise<any>((resolve, reject) => {
              let finished = false;

              const socket = tls.connect(options, () => {
                if (finished) return;
                finished = true;

                try {
                  const peerCert = socket.getPeerCertificate(true);
                  if (!peerCert || !peerCert.raw) {
                    socket.destroy();
                    reject(new Error('Remote server did not present a certificate'));
                    return;
                  }

              const parseExtensionNode = (e: any) => {
                let ext: any;
                try {
                  ext = (forge.pki as any).certificateExtensionFromAsn1(e);
                } catch {
                  const rawOid = forge.asn1.derToOid(e.value[0].value);
                  ext = { id: rawOid };
                }

                const oid: string = ext.id || forge.asn1.derToOid(e.value[0].value);
                const critical: boolean = typeof ext.critical === 'boolean'
                  ? ext.critical
                  : (e.value.length === 3 ? !!e.value[1].value : false);
                let name: string = ext.name || (forge.pki.oids as any)[oid] || oid;
                let valStr = '';

                // 1. Key Usage (2.5.29.15)
                if (ext.name === 'keyUsage' || oid === '2.5.29.15') {
                  name = 'keyUsage';
                  const usages: string[] = [];
                  if (ext.digitalSignature) usages.push('Digital Signature');
                  if (ext.nonRepudiation) usages.push('Non-Repudiation');
                  if (ext.keyEncipherment) usages.push('Key Encipherment');
                  if (ext.dataEncipherment) usages.push('Data Encipherment');
                  if (ext.keyAgreement) usages.push('Key Agreement');
                  if (ext.keyCertSign) usages.push('Certificate Signing');
                  if (ext.cRLSign) usages.push('CRL Signing');
                  if (ext.encipherOnly) usages.push('Encipher Only');
                  if (ext.decipherOnly) usages.push('Decipher Only');
                  valStr = usages.join(', ');
                }
                // 2. Extended Key Usage (2.5.29.37)
                else if (ext.name === 'extKeyUsage' || oid === '2.5.29.37') {
                  name = 'extKeyUsage';
                  const ekus: string[] = [];
                  if (ext.serverAuth) ekus.push('Server Authentication (1.3.6.1.5.5.7.3.1)');
                  if (ext.clientAuth) ekus.push('Client Authentication (1.3.6.1.5.5.7.3.2)');
                  if (ext.codeSigning) ekus.push('Code Signing (1.3.6.1.5.5.7.3.3)');
                  if (ext.emailProtection) ekus.push('Email Protection (1.3.6.1.5.5.7.3.4)');
                  if (ext.timeStamping) ekus.push('Time Stamping (1.3.6.1.5.5.7.3.8)');
                  if (ext.ocspSigning) ekus.push('OCSP Signing (1.3.6.1.5.5.7.3.9)');

                  try {
                    const valAsn1 = e.value.length === 3 ? e.value[2] : e.value[1];
                    const innerAsn1 = forge.asn1.fromDer(valAsn1.value);
                    if (innerAsn1.value && Array.isArray(innerAsn1.value)) {
                      innerAsn1.value.forEach((item: any) => {
                        const itemOid = forge.asn1.derToOid(item.value);
                        const knownOids: Record<string, string> = {
                          '1.3.6.1.5.5.7.3.1': 'Server Authentication (1.3.6.1.5.5.7.3.1)',
                          '1.3.6.1.5.5.7.3.2': 'Client Authentication (1.3.6.1.5.5.7.3.2)',
                          '1.3.6.1.5.5.7.3.3': 'Code Signing (1.3.6.1.5.5.7.3.3)',
                          '1.3.6.1.5.5.7.3.4': 'Email Protection (1.3.6.1.5.5.7.3.4)',
                          '1.3.6.1.5.5.7.3.8': 'Time Stamping (1.3.6.1.5.5.7.3.8)',
                          '1.3.6.1.5.5.7.3.9': 'OCSP Signing (1.3.6.1.5.5.7.3.9)',
                        };
                        const label = knownOids[itemOid] || itemOid;
                        if (!ekus.includes(label)) ekus.push(label);
                      });
                    }
                  } catch {}
                  valStr = ekus.join(', ');
                }
                // 3. Basic Constraints (2.5.29.19)
                else if (ext.name === 'basicConstraints' || oid === '2.5.29.19') {
                  name = 'basicConstraints';
                  valStr = 'Is CA: ' + (ext.cA ? 'Yes' : 'No') + (ext.pathLenConstraint !== undefined ? ', Path Length Constraint: ' + ext.pathLenConstraint : '');
                }
                // 4. Subject Alternative Name (2.5.29.17)
                else if (ext.name === 'subjectAltName' || oid === '2.5.29.17') {
                  name = 'subjectAltName';
                  if (ext.altNames && ext.altNames.length > 0) {
                    valStr = ext.altNames.map((an: any) => {
                      const prefix = an.type === 2 ? 'DNS:' : an.type === 7 ? 'IP:' : an.type === 1 ? 'email:' : an.type === 6 ? 'URI:' : '';
                      return prefix + an.value;
                    }).join(', ');
                  } else {
                    valStr = '';
                  }
                }
                // 5. Subject Key Identifier (2.5.29.14)
                else if (ext.name === 'subjectKeyIdentifier' || oid === '2.5.29.14') {
                  name = 'subjectKeyIdentifier';
                  try {
                    const valAsn1 = e.value.length === 3 ? e.value[2] : e.value[1];
                    let bytes = valAsn1.value;
                    try {
                      const inner = forge.asn1.fromDer(bytes);
                      if (inner && inner.value && typeof inner.value === 'string') bytes = inner.value;
                    } catch {}
                    const hex = forge.util.bytesToHex(bytes).toUpperCase().match(/.{2}/g);
                    valStr = hex ? hex.join(':') : forge.util.bytesToHex(bytes).toUpperCase();
                  } catch {
                    valStr = ext.value || '';
                  }
                }
                // 6. Authority Key Identifier (2.5.29.35)
                else if (ext.name === 'authorityKeyIdentifier' || oid === '2.5.29.35') {
                  name = 'authorityKeyIdentifier';
                  try {
                    const valAsn1 = e.value.length === 3 ? e.value[2] : e.value[1];
                    const inner = forge.asn1.fromDer(valAsn1.value);
                    const keyIdObj = inner.value && Array.isArray(inner.value)
                      ? inner.value.find((item: any) => item.tagClass === 128 && item.type === 0)
                      : null;
                    if (keyIdObj && typeof keyIdObj.value === 'string') {
                      const hex = forge.util.bytesToHex(keyIdObj.value).toUpperCase().match(/.{2}/g);
                      valStr = 'KeyID: ' + (hex ? hex.join(':') : forge.util.bytesToHex(keyIdObj.value).toUpperCase());
                    } else if (typeof valAsn1.value === 'string') {
                      const hex = forge.util.bytesToHex(valAsn1.value).toUpperCase().match(/.{2}/g);
                      valStr = hex ? hex.join(':') : forge.util.bytesToHex(valAsn1.value).toUpperCase();
                    }
                  } catch {
                    valStr = ext.value || '';
                  }
                }
                // 7. Authority Information Access (1.3.6.1.5.5.7.1.1)
                else if (ext.name === 'authorityInfoAccess' || oid === '1.3.6.1.5.5.7.1.1') {
                  name = 'authorityInfoAccess';
                  const items: string[] = [];
                  try {
                    const valAsn1 = e.value.length === 3 ? e.value[2] : e.value[1];
                    const inner = forge.asn1.fromDer(valAsn1.value);
                    if (inner.value && Array.isArray(inner.value)) {
                      inner.value.forEach((accessDesc: any) => {
                        const methodOid = forge.asn1.derToOid(accessDesc.value[0].value);
                        const location = accessDesc.value[1].value;
                        const methodNames: Record<string, string> = {
                          '1.3.6.1.5.5.7.48.1': 'OCSP',
                          '1.3.6.1.5.5.7.48.2': 'CA Issuers',
                        };
                        const method = methodNames[methodOid] || methodOid;
                        items.push(method + ' - URI:' + location);
                      });
                    }
                  } catch {}
                  valStr = items.length > 0 ? items.join('\n') : (typeof ext.value === 'string' ? ext.value : '');
                }
                // 8. CRL Distribution Points (2.5.29.31)
                else if (ext.name === 'cRLDistributionPoints' || oid === '2.5.29.31') {
                  name = 'cRLDistributionPoints';
                  const uris: string[] = [];
                  try {
                    const valAsn1 = e.value.length === 3 ? e.value[2] : e.value[1];
                    const inner = forge.asn1.fromDer(valAsn1.value);
                    const findUris = (node: any) => {
                      if (!node) return;
                      if (typeof node.value === 'string' && (node.value.startsWith('http') || node.value.startsWith('ldap'))) {
                        uris.push('URI:' + node.value);
                      } else if (Array.isArray(node.value)) {
                        node.value.forEach(findUris);
                      }
                    };
                    findUris(inner);
                  } catch {}
                  valStr = uris.length > 0 ? uris.join('\n') : (typeof ext.value === 'string' ? ext.value : '');
                }
                // 9. Certificate Policies (2.5.29.32)
                else if (ext.name === 'certificatePolicies' || oid === '2.5.29.32') {
                  name = 'certificatePolicies';
                  const policies: string[] = [];
                  try {
                    const valAsn1 = e.value.length === 3 ? e.value[2] : e.value[1];
                    const inner = forge.asn1.fromDer(valAsn1.value);
                    if (inner.value && Array.isArray(inner.value)) {
                      inner.value.forEach((polInfo: any, idx: number) => {
                        const polOid = forge.asn1.derToOid(polInfo.value[0].value);
                        let policyText = '[' + (idx + 1) + ']Certificate Policy: Policy Identifier=' + polOid;
                        if (polInfo.value[1] && polInfo.value[1].value && Array.isArray(polInfo.value[1].value)) {
                          polInfo.value[1].value.forEach((qual: any, qIdx: number) => {
                            const qualOid = forge.asn1.derToOid(qual.value[0].value);
                            const qualVal = qual.value[1] && qual.value[1].value;
                            if (qualOid === '1.3.6.1.5.5.7.2.1') {
                              policyText += '\n[' + (idx + 1) + ',' + (qIdx + 1) + ']Policy Qualifier Info: CPS: ' + qualVal;
                            }
                          });
                        }
                        policies.push(policyText);
                      });
                    }
                  } catch {}
                  valStr = policies.length > 0 ? policies.join('\n') : (typeof ext.value === 'string' ? ext.value : '');
                }
                // 10. Timestamp List (SCTs - 1.3.6.1.4.1.11129.2.4.2)
                else if (oid === '1.3.6.1.4.1.11129.2.4.2' || ext.name === 'timestampList') {
                  name = 'timestampList';
                  try {
                    const valAsn1 = e.value.length === 3 ? e.value[2] : e.value[1];
                    let bytes = valAsn1.value;
                    try {
                      const inner = forge.asn1.fromDer(bytes);
                      if (inner && inner.value && typeof inner.value === 'string') bytes = inner.value;
                    } catch {}
                    valStr = 'Embedded Signed Certificate Timestamps (' + bytes.length + ' bytes)';
                  } catch {
                    valStr = 'Embedded Signed Certificate Timestamps';
                  }
                }
                // General Fallback
                else {
                  const rawVal = typeof ext.value === 'string' ? ext.value : '';
                  const isBinary = /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(rawVal);
                  if (isBinary || !rawVal) {
                    try {
                      const valObj = e.value.length === 3 ? e.value[2] : e.value[1];
                      const hex = forge.util.bytesToHex(valObj.value).toUpperCase().match(/.{2}/g);
                      valStr = hex ? hex.join(' ') : forge.util.bytesToHex(valObj.value).toUpperCase();
                    } catch {
                      valStr = rawVal ? forge.util.bytesToHex(rawVal).toUpperCase() : '';
                    }
                  } else {
                    valStr = rawVal;
                  }
                }

                return {
                  id: oid,
                  oid,
                  name,
                  critical,
                  value: valStr,
                };
              };

              const parseExtensionsFromRaw = (rawBuffer: Buffer) => {
                try {
                  const asn1: any = forge.asn1.fromDer(rawBuffer.toString('binary'));
                  const tbsCert = asn1.value[0];
                  const extWrapper = tbsCert.value.find(
                    (el: any) => el.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && el.type === 3
                  );
                  if (!extWrapper || !extWrapper.value || !extWrapper.value[0]) return [];
                  const extSeq = extWrapper.value[0];
                  return extSeq.value.map(parseExtensionNode);
                } catch {
                  return [];
                }
              };

              const serializeKeyDetails = (details: any) => {
                if (!details) return null;
                const clean: any = {};
                for (const [k, v] of Object.entries(details)) {
                  clean[k] = typeof v === 'bigint' ? v.toString() : v;
                }
                return clean;
              };

              const seen = new Set<string>();
              const chain: any[] = [];
              let currentCert = peerCert;

              while (currentCert && currentCert.raw) {
                if (seen.has(currentCert.fingerprint256)) break;
                seen.add(currentCert.fingerprint256);

                let x509: any = null;
                let pem = '';
                let subjectStr = '';
                let issuerStr = '';
                let keyType = '';
                let keyDetails: any = null;

                try {
                  x509 = new crypto.X509Certificate(currentCert.raw);
                  pem = x509.toString();
                  subjectStr = x509.subject ? x509.subject.split('\n').filter(Boolean).join(', ') : '';
                  issuerStr = x509.issuer ? x509.issuer.split('\n').filter(Boolean).join(', ') : '';
                  keyType = x509.publicKey?.asymmetricKeyType || '';
                  keyDetails = serializeKeyDetails(x509.publicKey?.asymmetricKeyDetails);
                } catch {}

                if (!subjectStr && currentCert.subject) {
                  subjectStr = typeof currentCert.subject === 'object'
                    ? Object.entries(currentCert.subject).map(([k, v]) => `${k}=${v}`).join(', ')
                    : String(currentCert.subject);
                }

                if (!issuerStr && currentCert.issuer) {
                  issuerStr = typeof currentCert.issuer === 'object'
                    ? Object.entries(currentCert.issuer).map(([k, v]) => `${k}=${v}`).join(', ')
                    : String(currentCert.issuer);
                }

                const subjectCN = currentCert.subject?.CN || (subjectStr.match(/CN=([^,]+)/)?.[1]) || subjectStr || 'Unknown';
                const issuerCN = currentCert.issuer?.CN || (issuerStr.match(/CN=([^,]+)/)?.[1]) || issuerStr || 'Unknown';
                const extensions = parseExtensionsFromRaw(currentCert.raw);

                let sans: string[] = [];
                if (x509?.subjectAltName) {
                  sans = x509.subjectAltName.split(',').map((s: string) => s.trim()).filter(Boolean);
                } else if (currentCert.subjectaltname) {
                  sans = currentCert.subjectaltname.split(',').map((s: string) => s.trim()).filter(Boolean);
                }

                chain.push({
                  subject: subjectStr,
                  issuer: issuerStr,
                  subjectCN,
                  issuerCN,
                  valid_from: currentCert.valid_from || (x509 ? x509.validFrom : ''),
                  valid_to: currentCert.valid_to || (x509 ? x509.validTo : ''),
                  fingerprint: currentCert.fingerprint || (x509 ? x509.fingerprint : ''),
                  fingerprint256: currentCert.fingerprint256 || (x509 ? x509.fingerprint256 : ''),
                  serialNumber: currentCert.serialNumber || (x509 ? x509.serialNumber : ''),
                  rawB64: currentCert.raw.toString('base64'),
                  pem,
                  keyType,
                  keyDetails,
                  ca: x509 ? x509.ca : !!currentCert.ca,
                  subjectAltNames: sans,
                  extensions,
                });

                if (!currentCert.issuerCertificate || currentCert.issuerCertificate === currentCert) {
                  break;
                }
                currentCert = currentCert.issuerCertificate;
              }

              const protocol = socket.getProtocol();
              const cipher = socket.getCipher();
              const authorized = socket.authorized;
              const authorizationError = socket.authorizationError ? String(socket.authorizationError) : null;

              socket.end();

              resolve({
                chain,
                protocol,
                cipher,
                authorized,
                authorizationError,
                host,
                port,
              });
            } catch (e: any) {
              socket.destroy();
              reject(new Error(`Failed to process certificate: ${e.message}`));
            }
          });

          socket.on('error', (err: any) => {
            if (finished) return;
            finished = true;
            socket.destroy();
            reject(new Error(`Connection failed: ${err.message}`));
          });

          socket.setTimeout(10000, () => {
            if (finished) return;
            finished = true;
            socket.destroy();
            const timeoutErr: any = new Error(`Connection to ${host}:${port} timed out after 10s`);
            timeoutErr.statusCode = 504;
            reject(timeoutErr);
          });
            });
          });

          sendJson(200, { data: resultPayload });
        } catch (error: any) {
          sendJson(error.statusCode || 500, { error: error.message || `Failed to scan TLS.` });
        }
      });
    },
    configurePreviewServer(server: any) {
      this.configureServer(server);
    }
  }
}

// ─── OCSP API ─────────────────────────────────────────────────────────────────
function ocspApiPlugin() {
  const cache = createAsyncCache<any>(30_000)

  return {
    name: 'ocsp-api',
    configureServer(server: any) {
      server.middlewares.use('/api/ocsp', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const refresh = url.searchParams.get('refresh') === 'true';
        
        let body = '';
        req.on('data', (chunk: Buffer) => {
           body += chunk.toString();
        });
        
        req.on('end', async () => {
           try {
              const data = JSON.parse(body);
              const b64 = data.certB64;
              if (!b64) throw new Error('certB64 is required');
              
              const certBuf = Buffer.from(b64, 'base64');
              let isValidCert = false;
              try {
                 new crypto.X509Certificate(certBuf);
                 isValidCert = true;
              } catch {
                 try {
                   new crypto.X509Certificate(`-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----`);
                   isValidCert = true;
                 } catch {
                   isValidCert = false;
                 }
              }

              if (!isValidCert) {
                 const rawStr = certBuf.toString('utf8');
                 let errorMsg = 'The provided data is not a valid X.509 certificate.';
                 if (rawStr.includes('CERTIFICATE REQUEST') || b64.includes('CERTIFICATE REQUEST')) {
                   errorMsg = 'The provided data is a Certificate Signing Request (CSR), not an issued X.509 certificate. CSRs do not have revocation status.';
                 } else if (rawStr.includes('PRIVATE KEY') || b64.includes('PRIVATE KEY')) {
                   errorMsg = 'The provided data is a Private Key, not an X.509 certificate.';
                 } else if (rawStr.includes('CRL') || b64.includes('CRL')) {
                   errorMsg = 'The provided data is a CRL, not an X.509 certificate.';
                 }
                 res.statusCode = 400;
                 res.setHeader('Content-Type', 'application/json');
                 res.end(JSON.stringify({ error: errorMsg }));
                 return;
              }

              const certHash = crypto.createHash('sha256').update(certBuf).digest('hex');
              const resultData = await cache.getOrLoad(`ocsp:${certHash}`, refresh || Boolean(data.refresh), async () => {
                const tmpdir = os.tmpdir();
                const certPath = path.join(tmpdir, `ocsp_check_${crypto.randomUUID()}.cer`);
                
                await fs.writeFile(certPath, certBuf);
                
                let output = '';
                try {
                   const { stdout } = await execFileAsync('certutil', ['-verify', '-urlfetch', certPath], {
                     timeout: 30000,
                     windowsHide: true,
                     maxBuffer: 8 * 1024 * 1024,
                   });
                   output = stdout;
                } catch (e: any) {
                   output = e.stdout || e.message;
                } finally {
                   try { await fs.unlink(certPath); } catch {}
                }
                
                const isRevoked = 
                  output.includes('CERT_TRUST_IS_REVOKED') || 
                  output.includes('Certificate is REVOKED') || 
                  output.includes('The certificate is revoked') ||
                  /CRYPT_E_REVOKED/i.test(output);

                const leafVerifiedOcsp = /Certificate OCSP\s*-+\s*Verified "OCSP"/i.test(output) || /Verified "OCSP"/i.test(output);
                const leafVerifiedCrl = /Certificate CDP\s*-+\s*Verified "Base CRL/i.test(output) || /Verified "Base CRL/i.test(output);
                const leafErrorStatusZero = /CertContext\[0\]\[0\]:[^\n]*dwErrorStatus=0/i.test(output);

                const isOk = !isRevoked && (
                  output.includes('Leaf certificate revocation check passed') ||
                  output.includes('certificate revocation check passed') ||
                  ((leafVerifiedOcsp || leafVerifiedCrl) && leafErrorStatusZero)
                );

                const status = isRevoked ? 'revoked' : (isOk ? 'good' : 'unknown');

                const ocspMatch = output.match(/Certificate OCSP\s*-+\s*([^\n]+)(?:\n\s*\[\d+\.\d+\]\s*([^\n\r]+))?/i);
                const cdpMatch = output.match(/Certificate CDP\s*-+\s*([^\n]+)(?:\n\s*\[\d+\.\d+\]\s*([^\n\r]+))?/i);

                return {
                  status,
                  output,
                  ocspVerified: leafVerifiedOcsp,
                  crlVerified: leafVerifiedCrl,
                  ocspUrl: ocspMatch && ocspMatch[2] ? ocspMatch[2].trim() : null,
                  crlUrl: cdpMatch && cdpMatch[2] ? cdpMatch[2].trim() : null,
                };
              });

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ data: resultData }));
           } catch (e: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: e.message }));
           }
        });
      });
    },
    configurePreviewServer(server: any) {
      this.configureServer(server);
    }
  }
}

// ─── CT SEARCH API ──────────────────────────────────────────────────────────────
function ctSearchApiPlugin() {
  const cache = createAsyncCache<any>(120_000)

  return {
    name: 'ct-search-api',
    configureServer(server: any) {
      server.middlewares.use('/api/ctsearch', async (req: any, res: any) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const domain = url.searchParams.get('domain');
        const refresh = url.searchParams.get('refresh') === 'true';
        
        if (!domain) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing "domain" query parameter' }));
          return;
        }

        const normDomain = domain.trim().toLowerCase();
        
        try {
          const payload = await cache.getOrLoad(`ct:${normDomain}`, refresh, async () => {
            // Primary attempt: crt.sh
            try {
              const fetchUrl = `https://crt.sh/?q=${encodeURIComponent(normDomain)}&output=json`;
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 6000);
              const response = await fetch(fetchUrl, {
                signal: controller.signal,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'application/json'
                }
              });
              clearTimeout(timeoutId);
              
              if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                  return { data, provider: 'crt.sh', rateLimited: false };
                }
              }
            } catch (crtErr: any) {
              console.warn(`crt.sh unavailable for ${normDomain} (${crtErr.message}), trying CertSpotter fallback...`);
            }

            // Fallback provider: CertSpotter API
            try {
              const csUrl = `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(normDomain)}&include_subdomains=true&expand=dns_names&expand=issuer`;
              const csController = new AbortController();
              const csTimeoutId = setTimeout(() => csController.abort(), 8000);
              const csResponse = await fetch(csUrl, {
                signal: csController.signal,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Accept': 'application/json'
                }
              });
              clearTimeout(csTimeoutId);

              if (csResponse.ok) {
                const csData = await csResponse.json();
                if (Array.isArray(csData) && csData.length > 0) {
                  const data = csData.map((item: any, idx: number) => ({
                    id: parseInt(item.id, 10) || (Date.now() - idx * 1000),
                    issuer_ca_id: 16418,
                    issuer_name: item.issuer?.name || item.issuer?.friendly_name || "Public Certificate Authority",
                    common_name: item.dns_names?.[0] || normDomain,
                    name_value: (item.dns_names || [normDomain]).join('\n'),
                    entry_timestamp: item.not_before,
                    not_before: item.not_before,
                    not_after: item.not_after,
                    serial_number: item.cert_sha256 || item.tbs_sha256 || String(item.id)
                  }));
                  return {
                    data,
                    provider: 'certspotter',
                    rateLimited: true,
                    primaryError: 'crt.sh rate-limited (429/502)'
                  };
                }
              }
            } catch (csErr: any) {
              console.warn(`CertSpotter fallback failed for ${normDomain}:`, csErr.message);
            }

            const unavailableErr: any = new Error('CT log providers (crt.sh & CertSpotter) are temporarily unavailable.');
            unavailableErr.statusCode = 502;
            throw unavailableErr;
          });

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(payload));
        } catch (error: any) {
          if (error.statusCode === 502) {
            res.statusCode = 502;
          } else {
            console.error(`CT Search failed:`, error.message);
            res.statusCode = 500;
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },
    configurePreviewServer(server: any) {
      this.configureServer(server);
    }
  }
}

// ─── SYSTEM SETTINGS API (OS Language & Color Scheme) ─────────────────────────
function systemSettingsApiPlugin() {
  const cache = createAsyncCache<any>(15_000)

  const queryRegValueAsync = async (keyPath: string, valueName: string): Promise<string> => {
    try {
      const { stdout } = await execFileAsync('reg', ['query', keyPath, '/v', valueName], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 1500,
      });
      return stdout;
    } catch {
      return '';
    }
  };

  const parseMultiSz = (raw: string): string[] => {
    const m = raw.match(/REG_MULTI_SZ\s+([^\r\n]+)/i);
    if (!m || !m[1]) return [];
    return m[1]
      .trim()
      .split('\\0')
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const parseSz = (raw: string): string => {
    const m = raw.match(/REG_SZ\s+([^\r\n]+)/i);
    return m && m[1] ? m[1].trim() : '';
  };

  const parseDword = (raw: string): number | null => {
    const m = raw.match(/REG_DWORD\s+(0x[0-9a-fA-F]+|\d+)/i);
    if (!m || !m[1]) return null;
    const val = m[1].trim();
    const num = parseInt(val, val.toLowerCase().startsWith('0x') ? 16 : 10);
    return Number.isNaN(num) ? null : num;
  };

  const normalizeSupportedLang = (tag: string): string | null => {
    if (!tag) return null;
    const lower = tag.trim().replace(/_/g, '-').toLowerCase();
    if (lower === 'sr-cyrl' || lower.startsWith('sr-cyrl-')) return 'sr-Cyrl';
    if (lower === 'sr-latn' || lower.startsWith('sr-latn-')) return 'bs';
    const primary = lower.split('-')[0];
    switch (primary) {
      case 'de':
        return 'de';
      case 'bs':
      case 'hr':
        return 'bs';
      case 'sr':
        return 'sr-Cyrl';
      case 'id':
      case 'in':
        return 'id';
      case 'pl':
        return 'pl';
      case 'en':
        return 'en';
      default:
        return null;
    }
  };

  const readSystemSettings = (bypassCache = false) =>
    cache.getOrLoad('system-settings', bypassCache, async () => {
      let userLanguages: string[] = [];
      let uiLanguages: string[] = [];
      let locale = '';
      let region = '';
      let colorScheme: 'light' | 'dark' | null = null;

      if (process.platform === 'win32') {
        const [rawUserLangs, rawUiLangs, rawLocale, rawRegion, rawAppsLight, rawSysLight] =
          await Promise.all([
            queryRegValueAsync('HKCU\\Control Panel\\International\\User Profile', 'Languages'),
            queryRegValueAsync('HKCU\\Control Panel\\Desktop', 'PreferredUILanguages'),
            queryRegValueAsync('HKCU\\Control Panel\\International', 'LocaleName'),
            queryRegValueAsync('HKCU\\Control Panel\\International\\Geo', 'Name'),
            queryRegValueAsync('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', 'AppsUseLightTheme'),
            queryRegValueAsync('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', 'SystemUsesLightTheme'),
          ]);

        userLanguages = parseMultiSz(rawUserLangs);
        uiLanguages = parseMultiSz(rawUiLangs);
        locale = parseSz(rawLocale);
        region = parseSz(rawRegion);

        const appsLight = parseDword(rawAppsLight);
        if (appsLight === 1) {
          colorScheme = 'light';
        } else if (appsLight === 0) {
          colorScheme = 'dark';
        } else {
          const sysLight = parseDword(rawSysLight);
          if (sysLight === 1) colorScheme = 'light';
          else if (sysLight === 0) colorScheme = 'dark';
        }
      }

      if (!locale) {
        try {
          locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
        } catch {
          locale = process.env.LANG || process.env.LC_ALL || 'en-US';
        }
      }

      if (userLanguages.length === 0 && locale) {
        userLanguages = [locale];
      }

      let preferredAppLanguage = 'en';
      const candidates = [...userLanguages, ...uiLanguages, locale];
      for (const c of candidates) {
        const norm = normalizeSupportedLang(c);
        if (norm) {
          preferredAppLanguage = norm;
          break;
        }
      }

      return {
        userLanguages,
        uiLanguages,
        locale,
        region,
        preferredAppLanguage,
        colorScheme,
      };
    });

  return {
    name: 'system-settings-api',
    async transformIndexHtml(html: string, ctx: any) {
      if (!ctx?.server) return html;
      try {
        const settings = await readSystemSettings();
        const scriptTag = `<script>window.__SYSTEM_SETTINGS__ = ${JSON.stringify(settings)};</script>`;
        return html.replace('</head>', `  ${scriptTag}\n  </head>`);
      } catch {
        return html;
      }
    },
    configureServer(server: any) {
      server.middlewares.use('/api/system-settings', async (req: any, res: any) => {
        try {
          const url = new URL(req.url || '', `http://${req.headers.host}`);
          const refresh = url.searchParams.get('refresh') === 'true';
          const settings = await readSystemSettings(refresh);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ data: settings }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
    configurePreviewServer(server: any) {
      this.configureServer(server);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), systemSettingsApiPlugin(), secureBootApiPlugin(), certStoreApiPlugin(), tlsScannerApiPlugin(), ocspApiPlugin(), ctSearchApiPlugin()],
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: 'vendor-i18n',
              test: /[\\/]node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector)[\\/]/,
              priority: 25,
            },
            {
              name: 'vendor-forge',
              test: /[\\/]node_modules[\\/]node-forge[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor-icons',
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              priority: 15,
            },
          ],
        },
      },
    },
  },
})
