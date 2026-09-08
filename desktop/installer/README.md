# Packaging the desktop client

```powershell
pwsh installer/build-installer.ps1
```

Publishes the app and wraps it in `installer/out/NumberOneSetup-1.0.0.exe`.

Needs Inno Setup once:

```powershell
winget install --id JRSoftware.InnoSetup -e
```

Without it the script still publishes, tells you, and exits 2.

## What gets built

Self-contained, so the .NET runtime ships inside the app. A school cannot be
asked to install a runtime before a student can open a lecture, and a runtime
installed separately is a version that can drift underneath us.

| | |
|---|---|
| Published tree | ~240 MB, 611 files |
| Installer | smaller; LZMA2/max compresses .NET assemblies well |
| Installs to | `%LocalAppData%\Programs\NumberOne Schools` |
| Elevation | none — see below |

ReadyToRun is on. It costs 128 MB (112 MB → 240 MB) and takes roughly eight
tenths of a second off the cold start — 2.7s down to 1.6s, measured on the
build machine. That is a trade the app should win every day it is opened, but
`-NoReadyToRun` turns it off when download size matters more.

## Why per-user, with no administrator prompt

These land on school and lab machines where the person at the keyboard is a
student without administrator rights. An installer that raises a UAC prompt is
an installer that does not get run. Nothing here writes outside the user's own
directories, so an administrator deploying a whole lab can run it per profile,
or copy the published folder directly.

## Signing — the one thing still missing

**Neither the app nor the installer is signed.** On first run Windows
SmartScreen shows "Windows protected your PC", and a student has to click
through *More info → Run anyway* to get past it. Some managed school machines
will refuse outright.

Fixing it needs a purchase and a decision about key custody, not a code change:

1. Buy a code-signing certificate — an OV certificate warns until it builds
   reputation; an EV certificate is trusted immediately and comes on a hardware
   token. For machines the school does not control, EV is the one that works on
   day one.
2. Sign the app executable **before** building the installer, then sign the
   installer too. Inno Setup can do the second through `SignTool=`.
3. Keep the certificate out of the repository. A signing key in git is a key
   that has to be revoked.

Until that is done, tell whoever installs it to expect the SmartScreen warning,
so it reads as a known gap rather than a virus.

## Updating

There is no update channel. A new version means running the installer again —
it upgrades in place, because `AppId` in `NumberOne.iss` is stable. Never change
that GUID: a new one installs a second copy beside the old one instead of
replacing it.

An MSIX package would give real updates, and it needs the same certificate as
above plus a look at where the app writes — the crash log and the token store
both assume ordinary user paths today.
