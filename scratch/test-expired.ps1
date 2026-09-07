$r = Invoke-RestMethod 'http://localhost:5173/api/certstore?store=Root&location=CurrentUser'
$certs = $r.data
# Check expired certificates specifically
$expired = $certs | Where-Object { $_.isExpired -eq $true }
Write-Host "=== Expired Certs ==="
$expired | ForEach-Object { 
    Write-Host "Subject: $($_.subject.Substring(0, [Math]::Min(50, $_.subject.Length)))"
    Write-Host "isExpired value:" $_.isExpired
    Write-Host "isExpired raw type:" $_.isExpired.GetType().FullName
    Write-Host "---"
}
Write-Host "Total expired:" $expired.Count

# Also check if the data wrapping is correct
Write-Host "`n=== API response structure ==="
Write-Host "r type:" $r.GetType().Name
Write-Host "r.data type:" $r.data.GetType().Name
