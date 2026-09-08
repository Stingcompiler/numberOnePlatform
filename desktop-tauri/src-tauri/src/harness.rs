//! Scaffolding for verifying a batch, present in debug builds only.
//!
//! WebView2 does not expose its DOM to UI Automation unless a screen reader is
//! running, so the batch harness cannot be driven by clicking. Without a way to
//! drive it, "authentication works" would be a claim rather than a measurement
//! — and this project has already been burned once by shipping a fix that was
//! never actually exercised.
//!
//! So the harness can run itself and write what happened to a file. Credentials
//! come from the environment, never from source, and the whole module is
//! compiled out of release builds.
//!
//! Deleted along with the harness screen when the real screens land in batch 4.

#![cfg(debug_assertions)]

use std::io::Write;
use std::path::PathBuf;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct HarnessCredentials {
    pub username: String,
    pub password: String,
    /// Which screen to land on, so a batch can be checked without clicking.
    pub route: Option<String>,
}

fn log_path() -> PathBuf {
    std::env::temp_dir().join("numberone-harness.log")
}

/// Returns credentials only when both variables are set, so an ordinary
/// `tauri dev` run stays interactive.
#[tauri::command]
pub fn harness_credentials() -> Option<HarnessCredentials> {
    let username = std::env::var("NUMBERONE_HARNESS_USER").ok()?;
    let password = std::env::var("NUMBERONE_HARNESS_PASS").ok()?;

    Some(HarnessCredentials {
        username,
        password,
        route: std::env::var("NUMBERONE_HARNESS_ROUTE").ok(),
    })
}

/// Appends one line. Failure is ignored: a harness that cannot write its log
/// must not take the app down with it.
#[tauri::command]
pub fn harness_log(line: String) {
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path())
    {
        let _ = writeln!(file, "{line}");
    }
}
