//! Where the token pair lives.
//!
//! The OS credential store, not a file we encrypt ourselves. MAUI uses MAUI
//! SecureStorage, which is DPAPI on Windows and the Keychain on macOS — keys
//! the operating system manages and scopes to the signed-in user.
//!
//! `tauri-plugin-stronghold` was the obvious alternative and is weaker here: it
//! is an encrypted file, and its key has to live somewhere. On a shared school
//! machine that is a step down from DPAPI, and porting is not the moment to
//! quietly change a threat model. The `keyring` crate reaches Credential
//! Manager on Windows and the Keychain on macOS behind one API, so "Windows
//! now, macOS later" costs nothing here.
//!
//! Reads are memoised for the life of the process, as in MAUI: the store is
//! consulted on nearly every request, and each hit is a call into the platform
//! keystore.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};

/// Named as in MAUI for legibility, NOT for continuity.
///
/// A machine upgrading from the MAUI client will be asked to sign in once. The
/// two clients use different Windows stores: MAUI's SecureStorage goes to
/// PasswordVault, and `keyring` goes to the classic Credential Manager, which
/// is why the MAUI session does not appear here. Checked rather than assumed —
/// `cmdkey /list` on a machine signed into MAUI shows nothing until this client
/// writes its own.
///
/// The cost is one sign-in. The device is already bound, so there is no
/// re-binding prompt and nothing an administrator has to undo.
const SERVICE: &str = "com.numberoneschools.desktop";
const ACCESS_KEY: &str = "student_access_token";
const REFRESH_KEY: &str = "student_refresh_token";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TokenPair {
    pub access: Option<String>,
    pub refresh: Option<String>,
}

/// The in-process copy. `None` means "not read yet", which is different from
/// having read and found nothing.
static CACHE: Mutex<Option<TokenPair>> = Mutex::new(None);

fn entry(key: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, key).map_err(|e| format!("credential store unavailable: {e}"))
}

fn read_one(key: &str) -> Result<Option<String>, String> {
    match entry(key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        // Nothing stored is an ordinary state — a first launch, or after a
        // sign-out — not a failure.
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("could not read '{key}': {e}")),
    }
}

#[tauri::command]
pub fn tokens_get() -> Result<TokenPair, String> {
    let mut cache = CACHE.lock().map_err(|_| "token cache poisoned".to_owned())?;

    if let Some(pair) = cache.as_ref() {
        return Ok(pair.clone());
    }

    let pair = TokenPair {
        access: read_one(ACCESS_KEY)?,
        refresh: read_one(REFRESH_KEY)?,
    };

    *cache = Some(pair.clone());
    Ok(pair)
}

#[tauri::command]
pub fn tokens_save(access: String, refresh: String) -> Result<(), String> {
    entry(ACCESS_KEY)?
        .set_password(&access)
        .map_err(|e| format!("could not save the access token: {e}"))?;

    entry(REFRESH_KEY)?
        .set_password(&refresh)
        .map_err(|e| format!("could not save the refresh token: {e}"))?;

    let mut cache = CACHE.lock().map_err(|_| "token cache poisoned".to_owned())?;
    *cache = Some(TokenPair {
        access: Some(access),
        refresh: Some(refresh),
    });

    Ok(())
}

/// Clearing must succeed even when the store is unhappy.
///
/// This runs on sign-out and whenever a refresh is refused, and leaving a dead
/// pair behind on a shared machine is the one outcome sign-out exists to
/// prevent. So the in-process copy is dropped first and unconditionally, and a
/// store that refuses to delete is reported afterwards rather than allowed to
/// skip that step.
#[tauri::command]
pub fn tokens_clear() -> Result<(), String> {
    if let Ok(mut cache) = CACHE.lock() {
        *cache = Some(TokenPair::default());
    }

    let mut failures = Vec::new();

    for key in [ACCESS_KEY, REFRESH_KEY] {
        match entry(key).and_then(|e| match e.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("could not delete '{key}': {e}")),
        }) {
            Ok(()) => {}
            Err(message) => failures.push(message),
        }
    }

    if failures.is_empty() {
        Ok(())
    } else {
        Err(failures.join("; "))
    }
}
