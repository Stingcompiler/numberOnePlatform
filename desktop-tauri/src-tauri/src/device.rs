//! The identifier a student's account is bound to.
//!
//! This must produce BYTE FOR BYTE what the MAUI client produces. An account is
//! bound to one device and only an administrator can unbind it, so a client
//! that derives the id differently does not merely fail to sign in — it tells
//! every existing student their account belongs to another machine, with no
//! self-service way out. The algorithm below is `DeviceIdFormat.Derive` in
//! `NumberOne.Core`, transcribed, and there is a test that pins the output.
//!
//! Derived from hardware every time and NEVER written to disk. It is held for
//! the life of the process only, because the value must not change underneath a
//! running session — the same rule the MAUI provider states.
//!
//! Derivation lives in Rust rather than TypeScript on purpose. The namespace
//! salt would otherwise ship inside the JavaScript bundle, where anyone with
//! the app could read it and compute another machine's id from a MachineGuid.
//! That is a genuine improvement over MAUI, and it is recorded in PORT-NOTES.

use std::sync::OnceLock;

use serde::Serialize;
use sha2::{Digest, Sha256};

/// Namespacing salt. Keeps the published identifier from being a plain hash of
/// a value other software also knows, and scopes it to this app.
///
/// CHANGING THIS RE-BINDS EVERY INSTALLED CLIENT, and only an administrator can
/// unbind. It is fixed forever.
const NAMESPACE: &str = "numberone-schools-desktop";

/// 16 hex characters — 64 bits of the digest.
///
/// Eight would be 32 bits, where a few thousand school machines collide at
/// roughly 1-in-300, and a collision reaches the student as "this device
/// belongs to another student", permanently, with no administrative fix.
const HEX_LENGTH: usize = 16;

#[cfg(windows)]
const PREFIX: &str = "hw-win-";

#[cfg(target_os = "macos")]
const PREFIX: &str = "hw-mac-";

static CACHED: OnceLock<Result<String, String>> = OnceLock::new();

/// What the sign-in screen needs to show and send.
#[derive(Debug, Clone, Serialize)]
pub struct DeviceIdentity {
    pub id: String,
    /// "Windows" or "macOS" — `StudentProfile.detect_device_type` maps these.
    pub device_type: String,
    /// The machine name, for the device strip on the confirmation dialog.
    pub machine_name: String,
}

/// Turns a raw hardware identifier into the id sent as `device_id`.
///
/// Casing and GUID braces are normalised away first, so a platform that reports
/// `{4F2A...}` one day and `4f2a...` the next still yields one identifier for
/// one machine.
fn derive(prefix: &str, raw_machine_id: &str) -> Result<String, String> {
    let normalised = raw_machine_id
        .trim()
        .trim_matches(|c| c == '{' || c == '}')
        .to_lowercase();

    if normalised.is_empty() {
        return Err("raw machine identifier was empty".to_owned());
    }

    let digest = Sha256::digest(format!("{NAMESPACE}:{normalised}").as_bytes());

    let hex: String = digest
        .iter()
        .flat_map(|byte| [byte >> 4, byte & 0x0F])
        .take(HEX_LENGTH)
        .map(|nibble| char::from_digit(u32::from(nibble), 16).expect("nibble is 0-15"))
        .collect();

    Ok(format!("{prefix}{hex}"))
}

#[cfg(windows)]
fn read_raw() -> Result<String, String> {
    use winreg::enums::{HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_64KEY};
    use winreg::RegKey;

    // The 64-bit view, explicitly. A 32-bit process reading HKLM\SOFTWARE is
    // redirected to Wow6432Node, which holds a DIFFERENT MachineGuid — so the
    // same machine would bind under two identities depending on how the app
    // was built.
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    let key = hklm
        .open_subkey_with_flags(
            r"SOFTWARE\Microsoft\Cryptography",
            KEY_READ | KEY_WOW64_64KEY,
        )
        .map_err(|e| format!(r"could not open HKLM\SOFTWARE\Microsoft\Cryptography: {e}"))?;

    key.get_value::<String, _>("MachineGuid")
        .map_err(|e| format!("could not read MachineGuid: {e}"))
}

#[cfg(target_os = "macos")]
fn read_raw() -> Result<String, String> {
    // UNVERIFIED ON HARDWARE — see BLOCKERS.md. Windows ships first.
    Err("macOS device identity is not implemented yet".to_owned())
}

/// The identity, or the reason there is none.
///
/// A machine whose hardware id cannot be read is NOT given a random one. A
/// random value would bind the account to something that does not survive the
/// next launch, which is exactly the lockout this design exists to avoid, so
/// this fails loudly instead.
pub fn identity() -> Result<DeviceIdentity, String> {
    let id = CACHED
        .get_or_init(|| read_raw().and_then(|raw| derive(PREFIX, &raw)))
        .clone()?;

    Ok(DeviceIdentity {
        id,
        device_type: if cfg!(windows) { "Windows" } else { "macOS" }.to_owned(),
        machine_name: machine_name(),
    })
}

fn machine_name() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| String::new())
}

#[tauri::command]
pub fn device_identity() -> Result<DeviceIdentity, String> {
    identity()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Pins the algorithm against the C# one.
    ///
    /// If this fails, every already-bound student is about to be told their
    /// account belongs to another machine. It is not a test to relax.
    #[test]
    fn derives_the_same_id_as_the_maui_client() {
        // The expected value was computed from a SEPARATE implementation of
        // DeviceIdFormat.Derive rather than from this code, so the test can
        // fail. Checking only the shape — prefix, length, lower case — would
        // pass against a completely different digest and prove nothing.
        let id = derive("hw-win-", "{4F2A1B3C-5D6E-7F80-9A1B-2C3D4E5F6071}").unwrap();

        assert_eq!(id, "hw-win-343b9142d727f61c");
    }

    #[test]
    fn braces_and_casing_do_not_change_the_identity() {
        let braced = derive("hw-win-", "{4F2A1B3C-5D6E-7F80-9A1B-2C3D4E5F6071}").unwrap();
        let bare = derive("hw-win-", "4f2a1b3c-5d6e-7f80-9a1b-2c3d4e5f6071").unwrap();
        let padded = derive("hw-win-", "  4F2A1B3C-5D6E-7F80-9A1B-2C3D4E5F6071  ").unwrap();

        assert_eq!(braced, bare);
        assert_eq!(braced, padded);
    }

    #[test]
    fn an_empty_identifier_is_refused_rather_than_invented() {
        assert!(derive("hw-win-", "   ").is_err());
    }
}
