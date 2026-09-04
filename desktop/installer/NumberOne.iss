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
; The folder a student sees in the Start Menu, so it is named in Arabic. The
; install path below stays Latin on purpose: it is a filesystem path rather
; than a phrase, and a Latin one keeps deployment scripts and support
; instructions simple.
DefaultGroupName={#AppName}
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

; The welcome page is off by default in the modern style, and it is the page
; the panel below is drawn for - the first thing a student sees, and the only
; place there is room to look like the platform rather than like a file copier.
DisableWelcomePage=no

; Drawn by installer/make-wizard-art.py from the app's own navy, its blue
; accent and the school's mark. One file per display scaling so the logo stays
; sharp on a classroom projector and on a laptop alike.
WizardImageFile=wizard-panel-164x314.bmp,wizard-panel-192x386.bmp,wizard-panel-246x471.bmp,wizard-panel-328x628.bmp
WizardSmallImageFile=wizard-mark-55x58.bmp,wizard-mark-64x68.bmp,wizard-mark-92x97.bmp,wizard-mark-110x116.bmp,wizard-mark-138x140.bmp

; One language, so nothing is asked before the welcome page.
ShowLanguageDialog=no

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
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Only what the installer itself leaves behind. The student's tokens live in
; the platform credential store and their crash log in their own AppData, and
; neither is removed here - an uninstall to fix a broken install should not
; also sign the student out of a device their account is bound to.
Type: filesandordirs; Name: "{app}"

[LangOptions]
; Mirrors the whole wizard: the panel moves to the right, the buttons to the
; left, and every label aligns from the right edge the way the app itself does.
RightToLeft=yes
DialogFontName=Segoe UI
DialogFontSize=9
WelcomeFontName=Segoe UI
WelcomeFontSize=12

[Messages]
; Every visible string, in Arabic. Inno ships no Arabic language file, so these
; override the English ones rather than adding a language - which also keeps
; the wording ours: written for a student installing a lecture app, not the
; generic voice of a setup program.
SetupAppTitle=تثبيت
SetupWindowTitle=تثبيت — %1
UninstallAppTitle=إزالة
UninstallAppFullTitle=إزالة %1

ButtonBack=رجوع
ButtonNext=التالي
ButtonInstall=تثبيت
ButtonOK=موافق
ButtonCancel=إلغاء
ButtonYes=نعم
ButtonNo=لا
ButtonFinish=إنهاء
ButtonBrowse=استعراض…
ButtonWizardBrowse=استعراض…
ButtonNewFolder=مجلد جديد

ExitSetupTitle=إنهاء التثبيت
ExitSetupMessage=لم يكتمل التثبيت بعد. إذا خرجت الآن فلن يُثبَّت التطبيق.%n%nهل تريد الخروج؟
ErrorTitle=خطأ
SetupLdrStartupMessage=سيتم تثبيت %1. هل تريد المتابعة؟

; These three sit under the labels above and were still in English on the
; running wizard - the welcome page read "Click Next to continue, or Cancel to
; exit Setup." under two Arabic paragraphs.
ClickNext=اضغط «التالي» للمتابعة، أو «إلغاء» للخروج.
BeveledLabel=
StatusSavingUninstall=جارٍ حفظ معلومات الإزالة…
SetupAborted=لم يكتمل التثبيت.

WelcomeLabel1=مرحبًا بك في [name]
WelcomeLabel2=منصّتك للدروس والاختبارات، على جهازك مباشرة.%n%nسيتم تثبيت [name/ver] الآن. اضغط «التالي» للمتابعة.

WizardSelectDir=مكان التثبيت
SelectDirDesc=أين تريد تثبيت [name]؟
SelectDirLabel3=سيُثبَّت التطبيق في المجلد التالي.
SelectDirBrowseLabel=اضغط «التالي» للمتابعة، أو «استعراض» لاختيار مجلد آخر.
DiskSpaceGBLabel=يلزم توفّر [gb] جيجابايت على الأقل من المساحة الفارغة.
DiskSpaceMBLabel=يلزم توفّر [mb] ميجابايت على الأقل من المساحة الفارغة.
InvalidPath=يجب إدخال مسار كامل مع حرف القرص.
DiskSpaceWarningTitle=المساحة غير كافية
CannotInstallToNetworkDrive=لا يمكن التثبيت على قرص شبكة.

WizardSelectTasks=خيارات إضافية
SelectTasksDesc=هل تريد إضافة اختصار؟
SelectTasksLabel2=اختر ما تريده ثم اضغط «التالي».

WizardReady=جاهز للتثبيت
ReadyLabel1=كل شيء جاهز لتثبيت [name] على جهازك.
ReadyLabel2a=اضغط «تثبيت» للبدء، أو «رجوع» لمراجعة اختياراتك.
ReadyLabel2b=اضغط «تثبيت» للبدء.
ReadyMemoTasks=خيارات إضافية:
ReadyMemoDir=مكان التثبيت:

WizardPreparing=جارٍ التحضير
PreparingDesc=يتم تحضير التثبيت على جهازك.

WizardInstalling=جارٍ التثبيت
InstallingLabel=يرجى الانتظار حتى يكتمل تثبيت التطبيق.
StatusExtractFiles=جارٍ نسخ الملفات…
StatusCreateIcons=جارٍ إنشاء الاختصارات…
StatusRunProgram=جارٍ إنهاء التثبيت…
StatusRollback=جارٍ التراجع عن التغييرات…

FinishedHeadingLabel=تم التثبيت بنجاح
FinishedLabel=تم تثبيت [name] على جهازك. تجده في قائمة ابدأ باسم التطبيق.
FinishedLabelNoIcons=تم تثبيت [name] على جهازك.
FinishedRestartLabel=يلزم إعادة تشغيل الجهاز لإكمال التثبيت. هل تريد إعادة التشغيل الآن؟
ClickFinish=اضغط «إنهاء» لإغلاق المثبّت.
RunEntryExec=تشغيل %1

ConfirmUninstall=هل تريد إزالة %1 من جهازك؟
UninstallStatusLabel=يرجى الانتظار حتى تكتمل إزالة %1.
UninstalledAll=تمت إزالة %1 بنجاح.
UninstalledMost=تمت إزالة %1، مع بقاء بعض الملفات التي يمكنك حذفها يدويًا.
UninstallOpenError=تعذّر فتح ملف الإزالة.

[CustomMessages]
CreateDesktopIcon=إنشاء اختصار على سطح المكتب
AdditionalIcons=اختصارات:
LaunchProgram=تشغيل %1
UninstallProgram=إزالة %1
