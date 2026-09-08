using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using NumberOne.Core.Api;

namespace NumberOne.Core.Services;

/// <summary>
/// The school's public contact number, for the "التواصل مع الإدارة" action.
///
/// Read from /api/public/site-data/, which is AllowAny. That matters: the two
/// blocked screens and the login error are exactly where a student needs this
/// number, and in all three cases there is no session - an authenticated
/// endpoint would be useless there.
///
/// Its own HttpClient, for the same reason. Routing an anonymous call through
/// the authenticating pipeline would attach a stale bearer and could trip a
/// pointless refresh.
/// </summary>
public sealed class SiteContactService : IDisposable
{
    private readonly HttpClient _http;
    private readonly bool _ownsClient;
    private readonly SemaphoreSlim _gate = new(1, 1);

    private string? _phone;
    private bool _fetched;

    public SiteContactService(Uri baseAddress, TimeSpan? timeout = null)
    {
        _http = new HttpClient(new HttpClientHandler { UseCookies = false })
        {
            BaseAddress = baseAddress,
            Timeout = timeout ?? TimeSpan.FromSeconds(10),
        };
        _ownsClient = true;
    }

    /// <summary>For tests: supply a client over a stubbed handler.</summary>
    public SiteContactService(HttpClient http)
    {
        _http = http;
        _ownsClient = false;
    }

    /// <summary>
    /// The administration's phone number, or null when it has not been set on
    /// the server or could not be fetched. Callers must handle null by hiding
    /// the number rather than showing a placeholder - a wrong number on a
    /// blocked screen is worse than none.
    /// </summary>
    public async Task<string?> GetAdministrationPhoneAsync(CancellationToken ct = default)
    {
        if (_fetched) return _phone;

        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            if (_fetched) return _phone;

            try
            {
                var data = await _http
                    .GetFromJsonAsync<SiteData>(ApiEndpoints.PublicSiteData, ApiClientFactory.Json, ct)
                    .ConfigureAwait(false);

                var phone = data?.Settings?.PrimaryPhone;
                _phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
                _fetched = true;
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
            {
                // Offline, or the endpoint moved. Leave _fetched false so a
                // later attempt can still succeed; the screen shows the action
                // without a number in the meantime.
                _phone = null;
            }

            return _phone;
        }
        finally
        {
            _gate.Release();
        }
    }

    public void Dispose()
    {
        if (_ownsClient) _http.Dispose();
        _gate.Dispose();
    }

    private sealed class SiteData
    {
        [JsonPropertyName("settings")] public SiteSettings? Settings { get; init; }
    }

    private sealed class SiteSettings
    {
        [JsonPropertyName("institution_name")] public string? InstitutionName { get; init; }
        [JsonPropertyName("primary_phone")]    public string? PrimaryPhone { get; init; }
        [JsonPropertyName("primary_email")]    public string? PrimaryEmail { get; init; }
    }
}
