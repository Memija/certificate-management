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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), secureBootApiPlugin()],
})
