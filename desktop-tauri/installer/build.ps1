# يبني المثبّت وينسخه إلى مكان يسهل إيجاده.
#
#     pwsh installer/build.ps1
#
# ناتج Tauri يقع في
# src-tauri/target/release/bundle/nsis/NumberOne Schools_1.0.0_x64-setup.exe
# وهو مسار عميق واسمه يحمل مسافات ورقم معمارية — فيصعب إرساله في رابط أو
# كتابته في تعليمات دعم. يُنسخ هنا إلى installer/out باسم مطابق لاصطلاح MAUI.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# بيئة MSVC. بدونها يفشل الربط على هذا الجهاز — راجع README.
$vcvars = 'C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat'
if (-not (Test-Path $vcvars)) {
  Write-Error "لم يُعثر على vcvars64.bat في $vcvars — راجع قسم البناء في README."
}

Push-Location $root
try {
  cmd /c "`"$vcvars`" >nul && npx tauri build"
  if ($LASTEXITCODE -ne 0) { Write-Error "فشل البناء." }

  $version = (Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json).version
  $built = Join-Path $root "src-tauri/target/release/bundle/nsis/NumberOne Schools_${version}_x64-setup.exe"
  if (-not (Test-Path $built)) { Write-Error "لم يُنتج المثبّت." }

  $out = Join-Path $root 'installer/out'
  New-Item -ItemType Directory -Force -Path $out | Out-Null
  $final = Join-Path $out "NumberOneSetup-$version.exe"
  Copy-Item $built $final -Force

  $mb = [math]::Round((Get-Item $final).Length / 1MB, 2)
  $sha = (Get-FileHash $final -Algorithm SHA256).Hash.ToLower()

  ''
  "المثبّت : $final"
  "الحجم   : $mb MB"
  "SHA-256 : $sha"
}
finally { Pop-Location }
