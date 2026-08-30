namespace NumberOne.Core.Abstractions;

/// <summary>
/// Where the JWT pair lives. Backed by MAUI SecureStorage — DPAPI on Windows,
/// Keychain on macOS. Key names match the mobile app's for no reason other than
/// consistency; the two clients never share a store.
/// </summary>
public interface ITokenStore
{
    Task<string?> GetAccessTokenAsync();
    Task<string?> GetRefreshTokenAsync();
    Task SaveAsync(string accessToken, string refreshToken);
    Task ClearAsync();
}
