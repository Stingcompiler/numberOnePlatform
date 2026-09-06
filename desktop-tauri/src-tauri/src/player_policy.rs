//! What the lecture player is allowed to load.
//!
//! Content protection is the requirement here, not tidiness. A student must not
//! be able to reach YouTube from inside a lecture — not the watch page, not the
//! channel, not a new window, not a browser. Hiding a button is not enough: the
//! button is drawn by a cross-origin frame this app cannot restyle and cannot
//! be trusted to keep hiding after a YouTube-side change.
//!
//! So the rule is enforced one level below the page. Ported from
//! PlayerNavigationPolicy.cs, and kept pure so it can be tested exhaustively;
//! the runtime only wires its navigation handler to it.
//!
//! WHERE THIS SITS IN THE LAYERING — three layers, in order of how much they
//! can be trusted:
//!
//!   1. The browser's own iframe sandbox. Without `allow-top-navigation` a
//!      framed page CANNOT navigate the window, and without `allow-popups` its
//!      `window.open` returns null. This is declarative and there is no handler
//!      to fail — stronger than the event-cancelling MAUI had to use, because
//!      WebView2 gave it no sandbox to lean on.
//!
//!   2. This policy, on the app's own top-level navigation. The sandbox governs
//!      what a FRAME may do; this governs the window itself.
//!
//!   3. The CSP `frame-src` allowlist, which decides what may be framed at all.
//!
//! Getting this wrong is not a cosmetic bug, so every branch is tested.

/// Hosts the embedded player itself needs in order to render.
///
/// Deliberately not "anything at youtube.com": the watch page, the channel
/// pages and the search results all live on that host too, and those are
/// exactly what must stay unreachable. The path check is what separates them.
const FRAME_HOSTS: &[&str] = &[
    "www.youtube.com",
    "youtube.com",
    "www.youtube-nocookie.com",
    "youtube-nocookie.com",
];

/// The only paths the embed frame legitimately visits.
///
/// Everything YouTube offers as a way *out* — /watch, /channel, /user,
/// /results, /playlist, /shorts, /live, the bare homepage — is absent, and
/// absent BY DEFAULT: this is an allowlist, so a path nobody anticipated is
/// refused rather than permitted.
const FRAME_PATHS: &[&str] = &[
    "/embed/",
    "/youtubei/", // the player's own API calls
    "/s/player/", // player scripts
    "/error",     // YouTube's own "video unavailable" frame
];

/// A URL split into the parts this policy actually judges.
struct Parts<'a> {
    scheme: String,
    host: String,
    path: &'a str,
}

/// Parses only what is needed, and refuses anything it cannot parse.
///
/// Hand-rolled rather than pulling a URL crate in for three fields: the input is
/// a handful of shapes, and a parser that is too permissive here is an open
/// door rather than a wrong answer.
fn parse(target: &str) -> Option<Parts<'_>> {
    let target = target.trim();
    if target.is_empty() {
        return None;
    }

    // about:blank is how a web view starts and how some handlers reset it.
    if let Some(rest) = target.strip_prefix("about:") {
        return Some(Parts {
            scheme: "about".to_string(),
            host: String::new(),
            path: rest,
        });
    }

    let (scheme, rest) = target.split_once("://")?;
    let scheme = scheme.to_ascii_lowercase();

    let authority_end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
    let authority = &rest[..authority_end];

    // Userinfo before the host is how "https://www.youtube.com@evil.test/" gets
    // read as YouTube by a careless split. No URL this app loads has any, so
    // its presence is a refusal rather than something to parse around.
    if authority.contains('@') || authority.is_empty() {
        return None;
    }

    // A port is not part of the host comparison, but a host carrying one must
    // not silently match a bare host name.
    let host = authority
        .split(':')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();

    if host.is_empty() {
        return None;
    }

    let path = &rest[authority_end..];
    let path = path.split(['?', '#']).next().unwrap_or("");

    Some(Parts { scheme, host, path })
}

/// True only for the app's own page.
///
/// The window never has a reason to go anywhere for the whole life of the
/// screen: every screen is rendered by the app itself, and the lecture plays in
/// a framed page rather than by navigating. Anything else — a watch link, an
/// ad, a redirect, a mistyped route — is refused, which is what makes "the
/// student cannot leave the app through the player" a property of the app
/// rather than a hope about YouTube's markup.
pub fn allows_top_level(target: &str) -> bool {
    let Some(parts) = parse(target) else {
        return false;
    };

    match parts.scheme.as_str() {
        // How the webview starts, and how it is reset.
        "about" => true,

        // Tauri serves the app from its own scheme: http://tauri.localhost on
        // Windows, tauri://localhost elsewhere.
        "tauri" => true,
        "http" | "https" => parts.host == "tauri.localhost" || is_dev_server(&parts.host),

        // Everything else — file:, javascript:, ms-settings:, a real web page.
        _ => false,
    }
}

/// The Vite dev server, and ONLY in a debug build.
///
/// A binary built with plain `cargo build` loads `devUrl` rather than the
/// bundled frontend, so refusing localhost refuses the app's own startup and
/// leaves a blank window — which is how this was found, and is exactly the
/// failure a policy like this one causes when it is too strict rather than too
/// loose. `debug_assertions` is off in release, so a shipped build refuses
/// localhost like any other host.
fn is_dev_server(host: &str) -> bool {
    cfg!(debug_assertions) && (host == "localhost" || host == "127.0.0.1")
}

/// True for the sub-frame navigations the YouTube embed makes to play a video,
/// and false for every other YouTube destination.
///
/// The frame has to be allowed to navigate at all — that is how the video plays
/// — so this cannot simply refuse everything the way the window does. It
/// refuses by path instead.
pub fn allows_frame(target: &str) -> bool {
    let Some(parts) = parse(target) else {
        return false;
    };

    if parts.scheme == "about" {
        return true;
    }

    if parts.scheme != "http" && parts.scheme != "https" {
        return false;
    }

    if !FRAME_HOSTS.contains(&parts.host.as_str()) {
        return false;
    }

    let path = parts.path.to_ascii_lowercase();
    FRAME_PATHS.iter().any(|allowed| path.starts_with(allowed))
}

/// The embed URL for a video, or nothing when the id is not one.
///
/// BUILT HERE RATHER THAN IN TYPESCRIPT so that the string which ends up in the
/// frame and the allowlist that judges it live in the same file. The UI asking
/// for a URL it cannot construct itself is the difference between a policy that
/// governs the player and a policy that merely agrees with it.
///
/// The result is put through `allows_frame` before it is returned — a check
/// against our own output, which is the one that catches a mistake here rather
/// than a mistake upstream.
///
/// Query parameters, and why each is present:
///   controls=0        YouTube's bar carries its logo, its share button and
///                     "Watch on YouTube". The app draws its own instead.
///   fs=0              YouTube's fullscreen would escape the capture-protected
///                     window. Fullscreen is the host's, inside the app.
///   rel=0             no related videos at the end of a lecture.
///   iv_load_policy=3  no annotation layer.
///   disablekb=1       YouTube's shortcuts, replaced by the app's own.
///   modestbranding=1  what little branding remains.
///   enablejsapi=1     the postMessage channel the controls speak over.
#[tauri::command]
pub fn player_frame_url(video_id: String, origin: String) -> Option<String> {
    if !is_video_id(&video_id) {
        return None;
    }

    // nocookie: the same video without the ad-profile cookies. These are school
    // machines and the students are children.
    let url = format!(
        "https://www.youtube-nocookie.com/embed/{video_id}?{PLAYER_PARAMS}&origin={}",
        urlencode(&origin)
    );

    allows_frame(&url).then_some(url)
}

/// The query the embed is given. Every one of these closes a door.
const PLAYER_PARAMS: &str = "enablejsapi=1&controls=0&modestbranding=1&rel=0\
&iv_load_policy=3&fs=0&disablekb=1&playsinline=1";

/// A YouTube id: eleven characters in practice, but the server has been seen to
/// store other lengths, so the bound is loose and the alphabet is strict.
fn is_video_id(value: &str) -> bool {
    (6..=20).contains(&value.len())
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// Percent-encodes everything that is not unreserved. Small on purpose: the one
/// value that goes through it is an origin.
fn urlencode(value: &str) -> String {
    value
        .bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

/// The navigation guard, as a plugin.
///
/// A plugin rather than a builder hook because that is where this Tauri version
/// exposes the callback — and it applies to every webview the app ever creates,
/// so a second one added later cannot quietly ship without the guard.
pub fn plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("player-policy")
        .on_navigation(|_webview, url| {
            let target = url.as_str();
            let allowed = allows_top_level(target);

            if !allowed {
                // A refused navigation is silent by design — nothing happens,
                // which is the point. It is logged so a legitimate destination
                // that this policy refuses can be found, rather than presenting
                // as a control that does nothing.
                eprintln!("[player-policy] refused top-level navigation: {target}");
            }

            allowed
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── The window ─────────────────────────────────────────────────────────

    #[test]
    fn the_window_may_load_the_app_and_nothing_else() {
        assert!(allows_top_level("http://tauri.localhost/"));
        assert!(allows_top_level("http://tauri.localhost/index.html"));
        assert!(allows_top_level("tauri://localhost/"));
        assert!(allows_top_level("about:blank"));
    }

    #[test]
    fn the_window_never_goes_to_youtube() {
        assert!(!allows_top_level("https://www.youtube.com/watch?v=abc123"));
        assert!(!allows_top_level("https://www.youtube.com/embed/abc123"));
        assert!(!allows_top_level("https://youtube.com/"));
    }

    #[test]
    fn the_window_never_goes_to_the_school_site_either() {
        // The API is spoken to over HTTP from Rust. The window rendering a page
        // of the site would be the app replaced by a website.
        assert!(!allows_top_level(
            "https://numberoneschools.com/academic/player/"
        ));
    }

    #[test]
    fn the_dev_server_is_the_app_too_in_a_debug_build() {
        // Refusing this refused the app's own startup and left a blank window.
        // The assertion is written both ways round so it keeps its meaning in
        // whichever profile the suite is run under.
        assert_eq!(allows_top_level("http://localhost:1420/"), cfg!(debug_assertions));
        assert_eq!(allows_top_level("http://127.0.0.1:1420/"), cfg!(debug_assertions));
    }

    #[test]
    fn the_dev_exception_does_not_open_the_whole_web() {
        // Only the loopback names, and only as the HOST — not as a suffix, a
        // subdomain, or the userinfo of somebody else's server.
        assert!(!allows_top_level("http://localhost.evil.test/"));
        assert!(!allows_top_level("http://evil.localhost/"));
        assert!(!allows_top_level("http://localhost@evil.test/"));
    }

    #[test]
    fn a_host_that_merely_contains_ours_is_not_ours() {
        assert!(!allows_top_level("http://evil.tauri.localhost/"));
        assert!(!allows_top_level("http://tauri.localhost.evil.test/"));
    }

    #[test]
    fn userinfo_cannot_disguise_a_host() {
        // "https://tauri.localhost@evil.test/" is a page on evil.test.
        assert!(!allows_top_level("http://tauri.localhost@evil.test/"));
        assert!(!allows_frame("https://www.youtube.com@evil.test/embed/x"));
    }

    #[test]
    fn non_web_schemes_are_refused() {
        assert!(!allows_top_level("file:///C:/Windows/System32/cmd.exe"));
        assert!(!allows_top_level("javascript:alert(1)"));
        assert!(!allows_top_level("ms-settings:privacy"));
        assert!(!allows_top_level(""));
    }

    // ── The frame ──────────────────────────────────────────────────────────

    #[test]
    fn the_frame_may_play_a_video() {
        assert!(allows_frame("https://www.youtube.com/embed/M7lc1UVf-VE"));
        assert!(allows_frame(
            "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?rel=0"
        ));
        assert!(allows_frame("https://www.youtube.com/youtubei/v1/player?key=x"));
        assert!(allows_frame("https://www.youtube.com/s/player/abc/base.js"));
        assert!(allows_frame("https://www.youtube.com/error?src=0"));
    }

    #[test]
    fn the_frame_may_not_reach_a_way_out() {
        // Every one of these is a route back into YouTube proper.
        for path in [
            "/watch?v=abc123",
            "/channel/UC123",
            "/user/someone",
            "/results?search_query=x",
            "/playlist?list=PL1",
            "/shorts/abc123",
            "/live/abc123",
            "/",
        ] {
            let url = format!("https://www.youtube.com{path}");
            assert!(!allows_frame(&url), "should refuse {url}");
        }
    }

    #[test]
    fn the_frame_may_not_leave_youtube() {
        assert!(!allows_frame("https://accounts.google.com/signin"));
        assert!(!allows_frame("https://evil.test/embed/abc123"));
        assert!(!allows_frame("https://numberoneschools.com/embed/abc"));
    }

    #[test]
    fn an_unanticipated_path_is_refused_not_permitted() {
        // The allowlist's whole point: a path YouTube adds tomorrow stays
        // refused until somebody decides otherwise.
        assert!(!allows_frame("https://www.youtube.com/newthing/abc"));
    }

    // ── The URL the frame is actually given ────────────────────────────────

    #[test]
    fn builds_a_url_its_own_allowlist_accepts() {
        let url = player_frame_url("M7lc1UVf-VE".into(), "http://tauri.localhost".into())
            .expect("a valid id should produce a URL");

        assert!(url.starts_with("https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?"));
        assert!(allows_frame(&url));
    }

    #[test]
    fn the_url_closes_youtubes_own_doors() {
        let url = player_frame_url("M7lc1UVf-VE".into(), "http://tauri.localhost".into()).unwrap();

        // Each of these is a way out of the lecture if left at its default.
        for required in ["controls=0", "fs=0", "rel=0", "disablekb=1", "iv_load_policy=3"] {
            assert!(url.contains(required), "missing {required} in {url}");
        }
    }

    #[test]
    fn the_origin_is_encoded_not_pasted() {
        let url = player_frame_url("M7lc1UVf-VE".into(), "http://tauri.localhost".into()).unwrap();
        assert!(url.contains("origin=http%3A%2F%2Ftauri.localhost"));
    }

    #[test]
    fn an_id_that_is_not_an_id_yields_no_url() {
        // A path traversal, a query injection, and an empty string: each would
        // otherwise be pasted straight into the frame's src.
        for bad in ["../../watch", "abc?list=PL1", "abc&fs=1", "", "x", &"a".repeat(21)] {
            assert!(
                player_frame_url(bad.into(), "http://tauri.localhost".into()).is_none(),
                "should refuse {bad:?}"
            );
        }
    }
}
