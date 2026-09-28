import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs/promises'

const execAsync = promisify(exec)

function secureBootApiPlugin() {
  return {
    name: 'secure-boot-api',
    configureServer(server: any) {
      server.middlewares.use('/api/secureboot', async (req: any, res: any) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const varName = url.searchParams.get('var');
        const elevate = url.searchParams.get('elevate') === 'true';
        
        if (!varName) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing "var" query parameter' }));
          return;
        }

        try {
          let resultData: any;

          if (varName === 'all') {
            const varsToFetch = ['PK', 'KEK', 'db', 'dbx'];
            
            if (elevate) {
              const tmpdir = os.tmpdir();
              const outPath = path.join(tmpdir, `secureboot_all_out.json`);
              const scriptPath = path.join(tmpdir, `secureboot_all_get.ps1`);
              
              try { await fs.unlink(outPath); } catch (e) {}
              try { await fs.unlink(scriptPath); } catch (e) {}

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
    $results | ConvertTo-Json | Out-File -FilePath '${outPath}' -Encoding utf8
} catch {
    $_.Exception.Message | Out-File -FilePath '${outPath}' -Encoding utf8
}
`;
              await fs.writeFile(scriptPath, psScript, 'utf8');

              const command = `powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \\"${scriptPath}\\"' -Verb RunAs -Wait"`;
              await execAsync(command);

              const output = await fs.readFile(outPath, 'utf8');
              const cleanOutput = output.replace(/^\uFEFF/, '').trim();
              try {
                  resultData = JSON.parse(cleanOutput);
              } catch {
                  throw new Error(`Elevated process error: ${cleanOutput}`);
              }

              try { await fs.unlink(outPath); } catch (e) {}
              try { await fs.unlink(scriptPath); } catch (e) {}
            } else {
              // Normal unelevated attempt
              resultData = {};
              for (const v of varsToFetch) {
                 const command = `powershell.exe -NoProfile -Command "try { $b=(Get-SecureBootUEFI -Name ${v}).Bytes; if ($b) { [Convert]::ToBase64String($b) } } catch {}"`;
                 const { stdout } = await execAsync(command);
                 const base64Str = stdout.trim();
                 if (base64Str) {
                     resultData[v] = base64Str;
                 }
              }
              // If we failed to get anything and we know at least db should exist, we throw
              if (Object.keys(resultData).length === 0) {
                 throw new Error("Access was denied");
              }
            }
          } else {
             // Handle single variable fetch (legacy support)
             let base64Str = '';
             if (elevate) {
                const tmpdir = os.tmpdir();
                const outPath = path.join(tmpdir, `secureboot_${varName}_out.txt`);
                const scriptPath = path.join(tmpdir, `secureboot_${varName}_get.ps1`);
                
                try { await fs.unlink(outPath); } catch (e) {}
                try { await fs.unlink(scriptPath); } catch (e) {}

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

                const command = `powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \\"${scriptPath}\\"' -Verb RunAs -Wait"`;
                await execAsync(command);

                const output = await fs.readFile(outPath, 'utf8');
                base64Str = output.trim();

                try { await fs.unlink(outPath); } catch (e) {}
                try { await fs.unlink(scriptPath); } catch (e) {}

                if (base64Str.includes(' ')) {
                    throw new Error(`Elevated process error: ${base64Str}`);
                }
             } else {
                const command = `powershell.exe -NoProfile -Command "[Convert]::ToBase64String((Get-SecureBootUEFI -Name ${varName}).Bytes)"`;
                const { stdout } = await execAsync(command);
                base64Str = stdout.trim();
             }
             if (!base64Str) {
               res.statusCode = 404;
               res.end(JSON.stringify({ error: `Variable ${varName} not found or empty.` }));
               return;
             }
             resultData = base64Str;
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ data: resultData }));
        } catch (error: any) {
          console.error(`Failed to get Secure Boot variable ${varName}:`, error.message);
          res.statusCode = 500;
          res.end(JSON.stringify({ 
            error: `Failed to access variable. ${error.message}` 
          }));
        }
      });
    }
  }
}

// ─── Windows Certificate Store API ───────────────────────────────────────────
function certStoreApiPlugin() {
  return {
    name: 'cert-store-api',
    configureServer(server: any) {
      server.middlewares.use('/api/certstore', async (req: any, res: any) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const storeName   = url.searchParams.get('store')    || 'Root';
        const storeLocation = url.searchParams.get('location') || 'CurrentUser';
        const elevate     = url.searchParams.get('elevate')  === 'true';

        // Allowlist to prevent injection
        const VALID_STORES    = ['Root', 'CA', 'My', 'TrustedPublisher', 'Disallowed'];
        const VALID_LOCATIONS = ['CurrentUser', 'LocalMachine'];
        if (!VALID_STORES.includes(storeName) || !VALID_LOCATIONS.includes(storeLocation)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid store or location parameter' }));
          return;
        }

        const tmpdir    = os.tmpdir();
        const runId     = crypto.randomUUID();
        const outPath   = path.join(tmpdir, `certstore_out_${runId}.json`);
        const scriptPath = path.join(tmpdir, `certstore_get_${runId}.ps1`);

        // PowerShell script — enumerates the store, exports each cert to temp DER,
        // builds a JSON array, then cleans up the temp cert files.
        const psScript = `
$ErrorActionPreference = 'Stop'
$results = @()
try {
    $storePath = "Cert:\\\\${storeLocation}\\\\${storeName}"
    $certs = Get-ChildItem -Path $storePath -ErrorAction Stop
    foreach ($cert in $certs) {
        try {
            $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
            $b64 = [Convert]::ToBase64String($certBytes)

            # Extract EKU/Key Usage from extensions
            $purposes = @()
            $ku = $cert.Extensions | Where-Object { $_.Oid.FriendlyName -eq "Key Usage" }
            if ($ku) {
                $kuRaw = $ku.Format(0) -replace '\\s*\\([^)]*\\)', ''
                foreach ($part in ($kuRaw -split ',')) {
                    $trimmed = $part.Trim()
                    if ($trimmed -and -not ($purposes -contains $trimmed)) { $purposes += $trimmed }
                }
            }
            $eku = $cert.Extensions | Where-Object { $_.Oid.FriendlyName -eq "Enhanced Key Usage" }
            if ($eku) {
                foreach ($u in $eku.EnhancedKeyUsages) {
                    $trimmed = $u.FriendlyName.Trim()
                    if ($trimmed -and -not ($purposes -contains $trimmed)) { $purposes += $trimmed }
                }
            }
            if ($purposes.Count -eq 0) { $purposes += "General Purpose" }

            # Collect all extensions
            $exts = @()
            foreach ($ext in $cert.Extensions) {
                try {
                    $exts += [PSCustomObject]@{
                        name     = if ($ext.Oid.FriendlyName) { $ext.Oid.FriendlyName } else { $ext.Oid.Value }
                        oid      = $ext.Oid.Value
                        critical = $ext.Critical
                        value    = try { $ext.Format(0) } catch { "" }
                    }
                } catch {}
            }

            $pubKeyAlg = ""
            $pubKeySize = $null
            try {
                $pubKeyAlg = $cert.PublicKey.Oid.FriendlyName
                if ($cert.PublicKey.Key) {
                    $pubKeySize = $cert.PublicKey.Key.KeySize
                }
            } catch {}

            $now = Get-Date
            $thirtyDays = $now.AddDays(30)
            $isExpired     = $cert.NotAfter -lt $now
            $expiringSoon  = (-not $isExpired) -and ($cert.NotAfter -lt $thirtyDays)

            $isSelfSigned = ($cert.Subject -eq $cert.Issuer)
            $bc = $cert.Extensions | Where-Object { $_.Oid.Value -eq "2.5.29.19" -or $_.Oid.Value -eq "2.5.29.10" -or $_.Oid.FriendlyName -eq "Basic Constraints" }
            $isCA = $false
            if ($bc -is [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]) {
                $isCA = [bool]$bc.CertificateAuthority
            } elseif ($bc) {
                $formatted = $bc.Format($false)
                $isCA = ($formatted -match "CA" -or $formatted -match "IsCertificateAuthority=True")
            } else {
                $isCA = $isSelfSigned
            }
            $isRoot = $isCA -and $isSelfSigned
            $isIntermediate = $isCA -and (-not $isRoot)

            $results += [PSCustomObject]@{
                thumbprint        = $cert.Thumbprint
                subject           = $cert.Subject
                issuer            = $cert.Issuer
                notBefore         = $cert.NotBefore.ToString("o")
                notAfter          = $cert.NotAfter.ToString("o")
                serialNumber      = $cert.SerialNumber
                signatureAlgorithm = $cert.SignatureAlgorithm.FriendlyName
                publicKeyAlgorithm = $pubKeyAlg
                publicKeySize      = $pubKeySize
                friendlyName      = $cert.FriendlyName
                purposes          = $purposes
                isRoot            = $isRoot
                isIntermediate    = $isIntermediate
                isExpired         = $isExpired
                isExpiringSoon    = $expiringSoon
                certB64           = $b64
                extensions        = $exts
            }
        } catch {
            # Skip certs that fail individual export
        }
    }
    ConvertTo-Json -InputObject @($results) -Depth 5 | Out-File -FilePath '${outPath}' -Encoding utf8
} catch {
    [PSCustomObject]@{ error = $_.Exception.Message } | ConvertTo-Json | Out-File -FilePath '${outPath}' -Encoding utf8
}
`;

        try {
          try { await fs.unlink(outPath); } catch {}
          await fs.writeFile(scriptPath, psScript, 'utf8');

          let command: string;
          if (elevate) {
            command = `powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \\"${scriptPath}\\"' -Verb RunAs -Wait"`;
          } else {
            command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`;
          }

          await execAsync(command, { timeout: 30000 });

          const raw = await fs.readFile(outPath, 'utf8');
          const clean = raw.replace(/^\uFEFF/, '').trim();

          try { await fs.unlink(outPath); } catch {}
          try { await fs.unlink(scriptPath); } catch {}

          let parsed: any;
          try { parsed = JSON.parse(clean); } catch {
            throw new Error(`Could not parse PowerShell output: ${clean.substring(0, 200)}`);
          }

          // PowerShell may return an error object instead of array
          if (parsed && !Array.isArray(parsed) && parsed.error) {
            const msg: string = parsed.error;
            res.statusCode = 500;
            res.end(JSON.stringify({ error: msg }));
            return;
          }

          // PowerShell returns a single object (not array) when there's only 1 cert
          const certsArray: any[] = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);

          // Map certificates with native Windows .NET classification and standard RFC 7468 PEM
          const enriched = certsArray.map((entry: any) => {
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

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ data: enriched }));
        } catch (error: any) {
          try { await fs.unlink(outPath); } catch {}
          try { await fs.unlink(scriptPath); } catch {}

          const msg: string = error.message || String(error);
          console.error('[certstore]', msg);

          res.statusCode = 500;
          res.end(JSON.stringify({ error: msg }));
        }
      });
    },
  };
}

// ─── TLS Scanner API ──────────────────────────────────────────────────────────
function tlsScannerApiPlugin() {
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

          let finished = false;

          const socket = tls.connect(options, () => {
            if (finished) return;
            finished = true;

            try {
              const peerCert = socket.getPeerCertificate(true);
              if (!peerCert || !peerCert.raw) {
                socket.destroy();
                sendJson(500, { error: 'Remote server did not present a certificate' });
                return;
              }

              const parseExtensionsFromRaw = (rawBuffer: Buffer) => {
                try {
                  const asn1: any = forge.asn1.fromDer(rawBuffer.toString('binary'));
                  const tbsCert = asn1.value[0];
                  const extWrapper = tbsCert.value.find(
                    (el: any) => el.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && el.type === 3
                  );
                  if (!extWrapper || !extWrapper.value || !extWrapper.value[0]) return [];
                  const extSeq = extWrapper.value[0];
                  return extSeq.value.map((e: any) => {
                    try {
                      const ext = (forge.pki as any).certificateExtensionFromAsn1(e);
                      return {
                        id: ext.id,
                        oid: ext.id,
                        name: ext.name || ext.id,
                        critical: !!ext.critical,
                        value: typeof ext.value === 'string' ? ext.value : JSON.stringify(ext.value),
                      };
                    } catch {
                      const oid = forge.asn1.derToOid(e.value[0].value);
                      const critical = e.value.length === 3 ? !!e.value[1].value : false;
                      const valObj = e.value.length === 3 ? e.value[2] : e.value[1];
                      let valStr = '';
                      try {
                        valStr = forge.util.bytesToHex(valObj.value);
                      } catch {
                        valStr = '';
                      }
                      return {
                        id: oid,
                        oid,
                        name: (forge.pki.oids as any)[oid] || oid,
                        critical,
                        value: valStr,
                      };
                    }
                  });
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

              sendJson(200, {
                data: {
                  chain,
                  protocol,
                  cipher,
                  authorized,
                  authorizationError,
                  host,
                  port,
                },
              });
            } catch (e: any) {
              socket.destroy();
              sendJson(500, { error: `Failed to process certificate: ${e.message}` });
            }
          });

          socket.on('error', (err: any) => {
            if (finished) return;
            finished = true;
            socket.destroy();
            sendJson(500, { error: `Connection failed: ${err.message}` });
          });

          socket.setTimeout(10000, () => {
            if (finished) return;
            finished = true;
            socket.destroy();
            sendJson(504, { error: `Connection to ${host}:${port} timed out after 10s` });
          });

        } catch (error: any) {
          sendJson(500, { error: `Failed to scan TLS. ${error.message}` });
        }
      });
    }
  }
}

// ─── OCSP API ─────────────────────────────────────────────────────────────────
function ocspApiPlugin() {
  return {
    name: 'ocsp-api',
    configureServer(server: any) {
      server.middlewares.use('/api/ocsp', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }
        
        let body = '';
        req.on('data', (chunk: Buffer) => {
           body += chunk.toString();
        });
        
        req.on('end', async () => {
           try {
              const data = JSON.parse(body);
              const b64 = data.certB64;
              if (!b64) throw new Error('certB64 is required');
              
              const tmpdir = os.tmpdir();
              const certPath = path.join(tmpdir, `ocsp_check_${Date.now()}.cer`);
              
              await fs.writeFile(certPath, Buffer.from(b64, 'base64'));
              
              const command = `certutil -verify -urlfetch "${certPath}"`;
              let output = '';
              try {
                 const { stdout } = await execAsync(command, { timeout: 30000 });
                 output = stdout;
              } catch (e: any) {
                 output = e.stdout || e.message;
              }
              
              try { await fs.unlink(certPath); } catch {}
              
              const isRevoked = output.includes('REVOKED') || output.includes('Revoked');
              const isOk = output.includes('Leaf certificate revocation check passed') || output.includes('certificate revocation check passed');
              const status = isRevoked ? 'revoked' : (isOk ? 'good' : 'unknown');
              
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                 data: {
                    status,
                    output
                 }
              }));
           } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
           }
        });
      });
    }
  }
}

// ─── CT SEARCH API ──────────────────────────────────────────────────────────────
function ctSearchApiPlugin() {
  return {
    name: 'ct-search-api',
    configureServer(server: any) {
      server.middlewares.use('/api/ctsearch', async (req: any, res: any) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const domain = url.searchParams.get('domain');
        
        if (!domain) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing "domain" query parameter' }));
          return;
        }
        
        try {
          const fetchUrl = `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`;
          const response = await fetch(fetchUrl);
          
          if (!response.ok) {
            throw new Error(`crt.sh returned ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ data }));
        } catch (error: any) {
          console.error(`CT Search failed:`, error.message);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), secureBootApiPlugin(), certStoreApiPlugin(), tlsScannerApiPlugin(), ocspApiPlugin(), ctSearchApiPlugin()],
})
