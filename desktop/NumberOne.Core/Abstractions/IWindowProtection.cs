namespace NumberOne.Core.Abstractions;

/// <summary>
/// Screen-capture exclusion, where the platform has it.
///
/// Windows 10 2004+ has SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE), which
/// blanks the window for OBS, Snipping Tool and screen sharing. It applies per
/// window, so every popup or detached player needs its own call. A VM host
/// recording the guest defeats it entirely.
///
/// macOS has no equivalent reachable from Mac Catalyst — NSWindow.sharingType is
/// deprecated — so the macOS implementation is a no-op that reports false. The
/// watermark is the real protection there, and on any Windows build older than
/// 2004.
/// </summary>
public interface IWindowProtection
{
    /// <summary>True if this platform can exclude windows from capture at all.</summary>
    bool IsSupported { get; }

    /// <summary>
    /// Applies exclusion to the given window. Returns false when the platform
    /// cannot, which is information for the UI, not an error: the app must work
    /// without it.
    /// </summary>
    bool Protect(object platformWindow);
}
