//! Content protection: keeps the window out of screen captures.
//!
//! The MAUI app calls `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)`
//! and returns whether the call succeeded. Tauri's `set_content_protected`
//! makes the same call on Windows, and sets `NSWindow.sharingType = .none` on
//! macOS — where MAUI has nothing at all, because that property is not
//! reachable from Mac Catalyst. See PORT-AUDIT section 5-1.
//!
//! The brief says: verify the call succeeded rather than assume it. So this
//! does not stop at `Ok(())`. On Windows it reads the affinity back out of the
//! OS with `GetWindowDisplayAffinity` and checks it is the value we asked for.
//! A call that returns Ok while the window is still capturable is exactly the
//! failure this layer exists to prevent, and it is the one a student would
//! never notice.

use serde::Serialize;
use tauri::{Manager, Runtime, WebviewWindow};

/// What actually happened, for the UI and for the log. Both fields are needed:
/// `requested` failing is a bug in our call, `verified` failing while
/// `requested` succeeded is the platform not doing what it said.
#[derive(Debug, Clone, Serialize)]
pub struct ProtectionStatus {
    pub requested: bool,
    pub verified: bool,
    pub detail: String,
}

/// Applies protection to the window and reports what the OS says afterwards.
pub fn apply<R: Runtime>(window: &WebviewWindow<R>) -> ProtectionStatus {
    let requested = match window.set_content_protected(true) {
        Ok(()) => true,
        Err(error) => {
            return ProtectionStatus {
                requested: false,
                verified: false,
                detail: format!("set_content_protected رفض الطلب: {error}"),
            };
        }
    };

    let (verified, detail) = read_back(window);

    ProtectionStatus {
        requested,
        verified,
        detail,
    }
}

#[cfg(windows)]
fn read_back<R: Runtime>(window: &WebviewWindow<R>) -> (bool, String) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE,
    };

    let handle = match window.hwnd() {
        Ok(h) => HWND(h.0),
        Err(error) => return (false, format!("تعذّر الحصول على مقبض النافذة: {error}")),
    };

    let mut affinity = 0u32;

    // SAFETY: `handle` came from the live window we were just handed, and
    // `affinity` is a stack u32 the call only writes to.
    let read = unsafe { GetWindowDisplayAffinity(handle, &mut affinity) };

    if read.is_err() {
        return (false, "GetWindowDisplayAffinity فشل".to_owned());
    }

    let expected = WDA_EXCLUDEFROMCAPTURE.0;

    if affinity == expected {
        (
            true,
            format!("WDA_EXCLUDEFROMCAPTURE مؤكَّدة (affinity = 0x{affinity:02X})"),
        )
    } else {
        (
            false,
            format!(
                "النظام يقول affinity = 0x{affinity:02X} بينما المطلوب 0x{expected:02X} — \
                 النافذة ما زالت قابلة للالتقاط"
            ),
        )
    }
}

#[cfg(not(windows))]
fn read_back<R: Runtime>(_window: &WebviewWindow<R>) -> (bool, String) {
    // macOS has no equivalent of GetWindowDisplayAffinity: sharingType can be
    // set but there is no supported read-back through Tauri today. Reported
    // honestly as unverified rather than assumed — see BLOCKERS.md.
    (
        false,
        "المنصّة لا تتيح قراءة الحالة للتأكيد؛ الطلب نُفّذ ولم يُتحقق منه".to_owned(),
    )
}

/// Lets the UI show the real state instead of a reassuring guess.
#[tauri::command]
pub fn protection_status(app: tauri::AppHandle) -> ProtectionStatus {
    app.state::<ProtectionStatus>().inner().clone()
}
