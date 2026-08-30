using System.Runtime.InteropServices;
using NumberOne.Core.Abstractions;

namespace NumberOne.Desktop.Platforms.Windows;

/// <summary>
/// Excludes a window from screen capture via SetWindowDisplayAffinity.
///
/// WDA_EXCLUDEFROMCAPTURE (Windows 10 2004 / build 19041 and later) makes the
/// window render as solid black to OBS, the Snipping Tool, Teams and Zoom
/// screen sharing, while staying normal on the physical display.
///
/// Two limits worth stating plainly: it is per HWND, so every popup or detached
/// player window needs its own call; and a VM host recording the guest defeats
/// it completely. The watermark is what survives both.
/// </summary>
public sealed class WindowsWindowProtection : IWindowProtection
{
    private const uint WDA_NONE = 0x00000000;
    private const uint WDA_EXCLUDEFROMCAPTURE = 0x00000011;

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetWindowDisplayAffinity(IntPtr hWnd, uint dwAffinity);

    public bool IsSupported => OperatingSystem.IsWindowsVersionAtLeast(10, 0, 19041);

    public bool Protect(object platformWindow)
    {
        if (!IsSupported)
            return false;

        var handle = ResolveHandle(platformWindow);
        if (handle == IntPtr.Zero)
            return false;

        return SetWindowDisplayAffinity(handle, WDA_EXCLUDEFROMCAPTURE);
    }

    /// <summary>Lifts the exclusion. Present for completeness; unused in normal flow.</summary>
    public bool Unprotect(object platformWindow)
    {
        var handle = ResolveHandle(platformWindow);
        return handle != IntPtr.Zero && SetWindowDisplayAffinity(handle, WDA_NONE);
    }

    private static IntPtr ResolveHandle(object platformWindow) => platformWindow switch
    {
        IntPtr handle => handle,
        Microsoft.UI.Xaml.Window window => WinRT.Interop.WindowNative.GetWindowHandle(window),
        _ => IntPtr.Zero,
    };
}
