//! Opening a link in the student's own browser.
//!
//! Live sessions are Zoom / Meet / Teams / YouTube links that open OUTSIDE the
//! app — there is no player and no embed, by design. The WebView cannot do this
//! itself: `target="_blank"` is intercepted by the runtime, and a page that
//! navigates the window away would replace the app with a meeting.
//!
//! THE SCHEME CHECK LIVES HERE, not in the UI. The URL comes from the API, so
//! it is data the client does not control, and a `file:` or `javascript:` link
//! reaching the shell is a different class of problem than a broken meeting
//! link. Checking it in TypeScript would put the guard on the side of the
//! boundary that the untrusted value has already crossed.

use tauri::command;

/// Why a link could not be opened. The wording is the student's, not a log's.
const INVALID: &str = "رابط الجلسة غير صالح — راجع الإدارة";
const NO_BROWSER: &str = "تعذّر فتح المتصفح على هذا الجهاز";

/// Opens an http/https URL in the system browser.
///
/// Returns the message to show on failure, or `None` when the shell accepted
/// it. It never returns an error: a link that will not open is something the
/// student is told about, not an exception.
#[command]
pub fn open_external(url: String) -> Option<String> {
    if !is_web_url(&url) {
        return Some(INVALID.to_string());
    }

    if open(&url) {
        None
    } else {
        Some(NO_BROWSER.to_string())
    }
}

/// http and https only, and the host must be present.
///
/// Parsed rather than prefix-matched: "https:/evil" and "https://" both start
/// with an accepted scheme and neither is a page.
fn is_web_url(url: &str) -> bool {
    let Some((scheme, rest)) = url.split_once("://") else {
        return false;
    };

    let scheme = scheme.to_ascii_lowercase();
    if scheme != "http" && scheme != "https" {
        return false;
    }

    // A host has to be there and cannot contain whitespace — ShellExecuteW
    // takes the whole string, and a space is where a second argument would
    // start if this ever went through a command line instead.
    let host = rest.split(['/', '?', '#']).next().unwrap_or("");
    !host.is_empty() && !url.chars().any(char::is_whitespace)
}

#[cfg(windows)]
fn open(url: &str) -> bool {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    fn wide(value: &str) -> Vec<u16> {
        std::ffi::OsStr::new(value)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    let verb = wide("open");
    let target = wide(url);

    // SAFETY: both pointers are null-terminated wide strings that outlive the
    // call, and the remaining arguments are null/zero as the API allows.
    let result = unsafe {
        ShellExecuteW(
            None,
            PCWSTR(verb.as_ptr()),
            PCWSTR(target.as_ptr()),
            PCWSTR::null(),
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };

    // ShellExecuteW returns a value GREATER than 32 on success. It is an
    // HINSTANCE for compatibility with 16-bit Windows and is not a handle.
    result.0 as isize > 32
}

#[cfg(not(windows))]
fn open(_url: &str) -> bool {
    // macOS lands with its own batch; saying so beats silently reporting
    // success for something that did not happen.
    false
}

#[cfg(test)]
mod tests {
    use super::is_web_url;

    #[test]
    fn accepts_the_links_the_api_actually_sends() {
        assert!(is_web_url("https://zoom.us/j/123456789"));
        assert!(is_web_url("http://meet.google.com/abc-defg-hij"));
        assert!(is_web_url("https://www.youtube.com/watch?v=x#t=10"));
    }

    #[test]
    fn refuses_anything_that_is_not_a_page() {
        assert!(!is_web_url("file:///C:/Windows/System32/cmd.exe"));
        assert!(!is_web_url("javascript:alert(1)"));
        assert!(!is_web_url("ms-settings:privacy"));
        assert!(!is_web_url(""));
    }

    #[test]
    fn refuses_a_scheme_with_no_host() {
        assert!(!is_web_url("https://"));
        assert!(!is_web_url("https:/example.com"));
    }

    #[test]
    fn refuses_whitespace() {
        // Where a second argument would begin if this ever went through a
        // command line rather than the shell API.
        assert!(!is_web_url("https://example.com/a b"));
        assert!(!is_web_url("https://example.com\t--flag"));
    }
}
