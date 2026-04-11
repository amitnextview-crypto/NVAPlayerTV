$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Split-Path -Parent $scriptDir
$issFile = Join-Path $scriptDir "SignageCMS.iss"
$exeFile = Join-Path $serverDir "NVA-SignagePlayerTV.exe"
$assetsDir = Join-Path $scriptDir "assets"
$logoPng = Join-Path $serverDir "public\nvlogo.png"
$logoIco = Join-Path $assetsDir "nvlogo.ico"
$buildMetaPath = Join-Path $scriptDir "build-meta.json"

function Get-BuildVersion {
  param(
    [string]$MetaPath
  )

  $staticVersion = "1.0.0"

  if (Test-Path $MetaPath) {
    try {
      $meta = Get-Content $MetaPath -Raw | ConvertFrom-Json
      if ($meta.version) {
        return $staticVersion
      }
    } catch {
    }
  }

  return $staticVersion
}

if (!(Test-Path $exeFile)) {
  throw "NVA-SignagePlayerTV.exe not found. Run: npm run build (inside server folder)"
}

$appVersion = Get-BuildVersion -MetaPath $buildMetaPath
$outputBaseName = "NVA-SignagePlayerTV-Setup"

if (!(Test-Path $logoPng)) {
  throw "Logo not found: $logoPng"
}

if (!(Test-Path $assetsDir)) {
  New-Item -ItemType Directory -Path $assetsDir | Out-Null
}

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeMethods {
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool DestroyIcon(IntPtr hIcon);
}
"@

$bitmap = $null
$icon = $null
$fs = $null
$hIcon = [IntPtr]::Zero
try {
  $bitmap = New-Object System.Drawing.Bitmap($logoPng)
  $hIcon = $bitmap.GetHicon()
  $icon = [System.Drawing.Icon]::FromHandle($hIcon)
  $fs = New-Object System.IO.FileStream($logoIco, [System.IO.FileMode]::Create)
  $icon.Save($fs)
} finally {
  if ($fs) { $fs.Dispose() }
  if ($icon) { $icon.Dispose() }
  if ($bitmap) { $bitmap.Dispose() }
  if ($hIcon -ne [IntPtr]::Zero) { [NativeMethods]::DestroyIcon($hIcon) | Out-Null }
}

$isccFromEnv = $env:ISCC_PATH
$candidates = @(
  $isccFromEnv,
  "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
  "C:\Program Files\Inno Setup 6\ISCC.exe"
) | Where-Object { $_ -and $_.Trim().Length -gt 0 }

$iscc = $null
foreach ($candidate in $candidates) {
  if (Test-Path $candidate) {
    $iscc = $candidate
    break
  }
}

if (-not $iscc) {
  throw "ISCC.exe not found. Install Inno Setup 6 or set ISCC_PATH env var."
}

Push-Location $scriptDir
try {
  & $iscc "/DAppVersion=$appVersion" "/DOutputBaseName=$outputBaseName" $issFile
} finally {
  Pop-Location
}

$outputExe = Join-Path $scriptDir "output\$outputBaseName.exe"
if (Test-Path $outputExe) {
  Write-Host "Installer created:" $outputExe -ForegroundColor Green
  Write-Host "Brand icon used:" $logoIco -ForegroundColor Green
} else {
  throw "Installer build failed. Output not found."
}
