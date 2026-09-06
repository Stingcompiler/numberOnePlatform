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

mod protection;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
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
        .invoke_handler(tauri::generate_handler![protection::protection_status])
        .run(tauri::generate_context!())
        .expect("error while running the application");
}
