using System.Diagnostics;
using System.Text.RegularExpressions;
using NumberOne.Core.Abstractions;

namespace NumberOne.Desktop.Platforms.MacCatalyst;

/// <summary>
/// macOS counterpart of the Windows provider: IOPlatformUUID in place of
/// MachineGuid, same hashing and same never-cached rule.
///
/// UNVERIFIED ON HARDWARE. This reads IOPlatformUUID by shelling out to ioreg,
/// which is the simple approach and may be blocked by the Mac Catalyst app
/// sandbox - a sandboxed process cannot always spawn /usr/sbin/ioreg. If it is,
/// the fix is IOKit P/Invoke (IOServiceMatching / IORegistryEntryCreateCFProperty),
/// which reads the same value in-process and is sandbox-safe. Windows ships
/// first; this must be exercised on a real Mac before the macOS build goes out.
/// </summary>
public sealed partial class MacDeviceIdentityProvider : IDeviceIdentityProvider
{
    private string? _cached;

    public string GetDeviceId() => _cached ??= Derive();

    public string GetDeviceType() => "macOS";

    public string GetMachineName() => Environment.MachineName;

    private static string Derive()
    {
        var uuid = ReadPlatformUuid();

        if (string.IsNullOrWhiteSpace(uuid))
        {
            throw new DeviceIdentityUnavailableException(
                "IOPlatformUUID could not be read from the IO registry.");
        }

        return DeviceIdFormat.Derive(DeviceIdFormat.MacPrefix, uuid);
    }

    private static string? ReadPlatformUuid()
    {
        try
        {
            using var process = Process.Start(new ProcessStartInfo
            {
                FileName = "/usr/sbin/ioreg",
                ArgumentList = { "-rd1", "-c", "IOPlatformExpertDevice" },
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            });

            if (process is null)
                return null;

            var output = process.StandardOutput.ReadToEnd();
            process.WaitForExit(5000);

            var match = PlatformUuid().Match(output);
            return match.Success ? match.Groups["uuid"].Value : null;
        }
        catch (Exception ex)
        {
            throw new DeviceIdentityUnavailableException(
                "Could not invoke ioreg to read IOPlatformUUID.", ex);
        }
    }

    [GeneratedRegex("\"IOPlatformUUID\"\\s*=\\s*\"(?<uuid>[^\"]+)\"")]
    private static partial Regex PlatformUuid();
}
