param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('1.1.2', '1.1.3', '1.1.4', '1.1.5')]
  [string]$Version
)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sevenZip = Join-Path $root 'node_modules\electron-winstaller\vendor\7z-x64.exe'
$installer = Join-Path $root "dist\Mineradio-Mikalinsa-$Version-Setup.exe"
$work = Join-Path $root "tmp\corresponding-source\$Version"
$outer = Join-Path $work 'outer'
$stage = Join-Path $work "Mineradio-Mikalinsa-$Version-Corresponding-Source"
$archive = Join-Path $root "dist\Mineradio-Mikalinsa-$Version-Corresponding-Source.zip"

if (-not (Test-Path -LiteralPath $sevenZip)) { throw 'Bundled 7-Zip tool is unavailable. Run npm ci first.' }
if (-not (Test-Path -LiteralPath $installer)) { throw "Installer not found: $installer" }

New-Item -ItemType Directory -Force -Path $outer, $stage | Out-Null

& $sevenZip e $installer "-o$outer" '$PLUGINSDIR\app-64.7z' -y | Out-Null
$appArchive = Join-Path $outer 'app-64.7z'
if (-not (Test-Path -LiteralPath $appArchive)) { throw 'Installer does not contain app-64.7z.' }

& $sevenZip x $appArchive "-o$stage" 'resources\app\*' `
  '-xr!resources\app\node_modules' '-xr!resources\app\resources\obs' -y | Out-Null

$appRoot = Join-Path $stage 'resources\app'
$runtimePackage = Get-Content (Join-Path $appRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($runtimePackage.version -ne $Version) {
  throw "Installer runtime version $($runtimePackage.version) does not match requested version $Version."
}

$support = Join-Path $stage 'build-support'
New-Item -ItemType Directory -Force -Path $support | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'build') -Destination $support -Recurse -Force
Copy-Item -LiteralPath (Join-Path $root 'scripts') -Destination $support -Recurse -Force
Get-ChildItem -LiteralPath (Join-Path $support 'build') -Filter '*.log' -File -ErrorAction SilentlyContinue |
  Remove-Item -Force
Copy-Item -LiteralPath (Join-Path $root 'package-lock.json') -Destination $support -Force
Copy-Item -LiteralPath (Join-Path $root 'package.json') -Destination (Join-Path $support 'package.build-reference.json') -Force

foreach ($file in @('LICENSE', 'NOTICE.md', 'THIRD_PARTY_NOTICES.md', 'SOURCE_OFFER.md', 'BUILDING.md')) {
  Copy-Item -LiteralPath (Join-Path $root $file) -Destination $stage -Force
}

$readme = @"
# Mineradio Mikalinsa Edition v$Version corresponding source

`resources/app/` is the exact unpacked Electron application source recovered
from `Mineradio-Mikalinsa-$Version-Setup.exe`. The installer was treated as an
archive and was not executed.

Generated dependencies (`node_modules/`) and the portable OBS binary tree are
excluded. Their versions, licenses and source locations are documented in
`THIRD_PARTY_NOTICES.md`. `build-support/` contains the maintained installer
scripts and dependency lockfile used to support rebuilding and inspection.

This archive is distributed under the licenses stated in `LICENSE` and
`THIRD_PARTY_NOTICES.md`.
"@
Set-Content -LiteralPath (Join-Path $stage 'README.md') -Value $readme -Encoding UTF8

Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $archive -Force -CompressionLevel Optimal
$hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$archive.sha256.txt" -Encoding ASCII -Value "$hash  $([IO.Path]::GetFileName($archive))"
Write-Output $archive
