<#
  Installa l'ultimo pacchetto .wgt buildato su una Smart TV Samsung,
  connettendosi via rete locale (SDB su porta 26101).

  Prerequisiti sulla TV: Developer mode ON, con l'IP di questo PC
  impostato nel campo "Host PC IP" (menu Developer mode: digita 12345
  nell'app "Apps").

  Uso:
    .\scripts\deploy.ps1 -Tv 192.168.1.50

  Per installare su piu' TV, rilancia lo script una volta per ciascuna,
  cambiando -Tv.
#>

param(
  [Parameter(Mandatory = $true)]
  [string]$Tv
)

$ErrorActionPreference = "Continue"

$TizenCli   = "C:\tizen-studio\tools\ide\bin\tizen.bat"
$Sdb        = "C:\tizen-studio\tools\sdb.exe"
$ProjectDir = Split-Path -Parent $PSScriptRoot
$BuildResultDir = Join-Path $ProjectDir ".buildResult"
$Port = 26101

$wgt = Get-ChildItem -Path $BuildResultDir -Filter "*.wgt" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $wgt) {
  Write-Host "Nessun file .wgt trovato in $BuildResultDir. Esegui prima .\scripts\build.ps1" -ForegroundColor Red
  exit 1
}
Write-Host "Pacchetto da installare: $($wgt.FullName)" -ForegroundColor Cyan

Write-Host "`n== $Tv ==" -ForegroundColor Cyan
$target = "${Tv}:${Port}"

& $Sdb connect $target | Write-Host
Start-Sleep -Seconds 1

$deviceLines = & $Sdb devices
$deviceLine = $deviceLines | Where-Object { $_ -match [regex]::Escape($Tv) } | Select-Object -First 1
if (-not $deviceLine) {
  Write-Host "Impossibile connettersi a $Tv. Verifica che la TV sia in Developer mode, sulla stessa rete, e con l'IP di questo PC configurato." -ForegroundColor Red
  exit 1
}

# 'tizen install -t' vuole il nome del dispositivo (3a colonna di 'sdb devices'),
# non l'indirizzo IP:porta usato per la connessione.
$deviceName = ($deviceLine -split '\s+')[-1]

& $TizenCli install -n $wgt.Name -t $deviceName -- $BuildResultDir
if ($LASTEXITCODE -eq 0) {
  Write-Host "`nInstallato correttamente su $Tv." -ForegroundColor Green
} else {
  Write-Host "`nInstallazione fallita su $Tv (exit code $LASTEXITCODE)." -ForegroundColor Red
  exit 1
}
