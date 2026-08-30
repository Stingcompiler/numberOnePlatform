using CommunityToolkit.Mvvm.ComponentModel;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// The two cross-cutting interrupts: the offline bar and the session-expired
/// dialog. They live above the routes because both persist across them.
/// </summary>
public sealed partial class SessionViewModel : ObservableObject
{
    /// <summary>
    /// Shown as a bar above the content area. Persists across routes, so it is
    /// held here rather than per screen.
    /// </summary>
    [ObservableProperty]
    private bool _isOffline;

    /// <summary>
    /// Raised when the refresh token was rejected — a genuine expiry, not a
    /// dropped connection. The two are different states and must stay so: an
    /// offline student still has a valid session.
    /// </summary>
    [ObservableProperty]
    private bool _isSessionExpired;

    public const string OfflineMessage =
        "لا يوجد اتصال بالإنترنت — البيانات المعروضة قد تكون قديمة والفيديو متوقف.";

    public const string Reconnect = "إعادة الاتصال";

    public string SessionExpiredTitle => UiText.SessionExpiredTitle;
    public string SessionExpiredBody => UiText.SessionExpiredBody;
    public string SessionExpiredContinue => UiText.SessionExpiredContinue;
    public string SessionExpiredBackToLogin => UiText.SessionExpiredBackToLogin;
}
