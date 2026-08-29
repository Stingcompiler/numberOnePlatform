using System.Security.Cryptography;
using System.Text;

namespace NumberOne.Core.Abstractions;

/// <summary>
/// Turns a raw hardware identifier into the id sent as device_id.
///
/// Lives in Core, away from the registry and ioreg reads, so the part that
/// decides what a student is bound to for the life of their account can be
/// tested. The platform classes supply the raw value and nothing else.
/// </summary>
public static class DeviceIdFormat
{
    /// <summary>Windows prefix. StudentProfile.detect_device_type maps it to "Windows".</summary>
    public const string WindowsPrefix = "hw-win-";

    /// <summary>macOS prefix. detect_device_type maps it to "macOS".</summary>
    public const string MacPrefix = "hw-mac-";

    /// <summary>
    /// Namespacing salt. Keeps the published identifier from being a plain hash
    /// of a value other software also knows, and scopes it to this app.
    ///
    /// Changing it re-binds every installed client, and only an administrator
    /// can unbind. It is fixed forever.
    /// </summary>
    private const string Namespace = "numberone-schools-desktop";

    /// <summary>
    /// 16 hex characters - 64 bits of the digest.
    ///
    /// The design mock shows an 8-character example. Eight would be 32 bits,
    /// where a few thousand school machines collide with roughly 1-in-300 odds,
    /// and a collision presents to the student as "this device belongs to
    /// another student" permanently, with no administrative fix. Sixteen makes
    /// that vanish, and the copy-to-clipboard control the design mandates means
    /// nobody has to read the string aloud anyway.
    /// </summary>
    public const int HexLength = 16;

    /// <summary>
    /// Derives the id. Casing and GUID braces are normalised away first, so a
    /// platform that reports "{4F2A...}" one day and "4f2a..." the next still
    /// produces one identifier for one machine.
    /// </summary>
    public static string Derive(string prefix, string rawMachineId)
    {
        if (string.IsNullOrWhiteSpace(rawMachineId))
            throw new ArgumentException("Raw machine identifier was empty.", nameof(rawMachineId));

        var normalised = rawMachineId.Trim().Trim('{', '}').ToLowerInvariant();
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes($"{Namespace}:{normalised}"));

        return prefix + Convert.ToHexString(digest)[..HexLength].ToLowerInvariant();
    }
}
