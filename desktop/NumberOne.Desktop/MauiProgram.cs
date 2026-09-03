using Microsoft.Extensions.Logging;
using NumberOne.Core.Abstractions;
using NumberOne.Core.Api;
using NumberOne.Core.Services;
using NumberOne.Core.ViewModels;
using NumberOne.Desktop.Services;
using NumberOne.Desktop.Views;

namespace NumberOne.Desktop;

public static class MauiProgram
{
    /// <summary>
    /// Where the API lives. Point this at http://localhost:8000/api/ to work
    /// against a local runserver instead of production.
    /// </summary>
    public static readonly Uri ApiBaseAddress = ResolveBaseAddress();

    /// <summary>
    /// Production unless NUMBERONE_API says otherwise, so a developer can point
    /// a build at a local runserver without editing code — and, more to the
    /// point, so nobody ever ships a build that was edited to localhost and not
    /// edited back.
    /// </summary>
    private static Uri ResolveBaseAddress()
    {
        var configured = Environment.GetEnvironmentVariable("NUMBERONE_API");

        return new Uri(string.IsNullOrWhiteSpace(configured)
            ? ApiEndpoints.DefaultBaseUrl
            : configured);
    }

    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        builder
            .UseMauiApp<App>()
            .ConfigureFonts(fonts =>
            {
                // Cairo for UI, Tajawal for running copy, at 400 / 500 / 700 —
                // the design's ramp. Bundled, never fetched at runtime: the app
                // has to work on a lab PC behind a filter, and a webfont that
                // fails to load would fall back to a Latin face that cannot
                // shape Arabic at all.
                //
                // Each weight is its own alias. MAUI resolves a font by family
                // name and can only ask for bold on top of it, so 500 is
                // unreachable through FontAttributes and has to be registered
                // as a family in its own right.
                fonts.AddFont("Cairo-Regular.ttf", "Cairo");
                fonts.AddFont("CairoMedium-Regular.ttf", "CairoMedium");
                fonts.AddFont("Cairo-Bold.ttf", "CairoBold");

                fonts.AddFont("Tajawal-Regular.ttf", "Tajawal");
                fonts.AddFont("Tajawal-Medium.ttf", "TajawalMedium");
                fonts.AddFont("Tajawal-Bold.ttf", "TajawalBold");

                // Kept registered: the MAUI template's own styles in
                // Styles.xaml still name them, and dropping them here would
                // break every control that has not been restyled.
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
            });

        RegisterPlatformServices(builder.Services);
        RegisterApi(builder.Services);

#if DEBUG
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }

    private static void RegisterPlatformServices(IServiceCollection services)
    {
        services.AddSingleton<ITokenStore, SecureTokenStore>();

#if WINDOWS
        services.AddSingleton<IDeviceIdentityProvider, Platforms.Windows.WindowsDeviceIdentityProvider>();
        services.AddSingleton<IWindowProtection, Platforms.Windows.WindowsWindowProtection>();
#elif MACCATALYST
        services.AddSingleton<IDeviceIdentityProvider, Platforms.MacCatalyst.MacDeviceIdentityProvider>();
        services.AddSingleton<IWindowProtection, Platforms.MacCatalyst.MacWindowProtection>();
#endif
    }

    private static void RegisterApi(IServiceCollection services)
    {
        // The refresh path gets its own client so a 401 on /auth/refresh/ cannot
        // recurse back through the authenticating handler.
        services.AddSingleton<ITokenRefresher>(_ => new RefreshEndpoint(ApiBaseAddress));

        services.AddSingleton(sp =>
        {
            var (client, auth) = ApiClientFactory.Create(
                ApiBaseAddress,
                sp.GetRequiredService<ITokenStore>(),
                sp.GetRequiredService<ITokenRefresher>());

            // Held so callers can subscribe to SessionExpired.
            SessionEvents.Attach(auth);
            return client;
        });

        services.AddSingleton<AuthService>();
        services.AddSingleton<StudentApi>();

        // Anonymous, and on its own client: the blocked screens and the login
        // error need the school's phone number when there is no session.
        services.AddSingleton(_ => new SiteContactService(ApiBaseAddress));

        // Singleton because App wires its Blocked event once at startup; a
        // transient view model would leave that handler on a discarded instance.
        services.AddSingleton<LoginViewModel>();
        services.AddSingleton<LoginPage>();

        // Transient: the dashboard is rebuilt per sign-in, so a second student
        // on a shared machine never sees the first one's cached sections.
        services.AddTransient<HomeViewModel>();
        services.AddTransient<HomeView>();
        services.AddTransient<ShellPage>();
    }
}

/// <summary>
/// Bridges the handler-level session-expired signal to the UI, which needs it
/// on the main thread to raise the 480px dialog.
/// </summary>
public static class SessionEvents
{
    /// <summary>Raised on the UI thread when the refresh token was rejected.</summary>
    public static event EventHandler? SessionExpired;

    internal static void Attach(AuthenticatingHandler handler)
    {
        handler.SessionExpired += (_, _) =>
            MainThread.BeginInvokeOnMainThread(() => SessionExpired?.Invoke(null, EventArgs.Empty));
    }
}
