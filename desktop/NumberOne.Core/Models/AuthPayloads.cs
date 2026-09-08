using System.Text.Json.Serialization;

namespace NumberOne.Core.Models;

/// <summary>Body of POST /auth/login/.</summary>
public sealed class LoginRequest
{
    [JsonPropertyName("username")] public required string Username { get; init; }
    [JsonPropertyName("password")] public required string Password { get; init; }

    /// <summary>
    /// Optional on the server. Omitted on the probe call so binding is skipped;
    /// sent on the confirming call so bind_device() runs.
    /// </summary>
    [JsonPropertyName("device_id")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? DeviceId { get; init; }

    [JsonPropertyName("device_type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? DeviceType { get; init; }
}

/// <summary>
/// Response of both /auth/login/ and /auth/refresh/ — the shapes are identical.
/// The server also sets HttpOnly cookies; the desktop client ignores them.
/// </summary>
public sealed class TokenPair
{
    [JsonPropertyName("detail")]  public string? Detail { get; init; }
    [JsonPropertyName("access")]  public string Access { get; init; } = "";
    [JsonPropertyName("refresh")] public string Refresh { get; init; } = "";
    [JsonPropertyName("user")]    public User? User { get; init; }
}

/// <summary>Body of POST /auth/refresh/ and POST /auth/logout/.</summary>
public sealed class RefreshRequest
{
    [JsonPropertyName("refresh")] public required string Refresh { get; init; }
}

/// <summary>
/// A DRF list endpoint under StandardPagination. Only /notifications/ uses it;
/// the student APIView endpoints return bare arrays.
/// </summary>
public sealed class Paged<T>
{
    [JsonPropertyName("count")]    public int Count { get; init; }
    [JsonPropertyName("next")]     public string? Next { get; init; }
    [JsonPropertyName("previous")] public string? Previous { get; init; }
    [JsonPropertyName("results")]  public List<T> Results { get; init; } = new();
}
