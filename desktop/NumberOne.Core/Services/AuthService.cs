using System.Net;
using System.Net.Http.Json;
using NumberOne.Core.Abstractions;
using NumberOne.Core.Api;
using NumberOne.Core.Models;

namespace NumberOne.Core.Services;

/// <summary>
/// Sign-in, device binding and session restore.
///
/// The binding flow is two-phase, and the reason is worth stating: the server
/// binds inside LoginSerializer.validate(), so a login that carries a device_id
/// binds atomically with no chance to ask first. Binding is a one-way door for
/// the student - only an administrator can undo it - and the design requires a
/// confirmation before it happens.
///
/// device_id is optional on the server, and binding is skipped when it is
/// absent. So the first call omits it and reads StudentProfile.device_id off
/// the response:
///
///   null            -> never bound. Hold the session, show the modal, and on
///                      confirmation log in again *with* the id.
///   ours            -> already bound to this machine. Proceed, no modal.
///   something else  -> bound elsewhere. Show blockedDevice - and, unlike the
///                      failed-login path, we learn which device and when.
///
/// The shared-PC case (this machine already belongs to another student) cannot
/// be detected in advance and surfaces as a 400 on the confirming call.
///
/// Cost is one extra round-trip, on first bind only. The probe issues a token
/// pair that is then discarded; SimpleJWT blacklists refresh tokens on rotation,
/// not on issue, so the unused pair simply expires.
/// </summary>
public sealed class AuthService
{
    private readonly HttpClient _http;
    private readonly ITokenStore _tokens;
    private readonly IDeviceIdentityProvider _device;

    public AuthService(HttpClient http, ITokenStore tokens, IDeviceIdentityProvider device)
    {
        _http = http;
        _tokens = tokens;
        _device = device;
    }

    /// <summary>The signed-in student, once a session exists.</summary>
    public User? CurrentUser { get; private set; }

    /// <summary>
    /// Phase one. Verifies the credentials without binding anything.
    /// </summary>
    public async Task<LoginOutcome> SignInAsync(string username, string password, CancellationToken ct = default)
    {
        TokenPair? probe;
        try
        {
            probe = await PostLoginAsync(
                new LoginRequest { Username = username, Password = password }, ct)
                .ConfigureAwait(false);
        }
        catch (LoginRefusedException ex)
        {
            return new LoginOutcome.Failed(ex.Reason, ex.Message);
        }

        if (probe?.User is null)
            return new LoginOutcome.Failed(LoginFailureReason.Unknown, DesktopMessages.UnexpectedResponse);

        var user = probe.User;

        // This client is the student client. Staff have the web dashboard.
        if (!user.IsStudent)
            return new LoginOutcome.Failed(LoginFailureReason.Unknown, DesktopMessages.StudentsOnly);

        var profile = user.StudentProfile;
        var deviceId = _device.GetDeviceId();

        // Already bound to this machine - the ordinary case after first launch.
        if (profile is not null && string.Equals(profile.DeviceId, deviceId, StringComparison.Ordinal))
        {
            await CommitAsync(probe).ConfigureAwait(false);
            return new LoginOutcome.Success(user);
        }

        // Bound to a different machine.
        if (profile is not null && profile.IsDeviceBound)
        {
            return new LoginOutcome.Failed(
                LoginFailureReason.AccountBoundElsewhere,
                ServerMessages.AccountBoundElsewhere,
                new BoundDeviceInfo(profile.DeviceId, profile.DeviceType, profile.DeviceBoundAt));
        }

        // Never bound. Nothing is persisted until the student confirms.
        return new LoginOutcome.NeedsDeviceBinding(new PendingBind
        {
            Username = username,
            Password = password,
            DeviceId = deviceId,
            DeviceType = _device.GetDeviceType(),
            MachineName = _device.GetMachineName(),
            User = user,
        });
    }

    /// <summary>
    /// Phase two. Logs in again carrying the device id, which is what actually
    /// binds. Call only after the student confirmed the modal.
    /// </summary>
    public async Task<LoginOutcome> ConfirmBindAsync(PendingBind pending, CancellationToken ct = default)
    {
        TokenPair? bound;
        try
        {
            bound = await PostLoginAsync(new LoginRequest
            {
                Username = pending.Username,
                Password = pending.Password,
                DeviceId = pending.DeviceId,
                DeviceType = pending.DeviceType,
            }, ct).ConfigureAwait(false);
        }
        catch (LoginRefusedException ex)
        {
            // The expected refusal here is DeviceBoundToAnotherStudent: between
            // the probe and now we asked the server to bind, and it found this
            // machine already held by someone else. Common on a family or lab PC.
            return new LoginOutcome.Failed(ex.Reason, ex.Message);
        }

        if (bound?.User is null)
            return new LoginOutcome.Failed(LoginFailureReason.Unknown, DesktopMessages.UnexpectedResponse);

        await CommitAsync(bound).ConfigureAwait(false);
        return new LoginOutcome.Success(bound.User);
    }

    /// <summary>
    /// Restores a session at launch from stored tokens, so a student who never
    /// signed out lands in the app rather than at a login form.
    ///
    /// A 401 here is already handled by AuthenticatingHandler, which will have
    /// tried a refresh before this sees the failure — so a rejection at this
    /// point means the refresh token is dead too, not merely that the access
    /// token expired overnight.
    ///
    /// The four outcomes are deliberately distinct. Collapsing "offline" into
    /// "rejected" is the trap: it sends a student with perfectly good tokens to
    /// a login form that cannot reach the server either, which is a dead end
    /// they can only escape by finding a network.
    /// </summary>
    public async Task<SessionRestore> RestoreSessionAsync(CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(await _tokens.GetAccessTokenAsync().ConfigureAwait(false)))
            return SessionRestore.None;

        try
        {
            using var response = await _http.GetAsync(ApiEndpoints.Me, ct).ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
                return await RejectAsync().ConfigureAwait(false);

            var user = await response.Content
                .ReadFromJsonAsync<User>(ApiClientFactory.Json, ct)
                .ConfigureAwait(false);

            if (user is null || !user.IsStudent)
                return await RejectAsync().ConfigureAwait(false);

            // The binding is checked on every launch, not only at sign-in.
            //
            // An administrator can unbind an account, and it can then be bound
            // to another machine. The tokens on THIS machine stay valid through
            // all of that, so without this check a student who had been moved
            // to a new computer would keep a working session on the old one —
            // which is the whole thing the one-device rule exists to prevent.
            var bound = user.StudentProfile?.DeviceId;
            var here = SafeDeviceId();

            // Only compared when BOTH are known. A machine whose hardware id
            // cannot be read must not be locked out of its own session over a
            // comparison that could not be made — the sign-in path already
            // refuses to bind without an id, so nothing is weakened by being
            // permissive here.
            if (!string.IsNullOrWhiteSpace(bound) &&
                !string.IsNullOrWhiteSpace(here) &&
                !string.Equals(bound, here, StringComparison.Ordinal))
            {
                return await RejectAsync().ConfigureAwait(false);
            }

            CurrentUser = user;
            return SessionRestore.Restored;
        }
        catch (Exception ex) when (ApiAttempt.IsTransport(ex))
        {
            // Offline at launch. The tokens are probably fine, so they stay:
            // the caller opens the app and every section shows its own retry.
            // If they turn out to be dead, the first request that gets through
            // raises SessionExpired and the student is sent to login then.
            return SessionRestore.Unverified;
        }
    }

    /// <summary>
    /// The tokens are no good. Clearing them is the point — leaving a dead pair
    /// on a shared machine is exactly what sign-out exists to avoid.
    /// </summary>
    private async Task<SessionRestore> RejectAsync()
    {
        CurrentUser = null;
        await _tokens.ClearAsync().ConfigureAwait(false);

        return SessionRestore.Rejected;
    }

    /// <summary>
    /// The hardware id, or null. A provider that cannot read the machine throws;
    /// that must not stop a launch, and a null simply skips the binding check
    /// rather than locking the student out of their own app.
    /// </summary>
    private string? SafeDeviceId()
    {
        try { return _device.GetDeviceId(); }
        catch (Exception) { return null; }
    }

    /// <summary>
    /// Signs out. Blacklists the refresh token server-side when reachable, and
    /// clears local storage either way - a failed logout call must never leave
    /// tokens on the machine.
    /// </summary>
    public async Task SignOutAsync(CancellationToken ct = default)
    {
        var refresh = await _tokens.GetRefreshTokenAsync().ConfigureAwait(false);

        if (!string.IsNullOrWhiteSpace(refresh))
        {
            try
            {
                using var _ = await _http.PostAsJsonAsync(
                    ApiEndpoints.Logout, new RefreshRequest { Refresh = refresh }, ApiClientFactory.Json, ct)
                    .ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                // Offline. Clearing locally is the part that matters.
            }
        }

        CurrentUser = null;
        await _tokens.ClearAsync().ConfigureAwait(false);
    }

    private async Task<TokenPair?> PostLoginAsync(LoginRequest request, CancellationToken ct)
    {
        HttpResponseMessage response;
        try
        {
            response = await _http.PostAsJsonAsync(ApiEndpoints.Login, request, ApiClientFactory.Json, ct)
                .ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            throw new LoginRefusedException(LoginFailureReason.Network, DesktopMessages.NoConnection);
        }

        using (response)
        {
            if (response.IsSuccessStatusCode)
                return await response.Content
                    .ReadFromJsonAsync<TokenPair>(ApiClientFactory.Json, ct)
                    .ConfigureAwait(false);

            var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            var message = DrfError.ExtractMessage(body);

            // 400 is the only refusal LoginSerializer produces; anything else is
            // a server or proxy fault and should not be dressed up as a
            // credential problem.
            if (response.StatusCode != HttpStatusCode.BadRequest)
                throw new LoginRefusedException(
                    LoginFailureReason.Unknown,
                    message ?? DesktopMessages.ServerFault);

            var reason = LoginFailureClassifier.Classify(message);
            throw new LoginRefusedException(reason, message ?? DesktopMessages.UnexpectedResponse);
        }
    }

    private async Task CommitAsync(TokenPair pair)
    {
        await _tokens.SaveAsync(pair.Access, pair.Refresh).ConfigureAwait(false);
        CurrentUser = pair.User;
    }

    private sealed class LoginRefusedException : Exception
    {
        public LoginFailureReason Reason { get; }

        public LoginRefusedException(LoginFailureReason reason, string message) : base(message)
            => Reason = reason;
    }
}

/// <summary>
/// Strings the client owns, for conditions the server has no message for.
/// Everything the server does have a message for is shown verbatim.
/// </summary>
public static class DesktopMessages
{
    public const string NoConnection =
        "لا يوجد اتصال بالإنترنت. تحقّق من الشبكة ثم أعد المحاولة.";

    public const string ServerFault =
        "تعذّر الاتصال بالخادم. يرجى المحاولة لاحقاً.";

    public const string UnexpectedResponse =
        "استجابة غير متوقعة من الخادم. يرجى المحاولة لاحقاً.";

    /// <summary>
    /// A section failed for a reason that is not the network.
    ///
    /// Worded so it can never be mistaken for being offline: a student who
    /// retries a connection problem is doing the right thing, and a student who
    /// retries a defect is not.
    /// </summary>
    public const string SectionFailed =
        "تعذّر عرض هذا القسم. إن تكرر الأمر فأبلغ إدارة المدرسة.";

    public const string StudentsOnly =
        "هذا التطبيق مخصص للطلاب فقط. يرجى استخدام لوحة التحكم عبر المتصفح.";

    public const string DeviceIdUnavailable =
        "تعذّر تحديد معرّف هذا الجهاز. يرجى التواصل مع الإدارة.";
}
