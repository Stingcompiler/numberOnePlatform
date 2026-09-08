namespace NumberOne.Core.Services;

/// <summary>
/// What a launch found in the token store.
///
/// Four cases rather than a bool, because two of them look like failure and
/// must not be treated alike. <see cref="Rejected"/> means the session is over
/// and the student has to sign in again; <see cref="Unverified"/> means the app
/// could not ask, which is not the student's problem and must not cost them
/// their session.
/// </summary>
public enum SessionRestore
{
    /// <summary>Nothing stored. A first launch, or a real sign-out. Show login.</summary>
    None,

    /// <summary>
    /// Verified against the server: the tokens work, the account is a student's,
    /// and the binding still names this machine. Open the app.
    /// </summary>
    Restored,

    /// <summary>
    /// The server refused, the account is not a student's, or the binding has
    /// moved to another machine. The tokens have been cleared. Show login.
    /// </summary>
    Rejected,

    /// <summary>
    /// Tokens are present but the server could not be reached, so nothing could
    /// be confirmed.
    ///
    /// The app opens anyway. Sending a student to a login form that cannot
    /// reach the server either is a dead end they can only leave by finding a
    /// network; opening instead costs nothing, because every screen shows its
    /// own offline state and no lecture plays without a connection regardless.
    /// If the tokens do turn out to be dead, the first request that gets
    /// through raises SessionExpired and they go to login then.
    /// </summary>
    Unverified,
}
