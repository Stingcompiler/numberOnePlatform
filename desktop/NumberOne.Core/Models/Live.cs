using System.Text.Json.Serialization;

namespace NumberOne.Core.Models;

/// <summary>
/// A live-session room with its sessions nested — live/serializers.py
/// LiveRoomStudentSerializer.
///
/// The server filters rooms by the student's system_type. There is no
/// client-side filter and none is designed: adding one would silently hide
/// rooms the server intended to show, and mask a server-side misconfiguration.
/// </summary>
public sealed class LiveRoom
{
    [JsonPropertyName("id")]        public int Id { get; init; }
    [JsonPropertyName("room_name")] public string RoomName { get; init; } = "";

    /// <summary>Raw "online"/"flash". Map through <see cref="SystemTypes"/>.</summary>
    [JsonPropertyName("room_type")] public string? RoomType { get; init; }

    [JsonPropertyName("description")] public string? Description { get; init; }

    [JsonPropertyName("sessions")] public List<LiveSession> Sessions { get; init; } = new();

    /// <summary>
    /// The room meta line, following Arabic number agreement rather than one
    /// plural template: 0 none, 1 singular, 2 dual, 3-10 plural, 11+ singular
    /// again after a large number.
    /// </summary>
    [JsonIgnore]
    public string SessionCountLabel => Sessions.Count switch
    {
        0 => "لا توجد جلسات",
        1 => "جلسة واحدة",
        2 => "جلستان",
        >= 3 and <= 10 => $"{Arabic(Sessions.Count)} جلسات",
        _ => $"{Arabic(Sessions.Count)} جلسة",
    };

    private static string Arabic(int value) =>
        ViewModels.UiText.ToArabicIndicDigits(value.ToString());
}

public sealed class LiveSession
{
    [JsonPropertyName("id")]           public int Id { get; init; }
    [JsonPropertyName("session_name")] public string SessionName { get; init; } = "";
    [JsonPropertyName("description")]  public string? Description { get; init; }

    /// <summary>See <see cref="LiveProviders"/>.</summary>
    [JsonPropertyName("provider")]         public string Provider { get; init; } = "";
    [JsonPropertyName("provider_display")] public string? ProviderDisplay { get; init; }

    /// <summary>Opened in the system browser, outside the app. There is no player.</summary>
    [JsonPropertyName("stream_url")] public string? StreamUrl { get; init; }

    [JsonPropertyName("scheduled_start")] public DateTimeOffset? ScheduledStart { get; init; }
    [JsonPropertyName("scheduled_end")]   public DateTimeOffset? ScheduledEnd { get; init; }

    /// <summary>See <see cref="LiveStatuses"/>.</summary>
    [JsonPropertyName("status")]         public string Status { get; init; } = "";
    [JsonPropertyName("status_display")] public string? StatusDisplay { get; init; }

    /// <summary>Ended and archived sessions render their action disabled.</summary>
    [JsonIgnore]
    public bool CanJoin =>
        !string.IsNullOrWhiteSpace(StreamUrl) &&
        Status is not (LiveStatuses.Ended or LiveStatuses.Archived);
}

public static class LiveProviders
{
    public const string Zoom = "zoom";
    public const string GoogleMeet = "google_meet";
    public const string Teams = "teams";
    public const string YouTube = "youtube";
    public const string Other = "other";
}

public static class LiveStatuses
{
    public const string Upcoming = "upcoming";
    public const string Live = "live";
    public const string Ended = "ended";
    public const string Archived = "archived";

    public static string Display(string? status) => status switch
    {
        Upcoming => "قادمة",
        Live => "مباشر الآن",
        Ended => "انتهت",
        Archived => "مؤرشفة",
        _ => "",
    };
}
