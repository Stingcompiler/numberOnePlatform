using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using NumberOne.Core.Models;

namespace NumberOne.Core.Api;

/// <inheritdoc cref="ITokenRefresher"/>
public sealed class RefreshEndpoint : ITokenRefresher, IDisposable
{
    private readonly HttpClient _http;
    private readonly bool _ownsClient;

    public RefreshEndpoint(Uri baseAddress, TimeSpan? timeout = null)
    {
        // Its own bare pipeline: no authenticating handler, and no cookie jar
        // for the same reason ApiClientFactory gives.
        _http = new HttpClient(new HttpClientHandler { UseCookies = false })
        {
            BaseAddress = baseAddress,
            Timeout = timeout ?? TimeSpan.FromSeconds(15),
        };
        _ownsClient = true;
    }

    /// <summary>For tests: supply a client over a stubbed handler.</summary>
    public RefreshEndpoint(HttpClient http)
    {
        _http = http;
        _ownsClient = false;
    }

    public async Task<TokenPair?> RefreshAsync(string refreshToken, CancellationToken ct)
    {
        // Serialised to a string rather than posted as JsonContent so the
        // request carries a Content-Length. JsonContent has no known length and
        // would be sent chunked, which Django's development server cannot parse.
        var body = JsonSerializer.Serialize(
            new RefreshRequest { Refresh = refreshToken }, ApiClientFactory.Json);

        using var content = new StringContent(body, Encoding.UTF8, "application/json");

        using var response = await _http
            .PostAsync(ApiEndpoints.Refresh, content, ct)
            .ConfigureAwait(false);

        // The view answers 401 for a missing, expired or blacklisted token.
        // Refresh tokens rotate and blacklist after rotation, so a token that
        // was already spent lands here too.
        if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.BadRequest)
            return null;

        if (!response.IsSuccessStatusCode)
            return null;

        try
        {
            var pair = await response.Content
                .ReadFromJsonAsync<TokenPair>(cancellationToken: ct)
                .ConfigureAwait(false);

            return string.IsNullOrWhiteSpace(pair?.Access) ? null : pair;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public void Dispose()
    {
        if (_ownsClient) _http.Dispose();
    }
}
