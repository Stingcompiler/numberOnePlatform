using NumberOne.Core.Abstractions;

namespace NumberOne.Desktop.Services;

/// <summary>
/// Tokens in MAUI SecureStorage - DPAPI on Windows, Keychain on macOS.
///
/// Reads are serialised and memoised: SecureStorage hits the platform keystore
/// on every call, and the authenticating handler reads the access token on
/// every request. The cache is process-only and is invalidated by every write.
/// </summary>
public sealed class SecureTokenStore : ITokenStore
{
    private const string AccessKey = "student_access_token";
    private const string RefreshKey = "student_refresh_token";

    private readonly SemaphoreSlim _gate = new(1, 1);

    private string? _access;
    private string? _refresh;
    private bool _loaded;

    public async Task<string?> GetAccessTokenAsync()
    {
        await EnsureLoadedAsync().ConfigureAwait(false);
        return _access;
    }

    public async Task<string?> GetRefreshTokenAsync()
    {
        await EnsureLoadedAsync().ConfigureAwait(false);
        return _refresh;
    }

    public async Task SaveAsync(string accessToken, string refreshToken)
    {
        await _gate.WaitAsync().ConfigureAwait(false);
        try
        {
            await SecureStorage.Default.SetAsync(AccessKey, accessToken).ConfigureAwait(false);
            await SecureStorage.Default.SetAsync(RefreshKey, refreshToken).ConfigureAwait(false);

            _access = accessToken;
            _refresh = refreshToken;
            _loaded = true;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task ClearAsync()
    {
        await _gate.WaitAsync().ConfigureAwait(false);
        try
        {
            SecureStorage.Default.Remove(AccessKey);
            SecureStorage.Default.Remove(RefreshKey);

            _access = null;
            _refresh = null;
            _loaded = true;
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task EnsureLoadedAsync()
    {
        if (_loaded) return;

        await _gate.WaitAsync().ConfigureAwait(false);
        try
        {
            if (_loaded) return;

            try
            {
                _access = await SecureStorage.Default.GetAsync(AccessKey).ConfigureAwait(false);
                _refresh = await SecureStorage.Default.GetAsync(RefreshKey).ConfigureAwait(false);
            }
            catch (Exception)
            {
                // A keystore entry written by a different install can fail to
                // decrypt. Treat it as no session rather than crashing at launch;
                // the student signs in again and the entries are overwritten.
                _access = null;
                _refresh = null;
            }

            _loaded = true;
        }
        finally
        {
            _gate.Release();
        }
    }
}
