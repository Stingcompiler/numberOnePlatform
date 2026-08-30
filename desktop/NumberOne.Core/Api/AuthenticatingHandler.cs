using System.Net;
using System.Net.Http.Headers;
using NumberOne.Core.Abstractions;

namespace NumberOne.Core.Api;

/// <summary>
/// Attaches the access token, and on a 401 refreshes once and replays the
/// request. Mirrors the axios interceptor in mobile/src/services/apiClient.jsx,
/// including the part that matters most: several requests failing at once share
/// a single refresh instead of each firing their own and invalidating each
/// other. Refresh tokens rotate and blacklist after rotation, so two concurrent
/// refreshes would leave one of them holding a dead token.
/// </summary>
public sealed class AuthenticatingHandler : DelegatingHandler
{
    private readonly ITokenStore _tokens;
    private readonly ITokenRefresher _refresher;

    private readonly SemaphoreSlim _gate = new(1, 1);
    private Task<RefreshOutcome>? _inFlight;

    /// <summary>
    /// Raised when the refresh token was rejected - a genuine expiry, not a
    /// network failure. Drives the session-expired dialog. Handlers run off the
    /// UI thread.
    /// </summary>
    public event EventHandler? SessionExpired;

    public AuthenticatingHandler(ITokenStore tokens, ITokenRefresher refresher)
    {
        _tokens = tokens;
        _refresher = refresher;
    }

    private enum RefreshOutcome
    {
        /// <summary>A usable access token is now in the store.</summary>
        Succeeded,

        /// <summary>The server rejected the refresh token. The session is over.</summary>
        Expired,

        /// <summary>The server could not be reached. Keep the tokens; the app is offline.</summary>
        Unreachable,
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken ct)
    {
        // Buffer the body before the first send, for two reasons.
        //
        // One, replay: an HttpRequestMessage cannot be sent twice, and the
        // retry after a refresh needs to re-read content a streaming body would
        // already have consumed.
        //
        // Two, framing: JsonContent has no known length, so HttpClient falls
        // back to Transfer-Encoding: chunked. Django's development server is
        // built on http.server and cannot parse a chunked request body - it
        // reads the chunk-size line as a request line and answers
        // "Bad request syntax". Buffering sets Content-Length and the body
        // frames normally. Production behind gunicorn accepts either; local
        // development only works this way.
        if (request.Content is not null)
            await request.Content.LoadIntoBufferAsync(ct).ConfigureAwait(false);

        // /auth/login/ and /auth/refresh/ never carry a bearer and never retry.
        if (ApiEndpoints.IsAuthExempt(request.RequestUri))
            return await base.SendAsync(request, ct).ConfigureAwait(false);

        var accessToken = await _tokens.GetAccessTokenAsync().ConfigureAwait(false);
        Authorize(request, accessToken);

        var response = await base.SendAsync(request, ct).ConfigureAwait(false);

        if (response.StatusCode != HttpStatusCode.Unauthorized)
            return response;

        var outcome = await EnsureRefreshedAsync(accessToken, ct).ConfigureAwait(false);

        if (outcome == RefreshOutcome.Expired)
        {
            await _tokens.ClearAsync().ConfigureAwait(false);
            SessionExpired?.Invoke(this, EventArgs.Empty);
            return response;
        }

        if (outcome == RefreshOutcome.Unreachable)
            return response;

        // Replay once, with the token the refresh just wrote.
        var refreshed = await _tokens.GetAccessTokenAsync().ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(refreshed))
            return response;

        var replay = await CloneAsync(request, ct).ConfigureAwait(false);
        Authorize(replay, refreshed);

        response.Dispose();
        return await base.SendAsync(replay, ct).ConfigureAwait(false);
    }

    private static void Authorize(HttpRequestMessage request, string? token)
    {
        request.Headers.Authorization = string.IsNullOrWhiteSpace(token)
            ? null
            : new AuthenticationHeaderValue("Bearer", token);
    }

    /// <summary>
    /// Refreshes at most once for any number of concurrent 401s. Callers that
    /// arrive while a refresh is running await that same task; callers whose
    /// token was already replaced by a finished refresh skip straight through.
    /// </summary>
    private async Task<RefreshOutcome> EnsureRefreshedAsync(string? staleToken, CancellationToken ct)
    {
        Task<RefreshOutcome> refresh;

        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            if (_inFlight is null)
            {
                // Another request may have refreshed between our 401 and this
                // point. If the stored token has moved on, our own attempt was
                // simply stale - replay with the new one instead of spending a
                // second refresh token.
                var current = await _tokens.GetAccessTokenAsync().ConfigureAwait(false);
                if (!string.IsNullOrWhiteSpace(current) && current != staleToken)
                    return RefreshOutcome.Succeeded;

                _inFlight = RunRefreshAsync();
            }

            refresh = _inFlight;
        }
        finally
        {
            _gate.Release();
        }

        return await refresh.ConfigureAwait(false);
    }

    private async Task<RefreshOutcome> RunRefreshAsync()
    {
        // Yield before touching anything: this task is created while the caller
        // holds _gate, and the cleanup below takes _gate again. Without the
        // yield, a synchronous path through this method would deadlock on it.
        await Task.Yield();

        try
        {
            var refreshToken = await _tokens.GetRefreshTokenAsync().ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(refreshToken))
                return RefreshOutcome.Expired;

            // Not cancelled by the caller token on purpose: this refresh is
            // shared, and the first caller walking away must not strand the rest.
            var pair = await _refresher.RefreshAsync(refreshToken, CancellationToken.None)
                .ConfigureAwait(false);

            if (pair is null)
                return RefreshOutcome.Expired;

            // ROTATE_REFRESH_TOKENS is on, so a new refresh token comes back
            // every time and the old one is blacklisted. Keep the previous one
            // only if the server somehow omitted it.
            await _tokens.SaveAsync(
                pair.Access,
                string.IsNullOrWhiteSpace(pair.Refresh) ? refreshToken : pair.Refresh)
                .ConfigureAwait(false);

            return RefreshOutcome.Succeeded;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException)
        {
            // Offline or timed out. Signing the student out here would mean a
            // dropped connection logs them off a device they cannot re-bind.
            return RefreshOutcome.Unreachable;
        }
        finally
        {
            await _gate.WaitAsync().ConfigureAwait(false);
            try { _inFlight = null; }
            finally { _gate.Release(); }
        }
    }

    private static async Task<HttpRequestMessage> CloneAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var clone = new HttpRequestMessage(request.Method, request.RequestUri)
        {
            Version = request.Version,
            VersionPolicy = request.VersionPolicy,
        };

        if (request.Content is not null)
        {
            var buffer = new MemoryStream();
            await request.Content.CopyToAsync(buffer, ct).ConfigureAwait(false);
            buffer.Position = 0;

            clone.Content = new StreamContent(buffer);
            foreach (var header in request.Content.Headers)
                clone.Content.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }

        foreach (var header in request.Headers)
            clone.Headers.TryAddWithoutValidation(header.Key, header.Value);

        foreach (var option in (IDictionary<string, object?>)request.Options)
            ((IDictionary<string, object?>)clone.Options)[option.Key] = option.Value;

        return clone;
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) _gate.Dispose();
        base.Dispose(disposing);
    }
}
