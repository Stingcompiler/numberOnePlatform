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

        ApplyStartupTheme();
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

        window.Created += (_, _) => ProtectFromCapture(window);

        WireNavigation();

        return window;
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
    /// Routes the auth flow. Kept here rather than in the pages so the view
    /// models stay free of navigation concerns and remain testable headless.
    /// </summary>
    private void WireNavigation()
    {
        var login = _services.GetRequiredService<LoginViewModel>();

        login.SignedIn += async (_, _) =>
        {
            var shell = _services.GetRequiredService<ShellPage>();
            shell.SignedOut += async (_, _) =>
            {
                if (Current?.Windows.FirstOrDefault()?.Page is NavigationPage back)
                    await back.PopToRootAsync();
            };

            if (Current?.Windows.FirstOrDefault()?.Page is NavigationPage navigation)
                await navigation.PushAsync(shell);
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
