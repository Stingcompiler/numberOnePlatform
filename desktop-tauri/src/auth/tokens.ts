import { invoke } from "@tauri-apps/api/core";

/**
 * The token pair, kept in the OS credential store by the Rust side.
 *
 * Never localStorage. The store is Credential Manager on Windows and the
 * Keychain on macOS — the same places MAUI's SecureStorage reaches, under the
 * same service and key names, so a machine upgraded from the MAUI client keeps
 * its session instead of being asked to sign in again.
 */

export interface TokenPair {
  access: string | null;
  refresh: string | null;
}

export const tokens = {
  async get(): Promise<TokenPair> {
    return invoke<TokenPair>("tokens_get");
  },

  async save(access: string, refresh: string): Promise<void> {
    await invoke("tokens_save", { access, refresh });
  },

  async clear(): Promise<void> {
    await invoke("tokens_clear");
  },
};
