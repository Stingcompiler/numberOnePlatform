using NumberOne.Core.Models;

namespace NumberOne.Core.Services;

using NumberOne.Core.Api;

/// <summary>What a sign-in attempt produced. Exactly one case is populated.</summary>
public abstract record LoginOutcome
{
    /// <summary>Signed in. Tokens are in the store and <see cref="User"/> is the session.</summary>
    public sealed record Success(User User) : LoginOutcome;

    /// <summary>
    /// The credentials are good and this account has never been bound. Nothing
    /// has been persisted yet: show the confirmation modal, then call
    /// <see cref="AuthService.ConfirmBindAsync"/> with this token, or drop it.
    /// </summary>
    public sealed record NeedsDeviceBinding(PendingBind Pending) : LoginOutcome;

    /// <summary>
    /// Refused. <see cref="Failed.Message"/> is the server text, already
    /// suitable for display; <see cref="Failed.Reason"/> selects the screen.
    ///
    /// <see cref="Failed.BoundDevice"/> is filled only for
    /// <see cref="LoginFailureReason.AccountBoundElsewhere"/> discovered on the
    /// probe call, where the profile came back and named the other device. The
    /// blockedDevice screen shows it ("Android - Galaxy A54" plus the binding
    /// date) and must fall back gracefully when it is null.
    /// </summary>
    public sealed record Failed(
        LoginFailureReason Reason,
        string Message,
        BoundDeviceInfo? BoundDevice = null) : LoginOutcome;
}

/// <summary>
/// A verified sign-in held back pending the student confirming the bind.
///
/// It carries the credentials because binding needs a second login call - the
/// server binds inside LoginSerializer.validate(), so there is no way to bind
/// an already-issued session.
/// </summary>
public sealed record PendingBind
{
    public required string Username { get; init; }
    public required string Password { get; init; }

    /// <summary>The identifier the account would be bound to.</summary>
    public required string DeviceId { get; init; }

    /// <summary>"Windows" or "macOS".</summary>
    public required string DeviceType { get; init; }

    /// <summary>Machine name for the dialog device strip, e.g. "DESKTOP-A2REKKA".</summary>
    public required string MachineName { get; init; }

    /// <summary>Who is about to be bound, from the probe response.</summary>
    public required User User { get; init; }
}

/// <summary>
/// Details of the device an account is already bound to, for the blockedDevice
/// screen. Populated only when the probe login succeeded and revealed them.
/// </summary>
public sealed record BoundDeviceInfo(string? DeviceId, string? DeviceType, DateTimeOffset? BoundAt);
