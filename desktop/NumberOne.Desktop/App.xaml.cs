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

    private static void Record(string source, Exception? ex)
    {
        if (ex is null) return;

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

            // The whole UI is RTL. Set on the window so it cascades to every
            // page, rather than being repeated and eventually forgotten on one.
            FlowDirection = FlowDirection.RightToLeft,

            Width = 1440,
            Height = 900,
            MinimumWidth = 1024,
            MinimumHeight = 700,
        };

        window.Created += (_, _) =>
        {
            ProtectFromCapture(window);
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

        if (Microsoft.UI.Windowing.AppWindow.GetFromWindowId(id) is { } appWindow &&
            appWindow.Presenter is Microsoft.UI.Windowing.OverlappedPresenter presenter)
        {
            presenter.Maximize();
        }
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
