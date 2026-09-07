$r = Invoke-RestMethod 'http://localhost:5173/api/certstore?store=Root&location=CurrentUser'
$certs = $r.data
Write-Host "Total certs:" $certs.Count
$expired = $certs | Where-Object { $_.isExpired -eq $true }
Write-Host "Expired certs:" $expired.Count
$first = $certs | Select-Object -First 1
Write-Host "isExpired type:" $first.isExpired.GetType().Name
Write-Host "isExpired value:" $first.isExpired
