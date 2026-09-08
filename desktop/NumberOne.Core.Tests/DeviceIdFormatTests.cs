using NumberOne.Core.Abstractions;

namespace NumberOne.Core.Tests;

/// <summary>
/// The device id decides what a student is bound to for the life of their
/// account, and only an administrator can undo a wrong binding. These tests
/// guard the properties that make it safe to rely on.
/// </summary>
public class DeviceIdFormatTests
{
    private const string MachineGuid = "4f2a91c7-3d1e-4b6a-9c05-8e7d2f1a4b3c";

    [Fact]
    public void Matches_its_pinned_value()
    {
        // A golden vector, computed independently:
        //   sha256("numberone-schools-desktop:" + guid), first 16 hex chars.
        //
        // This is the test that must never be "fixed" by updating the expected
        // string. If it fails, the derivation changed, and shipping that build
        // re-binds every installed client to a new identifier that no longer
        // matches the one the server holds - locking out every student at once,
        // with only an administrator able to unbind them one by one.
        Assert.Equal(
            "hw-win-078fb0a9aa6f757c",
            DeviceIdFormat.Derive(DeviceIdFormat.WindowsPrefix, MachineGuid));
    }

    [Fact]
    public void Is_stable_across_calls()
    {
        Assert.Equal(
            DeviceIdFormat.Derive(DeviceIdFormat.WindowsPrefix, MachineGuid),
            DeviceIdFormat.Derive(DeviceIdFormat.WindowsPrefix, MachineGuid));
    }

    [Theory]
    [InlineData("4F2A91C7-3D1E-4B6A-9C05-8E7D2F1A4B3C")]
    [InlineData("{4f2a91c7-3d1e-4b6a-9c05-8e7d2f1a4b3c}")]
    [InlineData("  4f2a91c7-3d1e-4b6a-9c05-8e7d2f1a4b3c  ")]
    public void Ignores_casing_braces_and_surrounding_space(string variant)
    {
        // A platform that reports the GUID braced one day and bare the next
        // must not read as a different computer.
        Assert.Equal(
            DeviceIdFormat.Derive(DeviceIdFormat.WindowsPrefix, MachineGuid),
            DeviceIdFormat.Derive(DeviceIdFormat.WindowsPrefix, variant));
    }

    [Fact]
    public void Different_machines_get_different_ids()
    {
        Assert.NotEqual(
            DeviceIdFormat.Derive(DeviceIdFormat.WindowsPrefix, MachineGuid),
            DeviceIdFormat.Derive(DeviceIdFormat.WindowsPrefix, "00000000-0000-0000-0000-000000000001"));
    }

    [Fact]
    public void Carries_the_prefix_the_server_detects_the_platform_from()
    {
        // StudentProfile.detect_device_type reads these prefixes to fill
        // device_type when the client omits it.
        Assert.StartsWith("hw-win-", DeviceIdFormat.Derive(DeviceIdFormat.WindowsPrefix, MachineGuid));
        Assert.StartsWith("hw-mac-", DeviceIdFormat.Derive(DeviceIdFormat.MacPrefix, MachineGuid));
    }

    [Fact]
    public void The_same_machine_id_still_differs_between_platforms()
    {
        Assert.NotEqual(
            DeviceIdFormat.Derive(DeviceIdFormat.WindowsPrefix, MachineGuid),
            DeviceIdFormat.Derive(DeviceIdFormat.MacPrefix, MachineGuid));
    }

    [Fact]
    public void Fits_the_column_and_is_lowercase_hex()
    {
        var id = DeviceIdFormat.Derive(DeviceIdFormat.WindowsPrefix, MachineGuid);
        var suffix = id["hw-win-".Length..];

        Assert.Equal(DeviceIdFormat.HexLength, suffix.Length);
        Assert.Matches("^[0-9a-f]+$", suffix);

        // StudentProfile.device_id is CharField(max_length=255).
        Assert.True(id.Length <= 255);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Refuses_an_empty_machine_id_rather_than_hashing_nothing(string empty)
    {
        // Every machine with an unreadable identifier would otherwise share one
        // id, and the first student to sign in would lock out all the others.
        Assert.Throws<ArgumentException>(
            () => DeviceIdFormat.Derive(DeviceIdFormat.WindowsPrefix, empty));
    }
}
