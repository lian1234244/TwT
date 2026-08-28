$cfPath = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$ErrorActionPreference = "SilentlyContinue"
Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
Start-Process -FilePath $cfPath -ArgumentList "tunnel","--url","localhost:8080" -WindowStyle Minimized -RedirectStandardError "D:\Mineradio-derivative-work\signaling-deploy\cf-err.txt"
Start-Sleep -Seconds 15
$content = Get-Content "D:\Mineradio-derivative-work\signaling-deploy\cf-err.txt" -ErrorAction SilentlyContinue
$url = ""
foreach ($line in $content) {
    if ($line -match "https://([a-z0-9-]+)\.trycloudflare\.com") {
        $url = $matches[0]
        break
    }
}
if ($url) {
    $wssUrl = $url -replace "https://", "wss://"
    Write-Output "TUNNEL_URL:$wssUrl"
    # GitHub 令牌从环境变量读取，避免硬编码泄露（脚本运行前先设置 TWT_GITHUB_TOKEN）
    $token = $env:TWT_GITHUB_TOKEN
    if ($token) {
        $headers = @{Authorization="token $token"; Accept="application/vnd.github+json"}
        $newContent = "{`"url`":`"$wssUrl`"}"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($newContent)
        $base64 = [Convert]::ToBase64String($bytes)
        try {
            $resp = Invoke-RestMethod -Uri "https://api.github.com/repos/lian1234244/twt-signaling/contents/server-config.json" -Headers $headers
            $sha = $resp.sha
            $body = @{message="update server url"; content=$base64; sha=$sha} | ConvertTo-Json
        } catch {
            $body = @{message="add server config"; content=$base64} | ConvertTo-Json
        }
        Invoke-RestMethod -Uri "https://api.github.com/repos/lian1234244/twt-signaling/contents/server-config.json" -Method Put -Headers $headers -Body $body -ContentType "application/json"
        Write-Output "GITHUB_UPDATED:YES"
    } else {
        Write-Output "GITHUB_UPDATED:SKIPPED_NO_TOKEN"
    }
} else {
    Write-Output "TUNNEL_URL:NOT_FOUND"
}