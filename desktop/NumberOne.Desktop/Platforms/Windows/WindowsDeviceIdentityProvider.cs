using Microsoft.Win32;
using NumberOne.Core.Abstractions;

namespace NumberOne.Desktop.Platforms.Windows;

/// <summary>
/// Derives the device id from the machine, on every launch.
///
/// Source is MachineGuid, written by Windows at install time and stable across
/// hardware changes, upgrades and app reinstalls. Combining motherboard, disk
/// and CPU serials would be stricter and wrong for this product: every RAM
/// upgrade or disk swap would read as a new device, lock the student out, and
/// cost the school a phone call.
/// </summary>
public sealed class WindowsDeviceIdentityProvider : IDeviceIdentityProvider
{
    private const string KeyPath = @"SOFTWARE\Microsoft\Cryptography";
    private const string ValueName = "MachineGuid";

    private string? _cached;

    public string GetDeviceId()
    {
        // Cached for the process lifetime only - never written to disk. Reading
        // the registry per call is cheap, but the value must not vary within a
        // session either.
        return _cached ??= Derive();
    }

    public string GetDeviceType() => "Windows";

    public string GetMachineName() => Environment.MachineName;

    private static string Derive()
    {
        var machineGuid = ReadMachineGuid();

        if (string.IsNullOrWhiteSpace(machineGuid))
        {
            // Fail loudly rather than inventing a value. A random fallback would
            // bind the account to something that does not survive the next
            // launch, which is precisely the lockout this design avoids.
            throw new DeviceIdentityUnavailableException(
                $@"MachineGuid not found at HKLM\{KeyPath}\{ValueName}.");
        }

        return DeviceIdFormat.Derive(DeviceIdFormat.WindowsPrefix, machineGuid);
    }

    private static string? ReadMachineGuid()
    {
        try
        {
            // Registry64 explicitly. A 32-bit process reading HKLM\SOFTWARE is
            // redirected to Wow6432Node, which holds a *different* MachineGuid -
            // so a bitness change between builds would silently re-bind every
            // student. Pinning the view makes the id independent of it.
            using var hklm = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64);
            using var key = hklm.OpenSubKey(KeyPath);

            return key?.GetValue(ValueName) as string;
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or System.Security.SecurityException or IOException)
        {
            throw new DeviceIdentityUnavailableException(
                "Could not read MachineGuid from the registry.", ex);
        }
    }
}
