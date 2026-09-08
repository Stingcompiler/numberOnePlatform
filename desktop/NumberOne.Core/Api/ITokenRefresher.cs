using NumberOne.Core.Models;

namespace NumberOne.Core.Api;

/// <summary>
/// Calls POST /auth/refresh/ and nothing else.
///
/// It is a separate seam from the rest of the API surface so the refresh call
/// can travel over its own pipeline. If refreshing went through the
/// authenticating handler, a 401 on the refresh itself would trigger another
/// refresh, and so on.
/// </summary>
public interface ITokenRefresher
{
    /// <summary>
    /// Returns the rotated pair, or null when the server rejected the refresh
    /// token (a real session expiry). Throws <see cref="HttpRequestException"/>
    /// or <see cref="TaskCanceledException"/> when the server was unreachable —
    /// the caller must not treat that as an expiry.
    /// </summary>
    Task<TokenPair?> RefreshAsync(string refreshToken, CancellationToken ct);
}
