<#
  Compila e firma il pacchetto .wgt dell'app IPTVPlayer.
  Uso:
    .\scripts\build.ps1
#>

$ErrorActionPreference = "Stop"

$TizenCli   = "C:\tizen-studio\tools\ide\bin\tizen.bat"
$ProfileName = "iptv-certificate"
$ProjectDir = Split-Path -Parent $PSScriptRoot
$BuildResultDir = Join-Path $ProjectDir ".buildResult"

Write-Host "Progetto: $ProjectDir" -ForegroundColor Cyan

Write-Host "`n== Build ==" -ForegroundColor Cyan
& $TizenCli build-web -- $ProjectDir
if ($LASTEXITCODE -ne 0) { throw "Build fallita (exit code $LASTEXITCODE)." }

Write-Host "`n== Packaging e firma ==" -ForegroundColor Cyan
& $TizenCli package -t wgt -s $ProfileName -- $BuildResultDir
if ($LASTEXITCODE -ne 0) { throw "Packaging fallito (exit code $LASTEXITCODE)." }

$wgt = Get-ChildItem -Path $BuildResultDir -Filter "*.wgt" | Select-Object -First 1
if (-not $wgt) { throw "Nessun file .wgt trovato in $BuildResultDir." }

Write-Host "`nPacchetto pronto: $($wgt.FullName)" -ForegroundColor Green
Write-Host "Ora puoi lanciare .\scripts\deploy.ps1 per installarlo sulle TV." -ForegroundColor Green
