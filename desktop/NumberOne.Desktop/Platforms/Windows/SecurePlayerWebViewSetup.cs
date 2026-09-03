using System.Runtime.CompilerServices;
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
///
/// TWO RULES for anything added here.
///
/// Configure runs ONCE per CoreWebView2. HandlerChanged fires more than once
/// over a view's life — on creation, on reparenting, on teardown — and each
/// call used to subscribe another full set of handlers and inject the player
/// script again, so a second copy of the whole UI was built on top of the
/// first.
///
/// And every handler body catches. A WebView2 event runs on the UI thread with
/// native frames beneath it; an exception escaping one arrives as a COMException
/// with no message and no managed stack, which is unreadable and fatal. A
/// failure inside our own handler must not be either.
/// </summary>
internal static class SecurePlayerWebViewSetup
{
    /// <summary>
    /// The cores already configured. Weak, so a closed lecture's WebView2 is
    /// collected rather than pinned here for the life of the app.
    /// </summary>
    private static readonly ConditionalWeakTable<CoreWebView2, object> Configured = new();

    /// <summary>
    /// Wires the control to its platform view. Safe to call before the
    /// CoreWebView2 exists — configuration is deferred until it does — and safe
    /// to call repeatedly, which HandlerChanged guarantees it will be.
    /// </summary>
    public static void Attach(SecurePlayerWebView control, Microsoft.UI.Xaml.FrameworkElement platformView)
    {
        if (platformView is not Microsoft.UI.Xaml.Controls.WebView2 native) return;

        try
        {
            // The window is RightToLeft and WinUI mirrors a web view that
            // inherits it, flipping the picture — writing on a board then reads
            // backwards, which on a maths lecture makes the equations
            // unreadable.
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
        catch (Exception ex)
        {
            // A view being torn down as this runs throws from native code. The
            // lecture is already going away; taking the app with it is not an
            // improvement.
            App.RecordUnhandled("PlayerAttach", ex);
        }
    }

    private static void Configure(SecurePlayerWebView control, CoreWebView2 core)
    {
        // Once per core. Subscribing twice meant two cancels per navigation and
        // two copies of the injected player.
        if (Configured.TryGetValue(core, out _)) return;
        Configured.Add(core, new object());

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
        core.NewWindowRequested += (_, e) => Guarded("NewWindow", () =>
        {
            e.Handled = true;

            if (!SecurePlayerWebView.AllowsNewWindow())
                control.ReportBlocked(e.Uri ?? "");
        });

        // The page must never navigate the whole view away from the lecture.
        core.NavigationStarting += (_, e) => Guarded("Navigation", () =>
        {
            if (control.AllowsTopLevel(e.Uri)) return;

            e.Cancel = true;
            control.ReportBlocked(e.Uri ?? "");
        });

        // The embed frame has to navigate — that is how a video plays — so it
        // is filtered by path rather than refused outright.
        core.FrameNavigationStarting += (_, e) => Guarded("FrameNavigation", () =>
        {
            if (SecurePlayerWebView.AllowsFrame(e.Uri)) return;

            e.Cancel = true;
            control.ReportBlocked(e.Uri ?? "");
        });

        // A page that asks to close the window is not a lecture doing its job.
        core.WindowCloseRequested += (_, _) => { };

        // The one message the injected player sends: its fullscreen control.
        core.WebMessageReceived += (_, e) => Guarded("WebMessage", () =>
        {
            string payload;

            try { payload = e.TryGetWebMessageAsString(); }
            catch (Exception) { return; }   // not a string message

            if (SecurePlayerWebView.TryReadFullscreen(payload, out var on))
                control.ReportFullscreen(on);
        });

        // No downloads: the lecture is for watching.
        core.DownloadStarting += (_, e) => Guarded("Download", () => e.Cancel = true);

        // No permission prompts inside a lecture — camera, mic, location.
        core.PermissionRequested += (_, e) => Guarded("Permission", () =>
        {
            e.State = CoreWebView2PermissionState.Deny;
            e.Handled = true;
        });

        InjectPlayer(core);
    }

    /// <summary>
    /// Runs a handler body without letting it escape into native frames.
    ///
    /// An exception thrown inside a WebView2 event surfaces as a COMException
    /// with an empty message and no managed stack — fatal, and impossible to
    /// read. Whatever went wrong, the lecture is better served by one refused
    /// interaction than by the app ending.
    /// </summary>
    private static void Guarded(string where, Action body)
    {
        try
        {
            body();
        }
        catch (Exception ex)
        {
            App.RecordUnhandled("Player." + where, ex);
        }
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
        catch (Exception ex)
        {
            // The view still refuses to navigate anywhere without this, so a
            // failed injection is a worse player rather than an open door.
            App.RecordUnhandled("PlayerInject", ex);
        }
    }
}
