using NumberOne.Core.Abstractions;

namespace NumberOne.Desktop.Platforms.MacCatalyst;

/// <summary>
/// There is no macOS equivalent of WDA_EXCLUDEFROMCAPTURE.
///
/// NSWindow.sharingType is deprecated and not reachable from Mac Catalyst in
/// any supported way. So this reports false and does nothing, on purpose: the
/// watermark is the real protection on macOS, and the UI reads
/// <see cref="IsSupported"/> rather than assuming the layer is there.
/// </summary>
public sealed class MacWindowProtection : IWindowProtection
{
    public bool IsSupported => false;

    public bool Protect(object platformWindow) => false;
}
