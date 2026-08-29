namespace NumberOne.Core.Api;

/// <summary>
/// Why a login was refused. The server distinguishes these cases only by the
/// Arabic message text, so <see cref="LoginFailureClassifier"/> maps them here
/// once and the rest of the app switches on the enum.
/// </summary>
public enum LoginFailureReason
{
    /// <summary>Wrong username or password.</summary>
    BadCredentials,

    /// <summary>The account itself is suspended (CustomUser.is_active = False).</summary>
    AccountSuspended,

    /// <summary>
    /// This student's account is already bound to a different device.
    /// Shows the `blockedDevice` screen.
    /// </summary>
    AccountBoundElsewhere,

    /// <summary>
    /// This computer is already bound to a different student — the shared
    /// family or lab PC case. Shows the `blockedAccount` screen.
    /// </summary>
    DeviceBoundToAnotherStudent,

    /// <summary>A 4xx we do not recognise. Surface the server's text verbatim.</summary>
    Unknown,

    /// <summary>The request never reached the server, or timed out.</summary>
    Network,
}

/// <summary>
/// The exact literals the server sends. They live in accounts/models.py
/// (bind_device) and accounts/serializers.py (LoginSerializer.validate).
///
/// Matching on message text is brittle, and it is the only option available:
/// LoginSerializer raises ValidationError(..., code="device_mismatch"), but
/// DRF's default renderer discards the code, so nothing machine-readable
/// reaches the wire. Pinned here with tests so a server-side rewording fails
/// loudly in one place instead of silently degrading two screens to a generic
/// error.
/// </summary>
public static class ServerMessages
{
    /// <summary>accounts/models.py — bind_device, account already on another device.</summary>
    public const string AccountBoundElsewhere =
        "هذا الحساب مرتبط بجهاز آخر. يرجى التواصل مع الإدارة لفك الارتباط.";

    /// <summary>accounts/models.py — bind_device, device already held by another student.</summary>
    public const string DeviceBoundToAnotherStudent =
        "هذا الجهاز مرتبط بحساب طالب آخر. يرجى التواصل مع الإدارة.";

    /// <summary>accounts/serializers.py — LoginSerializer, authenticate() returned None.</summary>
    public const string BadCredentials =
        "اسم المستخدم أو كلمة المرور غير صحيحة.";

    /// <summary>accounts/serializers.py — LoginSerializer, user.is_active is False.</summary>
    public const string AccountSuspended =
        "الحساب موقوف. يرجى التواصل مع الإدارة.";

    // Discriminating fragments. Short enough to survive punctuation edits,
    // long enough that the two device messages cannot be confused: both start
    // "هذا الـ..." and only diverge at the noun.
    internal const string FragmentAccountBoundElsewhere = "مرتبط بجهاز آخر";
    internal const string FragmentDeviceBoundToOther    = "مرتبط بحساب طالب آخر";
    internal const string FragmentBadCredentials        = "اسم المستخدم أو كلمة المرور";
    internal const string FragmentAccountSuspended      = "الحساب موقوف";
}

public static class LoginFailureClassifier
{
    /// <summary>
    /// Maps a server message to a reason. Order matters: the two device
    /// fragments are checked before the generic ones because a future server
    /// message could plausibly contain both.
    /// </summary>
    public static LoginFailureReason Classify(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
            return LoginFailureReason.Unknown;

        if (message.Contains(ServerMessages.FragmentDeviceBoundToOther, StringComparison.Ordinal))
            return LoginFailureReason.DeviceBoundToAnotherStudent;

        if (message.Contains(ServerMessages.FragmentAccountBoundElsewhere, StringComparison.Ordinal))
            return LoginFailureReason.AccountBoundElsewhere;

        if (message.Contains(ServerMessages.FragmentAccountSuspended, StringComparison.Ordinal))
            return LoginFailureReason.AccountSuspended;

        if (message.Contains(ServerMessages.FragmentBadCredentials, StringComparison.Ordinal))
            return LoginFailureReason.BadCredentials;

        return LoginFailureReason.Unknown;
    }
}
