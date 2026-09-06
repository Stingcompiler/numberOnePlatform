import { invoke } from "@tauri-apps/api/core";

/**
 * The development self-report.
 *
 * The window is excluded from screen capture and WebView2 does not expose its
 * DOM to UI Automation, so no screen in this app can be looked at from outside
 * it. It can report itself from inside, which is the difference between "the
 * dashboard renders" as a claim and as a measurement.
 *
 * Every command behind this is `#![cfg(debug_assertions)]` on the Rust side, so
 * a release build has nothing to call and each of these quietly does nothing.
 */

export interface HarnessCredentials {
  username: string;
  password: string;
  /** NUMBERONE_HARNESS_ROUTE — a route id, or "course:4" for a detail. */
  route: string | null;
}

export async function harnessCredentials(): Promise<HarnessCredentials | null> {
  return invoke<HarnessCredentials | null>("harness_credentials").catch(() => null);
}

export async function harnessLog(line: string): Promise<void> {
  await invoke("harness_log", { line }).catch(() => undefined);
}

/**
 * Writes out what the WebView actually drew, once the sections have landed.
 *
 * Called from wherever a session becomes usable — after a sign-in AND after a
 * restore. A restored session skips the sign-in screen entirely, and reporting
 * only from there meant the second run of any verification silently measured
 * nothing at all.
 */
export function reportRendered(delayMs = 4000): void {
  window.setTimeout(() => {
    void harnessLog("--- rendered ---\n" + document.body.innerText.trim());
  }, delayMs);
}
