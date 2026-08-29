namespace NumberOne.Core.Abstractions;

/// <summary>
/// Supplies the hardware-derived identifier this installation binds to.
///
/// It must be derived from the machine on every launch, never cached. The
/// mobile app caches a generated id in SecureStore; on desktop that store can
/// be cleared by an uninstall, and the next launch would mint a fresh id that
/// the server reads as a second device — locking the student out for good.
/// </summary>
public interface IDeviceIdentityProvider
{
    /// <summary>
    /// The stable identifier, e.g. "hw-win-4f2a91c7d0e51b6a".
    /// Throws <see cref="DeviceIdentityUnavailableException"/> rather than
    /// inventing a value: a random fallback binds the account to something
    /// that will not exist next launch.
    /// </summary>
    string GetDeviceId();

    /// <summary>"Windows" or "macOS" — matches StudentProfile.detect_device_type.</summary>
    string GetDeviceType();

    /// <summary>Machine name for the binding dialog's device strip, e.g. "DESKTOP-A2REKKA".</summary>
    string GetMachineName();
}

public sealed class DeviceIdentityUnavailableException : Exception
{
    public DeviceIdentityUnavailableException(string message, Exception? inner = null)
        : base(message, inner) { }
}
