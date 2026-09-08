using NumberOne.Core.Services;

namespace NumberOne.Desktop.Controls;

/// <summary>
/// The web view the lecture plays in, with every route out of the app closed.
///
/// A plain WebView is not safe for this. It will happily open a new window when
/// YouTube's "Watch on YouTube" asks it to, follow a link into the browser,
/// offer "Open link in new tab" from its own context menu, and hand the student
/// F12 and Ctrl+N. Each of those leaves the lecture, and content protection is
/// the requirement here rather than a nicety.
///
/// Three layers, in order of how much they can be trusted:
///
///   1. The web view refuses navigation. Every attempt is put to
///      PlayerNavigationPolicy and anything that is not the lecture page is
///      cancelled — whatever provoked it: a click, a script, a middle-click, a
///      redirect, a keyboard shortcut. New windows are refused outright. This
///      layer holds even if YouTube changes its markup tomorrow.
///
///   2. The host's own affordances are switched off: context menu, dev tools,
///      the status bar that previews a URL on hover, browser accelerator keys,
///      swipe-to-navigate.
///
///   3. The injected script covers the frame and draws our own controls, so
///      YouTube's chrome is not merely blocked on click but unreachable.
///
/// Layer 3 alone is what a CSS-only "hide the button" approach amounts to, and
/// it is the weakest of the three, which is why it is last and never alone.
/// </summary>
public sealed class SecurePlayerWebView : WebView
{
    public SecurePlayerWebView()
    {
        // The cross-platform half of layer 1.
        //
        // WebView2's own NavigationStarting is richer — it sees frames, new
        // windows and downloads — but it exists only on Windows. Mac Catalyst
        // runs WKWebView and would otherwise ship with none of this, so the
        // main-frame guard is done here, where MAUI raises the same event on
        // both platforms. Windows then layers the rest on top rather than
        // repeating this.
        Navigating += OnNavigating;
    }

    private void OnNavigating(object? sender, WebNavigatingEventArgs e)
    {
        if (AllowsTopLevel(e.Url)) return;

        e.Cancel = true;
        ReportBlocked(e.Url);
    }

    /// <summary>
    /// Stops the player for good, before the view is discarded.
    ///
    /// Must run while the control is still in the visual tree. On Windows the
    /// browser owns a composition surface of its own, and letting it be removed
    /// while it is still rendering is what produced the compositor faults the
    /// student saw on leaving a lecture.
    ///
    /// Nothing to do on Mac Catalyst: WKWebView draws through the same layer
    /// tree as everything else and is torn down with it.
    /// </summary>
    public void Shutdown()
    {
#if WINDOWS
        if (Handler?.PlatformView is Microsoft.UI.Xaml.FrameworkElement native)
            Platforms.Windows.SecurePlayerWebViewSetup.Detach(native);
#endif
    }

    /// <summary>
    /// The page allowed in the main frame. Set before the source, because the
    /// policy needs it the moment the first navigation starts.
    /// </summary>
    public Uri? AllowedPage { get; set; }

    /// <summary>
    /// Raised when a navigation was refused, so the screen can say so. Silence
    /// would leave a student clicking a control that does nothing with no idea
    /// why.
    /// </summary>
    public event EventHandler<string>? NavigationBlocked;

    internal void ReportBlocked(string target) => NavigationBlocked?.Invoke(this, target);

    /// <summary>
    /// Raised when the player's fullscreen control is used; true to expand.
    ///
    /// The page cannot do this itself. requestFullscreen() inside a web view
    /// fills the WEB VIEW, and this one is a fixed 920x518 box inside the
    /// lecture screen — the page would go fullscreen and nothing would visibly
    /// change. The host owns the layout, so the page asks and the host acts.
    /// </summary>
    public event EventHandler<bool>? FullscreenToggled;

    internal void ReportFullscreen(bool on) => FullscreenToggled?.Invoke(this, on);

    /// <summary>
    /// Reads a message posted by the injected player. Returns false for
    /// anything unrecognised — the channel carries exactly one message today,
    /// and an unknown payload is ignored rather than guessed at.
    /// </summary>
    internal static bool TryReadFullscreen(string? json, out bool on)
    {
        on = false;

        if (string.IsNullOrWhiteSpace(json) || !json.Contains("\"fullscreen\"")) return false;

        on = json.Contains("\"on\":true") || json.Contains("\"on\": true");
        return true;
    }

    /// <summary>
    /// True when the main frame may go to <paramref name="target"/>. Kept here
    /// so both platform handlers ask the same question of the same object.
    /// </summary>
    internal bool AllowsTopLevel(string? target) =>
        AllowedPage is not null && PlayerNavigationPolicy.AllowsTopLevel(AllowedPage, target);

    internal static bool AllowsFrame(string? target) => PlayerNavigationPolicy.AllowsFrame(target);

    internal static bool AllowsNewWindow() => PlayerNavigationPolicy.AllowsNewWindow();

    /// <summary>
    /// The injected player, read from Resources/Raw once and cached.
    ///
    /// Returns empty when the asset is missing rather than throwing: without it
    /// the student sees YouTube's own controls inside a view that still refuses
    /// to navigate anywhere, which is degraded but not a way out of the app.
    /// A crash here would be the worse outcome.
    /// </summary>
    internal static async Task<string> LoadInjectedScriptAsync()
    {
        if (_script is not null) return _script;

        try
        {
            await using var stream = await FileSystem.OpenAppPackageFileAsync("lesson-player.js");
            using var reader = new StreamReader(stream);

            _script = await reader.ReadToEndAsync();
        }
        catch (Exception)
        {
            _script = "";
        }

        return _script;
    }

    private static string? _script;
}
