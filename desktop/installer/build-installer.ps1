# Publishes the desktop client and wraps it in an installer.
#
# One command, because the two halves have to agree: the installer script
# copies whatever is in the publish folder, so building it against a stale
# publish silently ships the previous version.
#
# Requires Inno Setup 6 (ISCC.exe). It is not part of the .NET SDK:
#     winget install --id JRSoftware.InnoSetup -e
#
# Usage:
#     pwsh installer/build-installer.ps1
#     pwsh installer/build-installer.ps1 -SkipPublish     # installer only

[CmdletBinding()]
param(
    [switch]$SkipPublish,

    # Off by default because it more than doubles the payload - 112MB to
    # 240MB - for roughly eight tenths of a second off the cold start. Worth
    # it for a machine the app opens on every day, which is why the publish
    # profile turns it on; this switch is here to turn it back off when the
    # download size matters more than the launch.
    [switch]$NoReadyToRun
)

$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $PSScriptRoot
$project = Join-Path $root 'NumberOne.Desktop\NumberOne.Desktop.csproj'
$publish = Join-Path $root 'NumberOne.Desktop\bin\publish\win-x64'

if (-not $SkipPublish) {
    Write-Host 'publishing...' -ForegroundColor Cyan

    # -f pins the framework because this project also targets Mac Catalyst, and
    # the publish profile carries RuntimeIdentifierOverride for the same reason:
    # a plain RuntimeIdentifier is applied to every target framework during
    # restore, sending NuGet after a Mono runtime pack for Windows that does not
    # exist.
    $publishArgs = @(
        'publish', $project,
        '-f', 'net10.0-windows10.0.19041.0',
        '-p:PublishProfile=win-x64',
        '--nologo'
    )
    if ($NoReadyToRun) { $publishArgs += '-p:PublishReadyToRun=false' }

    & dotnet @publishArgs
    if ($LASTEXITCODE -ne 0) { throw "publish failed ($LASTEXITCODE)" }
}

$exe = Join-Path $publish 'NumberOne.Desktop.exe'
if (-not (Test-Path $exe)) { throw "no published app at $publish - run without -SkipPublish" }

# Refuse a publish older than the code it claims to contain.
#
# -SkipPublish exists so the installer can be rebuilt without waiting on a
# publish, and it quietly shipped a stale one: an app fix was made, the
# installer was rebuilt several times while its text was worked on, and every
# one of those wrapped the binary from before the fix. It installed cleanly and
# ran fine, and the bug it was supposed to fix was still there.
$newest = Get-ChildItem $root -Recurse -File -Include *.cs, *.xaml, *.csproj, *.manifest -ErrorAction SilentlyContinue |
          Where-Object { $_.FullName -notlike '*\bin\*' -and $_.FullName -notlike '*\obj\*' } |
          Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($newest -and $newest.LastWriteTime -gt (Get-Item $exe).LastWriteTime) {
    throw ("the published app is older than the source. " +
           "$($newest.Name) changed at $($newest.LastWriteTime.ToString('HH:mm:ss')), " +
           "publish is from $((Get-Item $exe).LastWriteTime.ToString('HH:mm:ss')). " +
           'Run without -SkipPublish.')
}

# A publish that silently dropped the fonts or the player script still produces
# a runnable exe, and the failure only shows up on a student's machine as the
# wrong typeface or a lecture that will not play. Both have happened.
$fonts = @(Get-ChildItem $publish -Filter *.ttf -Recurse -ErrorAction SilentlyContinue).Count
if ($fonts -lt 8) { throw "expected 8 fonts in the publish output, found $fonts" }
foreach ($required in 'lesson-player.js', 'appicon.ico') {
    if (-not (Get-ChildItem $publish -Filter $required -Recurse -ErrorAction SilentlyContinue)) {
        throw "publish output is missing $required"
    }
}
Write-Host "publish looks complete ($fonts fonts, player script, icon)" -ForegroundColor Green

# Three locations, because where Inno Setup lands depends on how it was
# installed. `winget install` without elevation puts it under the user's own
# Programs folder, not Program Files - which is exactly what happened here, and
# a script that only looked in Program Files reported it missing right after a
# successful install.
$iscc = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $iscc) { $iscc = (Get-Command ISCC.exe -ErrorAction SilentlyContinue).Source }

if (-not $iscc) {
    Write-Warning 'Inno Setup 6 is not installed, so the installer was not built.'
    Write-Host   '  winget install --id JRSoftware.InnoSetup -e'
    Write-Host   "The published app is ready at: $publish"
    exit 2
}

Write-Host 'building the installer...' -ForegroundColor Cyan
& $iscc (Join-Path $PSScriptRoot 'NumberOne.iss')
if ($LASTEXITCODE -ne 0) { throw "ISCC failed ($LASTEXITCODE)" }

$out = Get-ChildItem (Join-Path $PSScriptRoot 'out') -Filter *.exe |
       Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host ("installer: {0}  ({1:N0} MB)" -f $out.FullName, ($out.Length / 1MB)) -ForegroundColor Green
Write-Host 'NOT SIGNED - SmartScreen will warn on first run. See installer/README.md.' -ForegroundColor Yellow
