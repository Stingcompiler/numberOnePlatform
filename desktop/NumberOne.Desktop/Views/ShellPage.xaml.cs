using NumberOne.Core.Services;

namespace NumberOne.Desktop.Views;

/// <summary>
/// The signed-in chrome. Hosts one content view at a time beside the sidebar.
///
/// Not a MAUI Shell: the design specifies its own 240px rail on the RTL leading
/// edge, and Shell would add flyout chrome we would then have to hide.
/// </summary>
public partial class ShellPage : ContentPage
{
    private readonly AuthService _auth;

    public ShellPage(AuthService auth, HomeView home)
    {
        InitializeComponent();

        _auth = auth;
        ContentHost.Content = home;
        SidebarStudentName.Text = auth.CurrentUser?.WatermarkName ?? "";

        // Sections start loading as the shell is built, so the dashboard is
        // already filling in by the time the push animation finishes.
        home.BeginLoad();
    }

    /// <summary>Raised after the session is cleared, so the host can return to login.</summary>
    public event EventHandler? SignedOut;

    private async void OnSignOutClicked(object? sender, EventArgs e)
    {
        SignOutButton.IsEnabled = false;

        try
        {
            // Clears local tokens even when the server is unreachable — a failed
            // logout call must never leave a session on a shared machine.
            await _auth.SignOutAsync();
            SignedOut?.Invoke(this, EventArgs.Empty);
        }
        finally
        {
            SignOutButton.IsEnabled = true;
        }
    }
}
