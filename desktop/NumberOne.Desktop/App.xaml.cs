using NumberOne.Core.Abstractions;
using NumberOne.Core.Services;
using NumberOne.Core.ViewModels;
using NumberOne.Desktop.Views;

namespace NumberOne.Desktop;

public partial class App : Application
{
    private readonly IServiceProvider _services;

    /// <summary>Where the student's light/dark choice is remembered.</summary>
    public const string ThemePreferenceKey = "app_theme";

    public App(IServiceProvider services)
    {
        InitializeComponent();
        _services = services;

        RecordCrashes();
        ApplyStartupTheme();
    }

    /// <summary>Where an unhandled exception is written. Also shown to the student.</summary>
    public static string CrashLogPath =>
        Path.Combine(FileSystem.AppDataDirectory, "crash.log");

    /// <summary>
    /// Writes anything that gets away to a file.
    ///
    /// This app runs on school machines with no debugger and no console, so an
    /// unhandled exception is currently a window that closes and a student who
    /// says "it broke". The type, the message and the stack are what turn that
    /// into something fixable, and they have to survive the process ending to
    /// be worth anything.
    ///
    /// Appends rather than overwrites: the first failure is usually the real
    /// one, and a crash on the way out of a crash must not erase it.
    ///
    /// This does NOT stop the crash. It only makes it legible — nothing here
    /// marks an exception handled, because swallowing an unknown fault would
    /// leave the app running in a state nobody has reasoned about.
    /// </summary>
    private static void RecordCrashes()
    {
        AppDomain.CurrentDomain.UnhandledException += (_, e) =>
            Record("AppDomain", e.ExceptionObject as Exception);

        // A faulted task nobody awaited. The write paths are guarded now, but
        // an async void handler can still surface here.
        TaskScheduler.UnobservedTaskException += (_, e) =>
        {
            Record("UnobservedTask", e.Exception);
            e.SetObserved();
        };

        // A section that failed for a reason that is not the network. It shows
        // the student a failed panel rather than closing the app, so without
        // this the defect behind it would leave no trace at all.
        Core.ViewModels.SectionDiagnostics.Unexpected = ex => Record("Section", ex);
    }

    /// <summary>
    /// Records a fault the platform caught. Public because WinUI raises its own
    /// UnhandledException on the UI thread, and that handler lives in the
    /// platform App class rather than here.
    /// </summary>
    public static void RecordUnhandled(string source, Exception? ex) => Record(source, ex);

    /// <summary>
    /// Puts the fault in front of the student, wherever it happened.
    ///
    /// Shows the exception type, its message and the first line of the stack —
    /// which names the method — rather than a polite apology. Nobody has
    /// diagnosed this yet, and a person who can read those three things back is
    /// the shortest path to a fix. Everything else is in the crash log.
    /// </summary>
    public static void ShowFault(Exception? ex)
    {
        if (ex is null) return;
        if (IsRenderThreadFault(ex)) return;

        var page = Current?.Windows.FirstOrDefault()?.Page;
        if (page is null) return;

        var where = ex.StackTrace?
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .FirstOrDefault()?.Trim() ?? "";

        MainThread.BeginInvokeOnMainThread(async () =>
        {
            try
            {
                await page.DisplayAlertAsync(
                    "حدث خطأ",
                    $"{ex.GetType().Name}: {ex.Message}\n\n{where}\n\n{CrashLogPath}",
                    "حسناً");
            }
            catch (Exception)
            {
                // No page, or a dialog already up. The log still has it.
            }
        });
    }

    /// <summary>
    /// True for a compositor failure the app has already survived.
    ///
    /// WinUI renders through DirectComposition on its own thread, and when a
    /// frame is disturbed mid-render it raises COMException through the app's
    /// UnhandledException: DCOMPOSITION_ERROR_SURFACE_BEING_RENDERED, or
    /// 0x80070490 for a visual the compositor can no longer find. The next
    /// frame draws correctly and nothing is lost — these arrived while every
    /// screen behind the dialog was rendered and usable.
    ///
    /// They are still recorded. What stops is the dialog: it was put there to
    /// find an unidentified crash, and it did, but a modal over a student's
    /// results page for a fault that has already resolved is now itself the
    /// interruption. A COMException raised from our own code carries a managed
    /// stack and does not match, so it still surfaces.
    /// </summary>
    private static bool IsRenderThreadFault(Exception ex)
    {
        if (ex is not System.Runtime.InteropServices.COMException com) return false;

        const int Fail = unchecked((int)0x80004005);
        const int ElementNotFound = unchecked((int)0x80070490);

        if (com.HResult == ElementNotFound) return true;
        if (com.HResult != Fail) return false;

        // E_FAIL is generic, so it only counts as the compositor's when it
        // names DCOMPOSITION or arrives with no managed frames beneath it.
        return (com.Message?.Contains("DCOMPOSITION", StringComparison.Ordinal) ?? false)
            || string.IsNullOrWhiteSpace(com.StackTrace);
    }

    /// <summary>
    /// Signatures already written, with how many times. Compositor faults
    /// repeat in bursts of five and six per navigation.
    /// </summary>
    private static readonly Dictionary<string, int> Seen = new();

    private const int KeepPerSignature = 3;
    private const long MaxLogBytes = 512 * 1024;

    private static void Record(string source, Exception? ex)
    {
        if (ex is null) return;

        // A recoverable render fault repeats without limit - 373 of the first
        // 377 entries in the field were the same compositor message, and the
        // two real faults in that file were buried among them. Keeping a few of
        // each proves it happened and how often; keeping every one costs the
        // log its only purpose.
        if (IsRenderThreadFault(ex))
        {
            var signature = ex.GetType().Name + ":" + ex.HResult + ":" + ex.Message;

            lock (Seen)
            {
                Seen.TryGetValue(signature, out var count);
                Seen[signature] = count + 1;

                if (count >= KeepPerSignature) return;
            }
        }

        try
        {
            // A student's machine is not somewhere a log may grow for ever.
            // Starting over loses history, but the useful entry is nearly
            // always the most recent one.
            if (new FileInfo(CrashLogPath) is { Exists: true } file && file.Length > MaxLogBytes)
                File.Delete(CrashLogPath);
        }
        catch (Exception)
        {
            // Cannot stat or delete it; the append below still tries.
        }

        try
        {
            var entry =
                $"{Environment.NewLine}=== {DateTimeOffset.Now:yyyy-MM-dd HH:mm:ss} · {source} ==={Environment.NewLine}" +
                ex + Environment.NewLine;

            File.AppendAllText(CrashLogPath, entry);
        }
        catch (Exception)
        {
            // Logging a crash must never cause one. A full disk or a locked
            // file is not worth taking the app down a second time for.
        }
    }

    /// <summary>
    /// Light unless the student has chosen dark, pinned before the first window
    /// exists.
    ///
    /// It has to happen here rather than in the shell: login and both blocked
    /// screens are shown before a shell is ever built, and setting the theme
    /// there would leave those three following the OS. School and lab machines
    /// are often left on the Windows dark default, so a student who had never
    /// touched the setting would meet a dark sign-in page while the dashboard,
    /// the printed handouts and the design itself are all light.
    /// </summary>
    private static void ApplyStartupTheme()
    {
        var stored = Preferences.Default.Get(ThemePreferenceKey, "");

        Current!.UserAppTheme = stored == "dark" ? AppTheme.Dark : AppTheme.Light;
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        var navigation = new NavigationPage(_services.GetRequiredService<LoginPage>())
        {
            // The design draws its own chrome; a platform nav bar would sit on
            // top of the login split and every blocked screen, all of which
            // specify no shell.
            BarBackgroundColor = Colors.Transparent,

            // Set here as well as on the Window. A Window's FlowDirection does
            // not reach pages through a NavigationPage, so without this the
            // whole UI lays out left-to-right: the brand panel lands on the
            // wrong edge and every row reads backwards.
            FlowDirection = FlowDirection.RightToLeft,
        };
        NavigationPage.SetHasNavigationBar(navigation, false);

        var window = new Window(navigation)
        {
            Title = UiText.BrandName,

            // Deliberately NOT RightToLeft, though everything inside it is.
            //
            // A window's flow direction is what Windows mirrors the title bar
            // by: the caption buttons move to the left edge and the title is
            // laid out from the opposite side. MAUI's own title strip does not
            // move with them, so the app name and the close button ended up
            // drawn over each other, with the window icon landing in the middle
            // of the text.
            //
            // The pages carry RightToLeft themselves - the NavigationPage above
            // sets it, which is the setting that actually reaches them - so the
            // UI reads right to left either way. Arabic in a left-to-right
            // caption is still shaped and ordered correctly; bidi handles the
            // text, and only the chrome around it stays where Windows puts it.

            Width = 1440,
            Height = 900,
            MinimumWidth = 1024,
            MinimumHeight = 700,
        };

        window.Created += (_, _) =>
        {
            ProtectFromCapture(window);
            UseSystemTitleBar(window);
            Maximize(window);
        };

        WireNavigation();

        // A student who never signed out should land in the app, not at a form.
        // Deliberately not awaited: CreateWindow is synchronous, and blocking
        // it on a network call would hold the first frame behind the server.
        _ = RestoreSessionAsync(navigation);

        return window;
    }

    /// <summary>
    /// Opens straight into the app when the machine still holds a live session.
    ///
    /// The login page stays the navigation root either way, so sign-out and an
    /// expired session keep working exactly as before — both pop back to it.
    /// This only decides whether the shell is pushed on top before the student
    /// ever sees the form.
    /// </summary>
    private async Task RestoreSessionAsync(NavigationPage navigation)
    {
        var login = _services.GetRequiredService<LoginViewModel>();
        var auth = _services.GetRequiredService<AuthService>();

        login.IsRestoringSession = true;

        try
        {
            var restore = await auth.RestoreSessionAsync();

            // Unverified counts. The tokens are there and the server could not
            // be asked; sending the student to a login form that also cannot
            // reach the server would strand them.
            if (restore is not (SessionRestore.Restored or SessionRestore.Unverified))
                return;

            await MainThread.InvokeOnMainThreadAsync(() => PushShellAsync(navigation));
        }
        catch (Exception)
        {
            // Nothing here may take the launch down. Falling through leaves the
            // student on the login page, which always works.
        }
        finally
        {
            login.IsRestoringSession = false;
        }
    }

    /// <summary>
    /// Pushes the signed-in shell. Shared by the restore above and the
    /// SignedIn handler, so both wire the sign-out return the same way.
    /// </summary>
    private async Task PushShellAsync(NavigationPage navigation)
    {
        var shell = _services.GetRequiredService<ShellPage>();

        shell.SignedOut += async (_, _) =>
        {
            if (Current?.Windows.FirstOrDefault()?.Page is NavigationPage back)
                await back.PopToRootAsync();
        };

        await navigation.PushAsync(shell);
    }

    /// <summary>
    /// Excludes the window from screen capture where the platform can.
    ///
    /// Applied to the main window at creation. Every popup or detached player
    /// window needs its own call - the affinity is per HWND, not per app. On
    /// macOS, and on Windows builds older than 2004, this reports false and the
    /// watermark carries the protection instead.
    /// </summary>
    private void ProtectFromCapture(Window window)
    {
        var protection = _services.GetRequiredService<IWindowProtection>();
        if (!protection.IsSupported) return;

#if WINDOWS
        if (window.Handler?.PlatformView is Microsoft.UI.Xaml.Window platformWindow)
            protection.Protect(platformWindow);
#endif
    }

    /// <summary>
    /// Lets Windows draw the title bar instead of MAUI.
    ///
    /// MAUI extends its own strip into the caption area and writes the app
    /// title into it. That strip is part of the window content, so it inherits
    /// the RightToLeft flow the rest of the UI needs — while the caption
    /// buttons stay where the system put them. The title then starts at the
    /// same edge the close button occupies and the two sit on top of each
    /// other, which is what a student sees the moment the app opens.
    ///
    /// Handing the bar back to the system fixes it at the source rather than
    /// nudging the text clear: Windows has drawn right-to-left captions for
    /// decades, and puts the buttons and the title on opposite edges without
    /// being asked. The app already draws its own header inside the content,
    /// so nothing of the design is lost with the strip.
    /// </summary>
    private static void UseSystemTitleBar(Window window)
    {
#if WINDOWS
        if (window.Handler?.PlatformView is Microsoft.UI.Xaml.Window platformWindow)
            platformWindow.ExtendsContentIntoTitleBar = false;
#endif
    }

    /// <summary>
    /// Opens maximised.
    ///
    /// The Width and Height on the Window are the restored size — what the
    /// student gets when they un-maximise — not the opening size, so they stay.
    /// This app is a workspace: tables with six and seven columns, a 920x518
    /// lecture surface, a sidebar and a unit rail either side of it. At the
    /// 1024 minimum those all fit, but only just, and nobody opens a lecture
    /// app to look at something else beside it.
    ///
    /// Maximised, not fullscreen: fullscreen takes the title bar and the
    /// student's own way to close or move the window with it, and the app
    /// already has an in-lecture expand for the one place that wants the whole
    /// screen.
    /// </summary>
    private static void Maximize(Window window)
    {
#if WINDOWS
        if (window.Handler?.PlatformView is not Microsoft.UI.Xaml.Window platformWindow) return;

        var handle = WinRT.Interop.WindowNative.GetWindowHandle(platformWindow);
        var id = Microsoft.UI.Win32Interop.GetWindowIdFromWindow(handle);

        if (Microsoft.UI.Windowing.AppWindow.GetFromWindowId(id) is not { } appWindow) return;

        // Set from our own string rather than left to whatever the platform
        // inferred. The taskbar was labelling the app "????? ?????? ???? ??" -
        // one question mark per Arabic letter, the signature of a title that
        // reached Windows through a single-byte code page instead of Unicode.
        appWindow.Title = UiText.BrandName;

        if (appWindow.Presenter is Microsoft.UI.Windowing.OverlappedPresenter presenter)
            presenter.Maximize();
#endif
    }

    /// <summary>
    /// Routes the auth flow. Kept here rather than in the pages so the view
    /// models stay free of navigation concerns and remain testable headless.
    /// </summary>
    private void WireNavigation()
    {
        var login = _services.GetRequiredService<LoginViewModel>();

        login.SignedIn += async (_, _) =>
        {
            if (Current?.Windows.FirstOrDefault()?.Page is NavigationPage navigation)
                await PushShellAsync(navigation);
        };

        login.Blocked += async (_, state) =>
        {
            var vm = new BlockedPageViewModel(state, _services.GetRequiredService<SiteContactService>());
            vm.BackToLoginRequested += async (_, _) =>
            {
                if (Current?.Windows.FirstOrDefault()?.Page is NavigationPage nav)
                    await nav.PopAsync();
            };

            if (Current?.Windows.FirstOrDefault()?.Page is NavigationPage navigation)
                await navigation.PushAsync(new BlockedPage(vm));
        };

        SessionEvents.SessionExpired += async (_, _) =>
        {
            // The dialog the design specifies is not built yet. Until it is,
            // returning to login is the honest behaviour: the tokens are already
            // cleared by the handler, so staying on a dead session would show
            // stale data behind failing requests.
            if (Current?.Windows.FirstOrDefault()?.Page is NavigationPage navigation)
                await navigation.PopToRootAsync();
        };
    }
}
