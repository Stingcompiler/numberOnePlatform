using NumberOne.Core.Services;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// Which blocked screen to show, and what it needs to say.
///
/// The two are deliberately different screens. One tells the student their own
/// account lives on another device; the other tells them this computer belongs
/// to somebody else - the shared family or lab PC, which is the common case.
/// Showing the wrong one sends them to the school with the wrong question.
/// </summary>
public sealed record BlockedState
{
    private BlockedState() { }

    public required BlockedKind Kind { get; init; }

    public required string Title { get; init; }

    public required string Body { get; init; }

    /// <summary>This computer's identifier. Always shown, always copyable.</summary>
    public required string DeviceId { get; init; }

    /// <summary>
    /// The device this account is bound to, when the probe revealed it. Null
    /// when it did not, and the detail card then shows only the identifier.
    /// </summary>
    public BoundDeviceInfo? BoundDevice { get; init; }

    public static BlockedState AccountBoundElsewhere(string deviceId, BoundDeviceInfo? boundDevice) => new()
    {
        Kind = BlockedKind.AccountBoundElsewhere,
        Title = UiText.BlockedDeviceTitle,
        Body = UiText.BlockedDeviceBody,
        DeviceId = deviceId,
        BoundDevice = boundDevice,
    };

    public static BlockedState DeviceBoundToAnotherStudent(string deviceId) => new()
    {
        Kind = BlockedKind.DeviceBoundToAnotherStudent,
        Title = UiText.BlockedAccountTitle,
        Body = UiText.BlockedAccountBody,
        DeviceId = deviceId,

        // Nothing to show here on purpose. The server refuses before revealing
        // anything about the other student, and the client must not go looking:
        // the design's mock shows their initials and name, but no student-facing
        // endpoint exposes another student's identity, and adding one to
        // decorate an error screen would leak enrolment across families.
        BoundDevice = null,
    };
}

public enum BlockedKind
{
    /// <summary>The student's own account is bound to a different device.</summary>
    AccountBoundElsewhere,

    /// <summary>This computer is bound to a different student.</summary>
    DeviceBoundToAnotherStudent,
}
