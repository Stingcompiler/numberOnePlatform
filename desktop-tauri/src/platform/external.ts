import { invoke } from "@tauri-apps/api/core";

/**
 * Opening a link in the student's own browser, and copying text.
 *
 * Both are things the WebView either cannot do or does differently from what
 * the app needs, so both go through one small module rather than being reached
 * for inline on four screens.
 */

/**
 * Opens an http/https URL outside the app.
 *
 * Returns the message to show the student, or null when it opened. THE SCHEME
 * CHECK IS IN RUST, not here: the URL comes from the API, so the guard belongs
 * on the far side of the boundary the untrusted value crosses, not on this one.
 *
 * `<a target="_blank">` does not work — the runtime intercepts it — and
 * navigating the window would replace the app with a meeting.
 */
export async function openExternal(url: string | null | undefined): Promise<string | null> {
  if (!url?.trim()) return "رابط الجلسة غير صالح — راجع الإدارة";

  try {
    return await invoke<string | null>("open_external", { url: url.trim() });
  } catch {
    return "تعذّر فتح المتصفح على هذا الجهاز";
  }
}

/**
 * Copies text to the clipboard.
 *
 * The identifier has to be copyable: nobody dictates a sixteen-character hex
 * string accurately over a phone, and the blocked screens are exactly where a
 * student needs it and cannot reach the rest of the app.
 *
 * execCommand is kept as the fallback. It is deprecated and it is also the only
 * thing that works when the async API is unavailable, which on a locked-down
 * school machine is not hypothetical.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return legacyCopy(text);
  }
}

function legacyCopy(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";

  document.body.appendChild(field);
  try {
    field.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
