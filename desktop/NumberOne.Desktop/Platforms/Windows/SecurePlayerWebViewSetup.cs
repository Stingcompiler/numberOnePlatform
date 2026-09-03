using Microsoft.Web.WebView2.Core;
using NumberOne.Desktop.Controls;

namespace NumberOne.Desktop.Platforms.Windows;

/// <summary>
/// Locks a WebView2 down to the lecture and nothing else.
///
/// Everything here is enforcement, not decoration. WebView2 will otherwise open
/// new windows on request, offer its own context menu with "Open link in new
/// tab", preview URLs in a status bar, and honour F12 and Ctrl+N — every one of
/// which is a way out of a lecture the school is trying to keep inside the app.
///
/// The navigation handlers are the part that actually holds. They fire for any
/// navigation whatever its cause, so a YouTube markup change, a script, a
/// redirect or a middle-click all arrive at the same refusal.
/// </summary>
internal static class SecurePlayerWebViewSetup
{
    /// <summary>
    /// Wires the control to its platform view. Safe to call before the
    /// CoreWebView2 exists — configuration is deferred until it does.
    /// </summary>
    public static void Attach(SecurePlayerWebView control, Microsoft.UI.Xaml.FrameworkElement platformView)
    {
        if (platformView is not Microsoft.UI.Xaml.Controls.WebView2 native) return;

        // The window is RightToLeft and WinUI mirrors a web view that inherits
        // it, flipping the picture — writing on a board then reads backwards,
        // which on a maths lecture makes the equations unreadable.
        native.FlowDirection = Microsoft.UI.Xaml.FlowDirection.LeftToRight;

        if (native.CoreWebView2 is not null)
        {
            Configure(control, native.CoreWebView2);
            return;
        }

        native.CoreWebView2Initialized += (sender, _) =>
        {
            if (sender.CoreWebView2 is not null) Configure(control, sender.CoreWebView2);
        };
    }

    private static void Configure(SecurePlayerWebView control, CoreWebView2 core)
    {
        var settings = core.Settings;

        // "Open link in new tab", "Save link as", "Copy link address" — the
        // context menu is a complete set of exits on its own.
        settings.AreDefaultContextMenusEnabled = false;

        // F12 would let a student reach the frame's real URL directly.
        settings.AreDevToolsEnabled = false;

        // Ctrl+N, Ctrl+T, Ctrl+O, Alt+Left. Browser keys in an app window.
        settings.AreBrowserAcceleratorKeysEnabled = false;

        // The hover preview that shows where a link goes; nothing here should
        // advertise a destination the view will refuse anyway.
        settings.IsStatusBarEnabled = false;

        settings.IsSwipeNavigationEnabled = false;
        settings.IsZoomControlEnabled = false;
        settings.IsGeneralAutofillEnabled = false;
        settings.IsPasswordAutosaveEnabled = false;

        // ── The layer that actually holds ────────────────────────────────────

        // "Watch on YouTube", the share sheet, a middle-click: all of them ask
        // the host for a window. None is ever granted, and nothing is opened in
        // its place — the click simply does nothing.
        core.NewWindowRequested += (_, e) =>
        {
            e.Handled = true;

            if (!SecurePlayerWebView.AllowsNewWindow())
                control.ReportBlocked(e.Uri ?? "");
        };

        // The page must never navigate the whole view away from the lecture.
        core.NavigationStarting += (_, e) =>
        {
            if (control.AllowsTopLevel(e.Uri)) return;

            e.Cancel = true;
            control.ReportBlocked(e.Uri ?? "");
        };

        // The embed frame has to navigate — that is how a video plays — so it
        // is filtered by path rather than refused outright.
        core.FrameNavigationStarting += (_, e) =>
        {
            if (SecurePlayerWebView.AllowsFrame(e.Uri)) return;

            e.Cancel = true;
            control.ReportBlocked(e.Uri ?? "");
        };

        // A page that asks to close the window is not a lecture doing its job.
        core.WindowCloseRequested += (_, _) => { };

        // No downloads: the lecture is for watching.
        core.DownloadStarting += (_, e) => e.Cancel = true;

        // No permission prompts inside a lecture — camera, mic, location.
        core.PermissionRequested += (_, e) =>
        {
            e.State = CoreWebView2PermissionState.Deny;
            e.Handled = true;
        };

        InjectPlayer(core);
    }

    /// <summary>
    /// Adds the player script so it runs before any of the page's own script,
    /// on this document and every one after it.
    /// </summary>
    private static async void InjectPlayer(CoreWebView2 core)
    {
        try
        {
            var script = await SecurePlayerWebView.LoadInjectedScriptAsync();

            if (script.Length > 0)
                await core.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }
        catch (Exception)
        {
            // The view still refuses to navigate anywhere without this, so a
            // failed injection is a worse player rather than an open door.
        }
    }
}
