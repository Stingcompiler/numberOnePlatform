using System.Net.Http.Headers;
using System.Text.Json;
using NumberOne.Core.Abstractions;

namespace NumberOne.Core.Api;

/// <summary>
/// Builds the one HttpClient the app talks through, and the handler chain
/// underneath it.
/// </summary>
public static class ApiClientFactory
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
    };

    /// <summary>
    /// Composes the pipeline. The caller keeps the returned handler to
    /// subscribe to <see cref="AuthenticatingHandler.SessionExpired"/>.
    /// </summary>
    public static (HttpClient Client, AuthenticatingHandler Auth) Create(
        Uri baseAddress,
        ITokenStore tokens,
        ITokenRefresher refresher,
        TimeSpan? timeout = null)
    {
        var inner = new HttpClientHandler
        {
            // Cookies OFF, deliberately.
            //
            // Every login and refresh response also sets HttpOnly access_token
            // and refresh_token cookies for the React dashboard, and
            // CookieJWTAuthentication reads the cookie *before* falling back to
            // the Authorization header. With a cookie jar, requests would
            // authenticate on the cookie even if the bearer path were broken,
            // and the fault would surface only once the cookie expired - in
            // production, on a student machine. Off, the header is the only
            // credential, so a break in it fails immediately and visibly.
            UseCookies = false,
            AutomaticDecompression = System.Net.DecompressionMethods.All,
        };

        var auth = new AuthenticatingHandler(tokens, refresher) { InnerHandler = inner };

        var client = new HttpClient(auth)
        {
            BaseAddress = baseAddress,
            Timeout = timeout ?? TimeSpan.FromSeconds(20),
        };
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        return (client, auth);
    }
}
