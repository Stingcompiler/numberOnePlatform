using System.Text.Json.Serialization;

namespace NumberOne.Core.Models;

/// <summary>
/// One notification. notifications/serializers.py NotificationSerializer.
///
/// The mobile app receives these by Expo push; there is no desktop equivalent
/// and /notifications/register-token/ stores Expo tokens only. The desktop
/// client polls the unread count instead and raises a local toast, so nothing
/// server-side changes.
/// </summary>
public sealed class Notification
{
    [JsonPropertyName("id")]      public int Id { get; init; }
    [JsonPropertyName("title")]   public string Title { get; init; } = "";
    [JsonPropertyName("message")] public string Message { get; init; } = "";

    /// <summary>See <see cref="NotificationTypes"/>.</summary>
    [JsonPropertyName("notification_type")] public string NotificationType { get; init; } = "";

    /// <summary>
    /// The id of whatever the notification points at — a lesson, an exam, a
    /// session. A string on the server (CharField), not an int.
    /// </summary>
    [JsonPropertyName("related_object_id")] public string? RelatedObjectId { get; init; }

    [JsonPropertyName("is_read")]    public bool IsRead { get; init; }
    [JsonPropertyName("created_at")] public DateTimeOffset CreatedAt { get; init; }

    /// <summary>Parsed id, or null when it is absent or not numeric.</summary>
    [JsonIgnore]
    public int? RelatedId => int.TryParse(RelatedObjectId, out var id) ? id : null;
}

public static class NotificationTypes
{
    public const string Lecture = "lecture";
    public const string Exam = "exam";
    public const string Result = "result";
    public const string LiveSession = "live_session";

    /// <summary>Legacy value kept for older rows; treat as <see cref="LiveSession"/>.</summary>
    public const string LivePodcast = "live_podcast";

    public const string Announcement = "announcement";

    public static string Display(string? type) => type switch
    {
        Lecture => "محاضرة جديدة",
        Exam => "امتحان جديد",
        Result => "نتيجة امتحان",
        LiveSession or LivePodcast => "جلسة بث مباشر",
        Announcement => "إعلان هام",
        _ => "إشعار",
    };
}

/// <summary>Response of /notifications/count/.</summary>
public sealed class UnreadCount
{
    [JsonPropertyName("count")] public int Count { get; init; }
}
