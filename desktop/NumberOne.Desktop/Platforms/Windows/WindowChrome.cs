using System.Runtime.InteropServices;

namespace NumberOne.Desktop.Platforms.Windows;

/// <summary>
/// Fixes the two things the framework gets wrong about this window's frame.
///
/// Both were diagnosed against the running app rather than reasoned about, and
/// both had already survived a fix applied through the MAUI and WinUI APIs —
/// which is why this reaches for Win32 directly. It is the layer the symptoms
/// were measured at.
/// </summary>
internal static class WindowChrome
{
    private const int GWL_EXSTYLE = -20;

    /// <summary>Windows mirrors a window's whole non-client area when this is set.</summary>
    private const int WS_EX_LAYOUTRTL = 0x00400000;

    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_NOZORDER = 0x0004;
    private const uint SWP_FRAMECHANGED = 0x0020;

    // Explicitly the W entry points. The title arriving as one question mark
    // per Arabic letter is exactly what the A entry points do to a string the
    // machine's code page cannot represent.
    [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "SetWindowTextW")]
    private static extern bool SetWindowText(IntPtr window, string text);

    // The same call with the bytes already encoded. USER32 stores this window's
    // text through the process code page, and the Unicode entry point's own
    // conversion sizes its buffer in characters — which halves a string whose
    // characters take two bytes. Handing over UTF-8 directly skips that
    // conversion; the manifest makes the process code page UTF-8, so the bytes
    // are stored exactly as given.
    [DllImport("user32.dll", EntryPoint = "SetWindowTextA")]
    private static extern bool SetWindowTextUtf8(IntPtr window, byte[] text);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    private static extern int GetWindowLong(IntPtr window, int index);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongW")]
    private static extern int SetWindowLong(IntPtr window, int index, int value);

    [DllImport("user32.dll")]
    private static extern bool SetWindowPos(
        IntPtr window, IntPtr after, int x, int y, int cx, int cy, uint flags);

    /// <summary>
    /// Un-mirrors the caption and writes the title so it survives.
    ///
    /// Safe to call more than once, and it is called more than once: on window
    /// creation and again a moment later, because the framework writes its own
    /// title during startup and writes it last.
    /// </summary>
    public static void Apply(IntPtr window, string title)
    {
        if (window == IntPtr.Zero) return;



        try
        {
            // The caption. WS_EX_LAYOUTRTL moves the close, maximise and
            // minimise buttons to the left edge and lays the title out from the
            // other side — but the title itself is drawn by the app's own
            // strip, which does not move with them. The name and the close
            // button end up on top of each other, with the window icon in the
            // middle of the text.
            //
            // Clearing the MAUI Window's FlowDirection did not clear this bit;
            // it was still set on the live window afterwards. So it is cleared
            // here, where it actually lives. Only the frame is affected: the
            // pages set RightToLeft themselves and keep it, and Arabic in a
            // left-to-right caption is still shaped and ordered by bidi.
            var style = GetWindowLong(window, GWL_EXSTYLE);

            if ((style & WS_EX_LAYOUTRTL) != 0)
            {
                SetWindowLong(window, GWL_EXSTYLE, style & ~WS_EX_LAYOUTRTL);

                // The non-client area is cached until something invalidates it.
                SetWindowPos(window, IntPtr.Zero, 0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED);
            }

            // The title, as bytes rather than as a string.
            //
            // Read back off the running window, the name arrived as twenty
            // U+003F characters — one per Arabic letter — from a constant that
            // is correct UTF-16 in the assembly. USER32 stores this window's
            // text through the process code page, which had no Arabic in it.
            //
            // The manifest now makes that code page UTF-8, which turned the
            // question marks into the right letters but cut the name in half:
            // the Unicode entry point sizes its conversion buffer in
            // characters, and every Arabic character takes two bytes. Twenty
            // characters came back as eleven, through MAUI, through WinUI's own
            // Title, and through SetWindowTextW alike.
            //
            // Encoding here and handing over the bytes skips that conversion
            // entirely. Measured on the running window: twenty characters,
            // still twenty a quarter of a minute later, and the taskbar reads
            // the whole name.
            var utf8 = new byte[System.Text.Encoding.UTF8.GetByteCount(title) + 1];
            System.Text.Encoding.UTF8.GetBytes(title, 0, title.Length, utf8, 0);

            if (!SetWindowTextUtf8(window, utf8))
                SetWindowText(window, title);
        }
        catch (Exception ex)
        {
            // Cosmetic, every one of them. A frame that still reads wrong is
            // not worth failing a launch over.
            App.RecordUnhandled("WindowChrome", ex);
        }
    }
}
