Set-Location 'D:\Mineradio-derivative-work\signaling-deploy'
Start-Job -ScriptBlock { Set-Location 'D:\Mineradio-derivative-work\signaling-deploy'; node server.js }
Start-Sleep -Seconds 4
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:8080/health' -UseBasicParsing -TimeoutSec 5
  Write-Host "Server OK: $($r.Content)"
} catch {
  Write-Host "Server FAILED: $($_.Exception.Message)"
}