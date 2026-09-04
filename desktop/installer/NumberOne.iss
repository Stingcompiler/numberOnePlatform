; Installer for the desktop student client.
;
; Per-user by design. These go onto school and lab machines where the person
; sitting at the keyboard is a student without administrator rights, and an
; installer that opens a UAC prompt is an installer that does not get run. So
; it writes to the user's own Programs folder and needs no elevation at all.
; An administrator deploying to a whole lab can still run it per-user for each
; profile, or push the published folder directly - nothing here writes outside
; the user's own directories.
;
; The payload is self-contained: the .NET runtime ships inside it, because a
; school cannot be asked to install a runtime first. That is what makes this
; large. LZMA2 at maximum takes the published tree down to roughly half.
;
; NOT SIGNED. Windows SmartScreen will warn on first run until the executable
; and this installer are signed with a certificate the school has bought. That
; is a purchase and a key-handling decision, not something to fake around; see
; the README beside this file.

#define AppName        "مدارس ومعاهد نمبر ون"
#define AppNameLatin   "NumberOne Schools"
#define AppVersion     "1.0.0"
#define AppPublisher   "NumberOne Schools"
#define AppExe         "NumberOne.Desktop.exe"
#define PublishDir     "..\NumberOne.Desktop\bin\publish\win-x64"

[Setup]
; Never change AppId. It is how Windows recognises an existing installation,
; so a new value would install a second copy alongside the old one instead of
; upgrading it.
AppId={{7A4C1E92-3B6D-4F58-9E21-8C0D5A7F4B13}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
VersionInfoVersion={#AppVersion}

; No elevation. See the note at the top.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

DefaultDirName={autopf}\{#AppNameLatin}
DefaultGroupName={#AppNameLatin}
DisableProgramGroupPage=yes
DisableDirPage=auto

OutputDir=out
OutputBaseFilename=NumberOneSetup-{#AppVersion}
SetupIconFile={#PublishDir}\appicon.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}

Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern

; The app itself requires 10.0.19041; refusing earlier here means a clear
; message now rather than a failure to launch later.
MinVersion=10.0.19041

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; The whole published tree. recursesubdirs picks up the runtime, the WebView2
; loader and the Resources folder; ignoreversion because self-contained runtime
; files carry versions that must be replaced wholesale on upgrade rather than
; compared file by file.
Source: "{#PublishDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppNameLatin}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Only what the installer itself leaves behind. The student's tokens live in
; the platform credential store and their crash log in their own AppData, and
; neither is removed here - an uninstall to fix a broken install should not
; also sign the student out of a device their account is bound to.
Type: filesandordirs; Name: "{app}"
