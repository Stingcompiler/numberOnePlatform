namespace NumberOne.Core.Services;

/// <summary>
/// What the lecture player's web view is allowed to navigate to.
///
/// Content protection is the requirement here, not tidiness. A student must not
/// be able to reach YouTube from inside a lecture — not the watch page, not the
/// channel, not a new window, not a browser. Hiding a button is not enough,
/// because the button is drawn by a cross-origin frame this app cannot restyle
/// and cannot be trusted to keep hiding after a YouTube-side change.
///
/// So the rule is enforced one level below the page: every navigation the view
/// attempts is put to this policy first, and anything that is not the lecture
/// itself is refused. That holds however the navigation was provoked — a click,
/// a script, a middle-click, a keyboard shortcut, a redirect.
///
/// It lives in Core and is pure so it can be tested exhaustively; the platform
/// layers only wire their events to it. Getting this wrong is not a cosmetic
/// bug, so it is the one piece of the player with tests around every branch.
/// </summary>
public static class PlayerNavigationPolicy
{
    /// <summary>
    /// Hosts the embedded player itself needs in order to render.
    ///
    /// Deliberately not "anything at youtube.com": the watch page, the channel
    /// pages and the search results all live on that host too, and those are
    /// exactly what must stay unreachable. The path check in
    /// <see cref="AllowsFrame"/> is what separates them.
    /// </summary>
    private static readonly string[] FrameHosts =
    {
        "www.youtube.com",
        "youtube.com",
        "www.youtube-nocookie.com",
        "youtube-nocookie.com",
    };

    /// <summary>
    /// The only paths the embed frame legitimately visits. Everything YouTube
    /// offers as a way *out* — /watch, /channel, /user, /results, /playlist,
    /// /shorts, /live, the bare homepage — is absent, and absent by default:
    /// this is an allowlist, so a path nobody anticipated is refused rather
    /// than permitted.
    /// </summary>
    private static readonly string[] FramePaths =
    {
        "/embed/",
        "/youtubei/",   // the player's own API calls
        "/s/player/",   // player scripts
        "/error",       // YouTube's own "video unavailable" frame
    };

    /// <summary>
    /// True only for the lecture player page on the school's own host.
    ///
    /// The main frame never has a reason to go anywhere else for the whole life
    /// of the screen. Anything else — a watch link, an ad, a redirect, a
    /// mistyped route — is refused, which is what makes "the student cannot
    /// leave the app through the player" a property of the app rather than a
    /// hope about YouTube's markup.
    /// </summary>
    public static bool AllowsTopLevel(Uri playerPage, string? target)
    {
        if (!TryParse(target, out var uri)) return false;

        // about:blank is how a web view starts and how some handlers reset it;
        // refusing it would break the control before it ever loaded a lecture.
        if (uri.Scheme == "about") return true;

        if (uri.Scheme is not ("http" or "https")) return false;

        return SameHost(uri, playerPage) &&
               uri.AbsolutePath.Equals(playerPage.AbsolutePath, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// True for the sub-frame navigations the YouTube embed makes to play a
    /// video, and false for every other YouTube destination.
    ///
    /// The frame has to be allowed to navigate at all — that is how the video
    /// plays — so this cannot simply refuse everything the way the main frame
    /// does. It refuses by path instead.
    /// </summary>
    public static bool AllowsFrame(string? target)
    {
        if (!TryParse(target, out var uri)) return false;

        if (uri.Scheme == "about") return true;
        if (uri.Scheme is not ("http" or "https")) return false;

        if (!FrameHosts.Contains(uri.Host, StringComparer.OrdinalIgnoreCase)) return false;

        return FramePaths.Any(path =>
            uri.AbsolutePath.StartsWith(path, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Whether a new window, tab or popup may ever be opened. It may not.
    ///
    /// This is a method rather than a bare `false` at the call sites so the
    /// intent is greppable and so the one place that decides it is the same
    /// place the tests point at. "Watch on YouTube", the share sheet and a
    /// middle-click all arrive here.
    /// </summary>
    public static bool AllowsNewWindow() => false;

    private static bool TryParse(string? value, out Uri uri)
    {
        uri = null!;

        return !string.IsNullOrWhiteSpace(value) &&
               Uri.TryCreate(value, UriKind.Absolute, out uri!);
    }

    private static bool SameHost(Uri a, Uri b) =>
        string.Equals(a.Host, b.Host, StringComparison.OrdinalIgnoreCase);
}
