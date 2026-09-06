/**
 * The affordances a browser gives a page that an app should not have.
 *
 * MAUI switches most of these off through WebView2 settings —
 * AreDefaultContextMenusEnabled, AreDevToolsEnabled,
 * AreBrowserAcceleratorKeysEnabled, IsStatusBarEnabled. Tauri does not expose
 * those, so what can be done from the page is done here and what cannot is
 * recorded in BLOCKERS rather than assumed away.
 *
 * THIS IS THE WEAKEST LAYER and must never be relied on alone. The frame that
 * holds the lecture is sandboxed without `allow-top-navigation` and without
 * `allow-popups`, and the window's own navigation is refused by
 * player_policy.rs — those are the two that hold. This one closes the doors
 * that are merely open, not the ones that are load-bearing.
 */
export function hardenPage(): void {
  // "Save image as", "Copy link address", "Inspect" — the context menu is a
  // small set of exits on its own, and nothing in this app needs one.
  document.addEventListener("contextmenu", (e) => e.preventDefault(), true);

  // Dragging a lecture's frame or a logo out of the window and into a browser.
  document.addEventListener("dragstart", (e) => e.preventDefault(), true);

  // A middle-click is a request for a new tab.
  document.addEventListener("auxclick", (e) => e.preventDefault(), true);

  // Nothing in this app opens a window. Neutering it here means a script that
  // reaches for one gets null rather than a window the app does not control —
  // the framed lecture is already refused one by its sandbox.
  window.open = () => null;

  // F12 and Ctrl+Shift+I. Devtools are already absent from a release build, so
  // this is about the debug binary a student could be handed by mistake — and
  // it is a nuisance to a determined person, not a barrier. Said plainly
  // because pretending otherwise is how a weak layer gets trusted.
  document.addEventListener(
    "keydown",
    (e) => {
      const key = e.key.toUpperCase();
      if (key === "F12" || (e.ctrlKey && e.shiftKey && (key === "I" || key === "J" || key === "C"))) {
        e.preventDefault();
      }
      // Ctrl+P would print a lecture; Ctrl+S would save the page.
      if (e.ctrlKey && (key === "P" || key === "S")) e.preventDefault();
    },
    true,
  );
}
