$ErrorActionPreference = 'Stop'
$cert = Get-ChildItem Cert:\CurrentUser\Root | Select-Object -First 1
$bytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
$b64 = [Convert]::ToBase64String($bytes)
Write-Output $b64.Length
