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
        const outPath   = path.join(tmpdir, `certstore_out_${Date.now()}.json`);
        const scriptPath = path.join(tmpdir, `certstore_get_${Date.now()}.ps1`);

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
            $tempCer = [System.IO.Path]::GetTempFileName() + ".cer"
            Export-Certificate -Cert $cert -FilePath $tempCer -Type CERT -Force | Out-Null
            $certBytes = [System.IO.File]::ReadAllBytes($tempCer)
            Remove-Item $tempCer -Force -ErrorAction SilentlyContinue

            $b64 = [Convert]::ToBase64String($certBytes)

            # Extract EKU/Key Usage from extensions
            $purposes = @()
            $ku = $cert.Extensions | Where-Object { $_.Oid.FriendlyName -eq "Key Usage" }
            if ($ku) { $purposes += $ku.Format(0) }
            $eku = $cert.Extensions | Where-Object { $_.Oid.FriendlyName -eq "Enhanced Key Usage" }
            if ($eku) { foreach ($u in $eku.EnhancedKeyUsages) { $purposes += $u.FriendlyName } }
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
                isExpired         = $isExpired
                isExpiringSoon    = $expiringSoon
                certB64           = $b64
                extensions        = $exts
            }
        } catch {
            # Skip certs that fail individual export
        }
    }
    $results | ConvertTo-Json -Depth 5 | Out-File -FilePath '${outPath}' -Encoding utf8
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

          // Parse DER bytes with node-forge to get isRoot/isIntermediate and PEM
          const forge = await import('node-forge');
          const enriched = certsArray.map((entry: any) => {
            let isRoot = false;
            let isIntermediate = false;
            let pem = '';
            let extensions: any[] = entry.extensions || [];

            try {
              const derStr = forge.default.util.createBuffer(
                Buffer.from(entry.certB64, 'base64')
              ).getBytes();
              const asn1 = forge.default.asn1.fromDer(derStr);
              const cert = forge.default.pki.certificateFromAsn1(asn1);
              const bc = cert.getExtension('basicConstraints') as any;
              const isCA = bc ? bc.cA : false;
              isRoot = isCA && cert.issuer.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(',')
                === cert.subject.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(',');
              isIntermediate = isCA && !isRoot;
              pem = forge.default.pki.certificateToPem(cert);
            } catch { /* skip forge enrichment */ }

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
              isRoot,
              isIntermediate,
              isExpired:          entry.isExpired || false,
              isExpiringSoon:     entry.isExpiringSoon || false,
              pem,
              certB64:            entry.certB64 || '',
              extensions,
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), secureBootApiPlugin(), certStoreApiPlugin()],
})
