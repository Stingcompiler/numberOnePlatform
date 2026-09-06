//! The desktop client's Rust side.
//!
//! Kept deliberately thin. Rust is here only for the surfaces a WebView cannot
//! reach — content protection now, and later the device identity and the
//! secret store. Everything a browser can do is TypeScript, per the brief.
//!
//! MODULES ARE THE PLATFORM SEAM. Windows ships first and macOS follows, so
//! each native surface lives behind its own module with a `#[cfg]` split
//! inside it rather than a Windows-only call sprinkled through the app. Adding
//! macOS should be filling in the other half of these files, not rewriting.

mod device;
mod external;
mod player_policy;
#[cfg(debug_assertions)]
mod harness;
mod protection;
mod secrets;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        // The window itself never navigates. Every screen is rendered by the
        // app, and the lecture plays in a framed page rather than by going
        // anywhere — so anything that asks the WINDOW to move is a way out of
        // the app, whatever provoked it: a click, a script, a redirect, a
        // middle-click. See player_policy.rs for the layering.
        .plugin(player_policy::plugin())
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("the window named 'main' is declared in tauri.conf.json");

            // Applied before anything is drawn, and the result is kept so the
            // UI can report what the OS actually said rather than what we
            // hoped. A failure here is not fatal to startup — a student left
            // staring at a window that never opened learns less than one whose
            // app tells them protection is off.
            let status = protection::apply(&window);

            if !status.verified {
                eprintln!("[protection] NOT VERIFIED: {}", status.detail);
            }

            app.manage(status);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            protection::protection_status,
            device::device_identity,
            external::open_external,
            player_policy::player_frame_url,
            secrets::tokens_get,
            secrets::tokens_save,
            secrets::tokens_clear,
            // Debug only: lets a batch be measured instead of described.
            // Compiled out of release builds entirely — see harness.rs.
            #[cfg(debug_assertions)]
            harness::harness_credentials,
            #[cfg(debug_assertions)]
            harness::harness_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running the application");
}
