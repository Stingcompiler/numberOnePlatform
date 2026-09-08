using System.Text.Json.Serialization;

namespace NumberOne.Core.Models;

/// <summary>
/// The `user` object returned by /auth/login/, /auth/refresh/ and /auth/me/.
/// Mirrors accounts/serializers.py UserDetailSerializer.
/// </summary>
public sealed class User
{
    /// <summary>
    /// A UUID string, not a number: CustomUser.id is a UUIDField
    /// (accounts/models.py). StudentProfile.id is a plain integer - the two are
    /// not interchangeable, and any endpoint taking a student id wants the
    /// profile one.
    /// </summary>
    [JsonPropertyName("id")]        public string Id { get; init; } = "";
    [JsonPropertyName("username")]  public string Username { get; init; } = "";
    [JsonPropertyName("phone")]     public string? Phone { get; init; }
    [JsonPropertyName("full_name")] public string? FullName { get; init; }
    [JsonPropertyName("email")]     public string? Email { get; init; }
    [JsonPropertyName("avatar")]    public string? Avatar { get; init; }
    [JsonPropertyName("role")]      public string Role { get; init; } = "";
    [JsonPropertyName("role_display")] public string? RoleDisplay { get; init; }
    [JsonPropertyName("is_active")] public bool IsActive { get; init; }
    [JsonPropertyName("date_joined")] public DateTimeOffset? DateJoined { get; init; }

    [JsonPropertyName("student_profile")]
    public StudentProfile? StudentProfile { get; init; }

    [JsonIgnore]
    public bool IsStudent => string.Equals(Role, "student", StringComparison.OrdinalIgnoreCase);

    /// <summary>Name and phone as the lesson watermark needs them.</summary>
    [JsonIgnore]
    public string WatermarkName => string.IsNullOrWhiteSpace(FullName) ? Username : FullName!;
}

/// <summary>
/// Mirrors accounts/serializers.py StudentProfileMiniSerializer — the nested
/// profile that rides along with every auth response.
/// </summary>
public sealed class StudentProfile
{
    [JsonPropertyName("id")] public int Id { get; init; }

    [JsonPropertyName("guardian_name")]  public string? GuardianName { get; init; }
    [JsonPropertyName("guardian_phone")] public string? GuardianPhone { get; init; }
    [JsonPropertyName("address")]        public string? Address { get; init; }

    /// <summary>Raw value: "online" or "flash". Map through <see cref="SystemTypes"/>.</summary>
    [JsonPropertyName("system_type")] public string? SystemType { get; init; }

    /// <summary>
    /// The server's own label ("أونلاين" / "فلاش"). Present so the DTO matches
    /// the payload, and deliberately never displayed — see <see cref="SystemTypes"/>.
    /// </summary>
    [JsonPropertyName("system_type_display")] public string? SystemTypeDisplayFromServer { get; init; }

    [JsonPropertyName("device_id")]       public string? DeviceId { get; init; }
    [JsonPropertyName("device_type")]     public string? DeviceType { get; init; }
    [JsonPropertyName("device_bound_at")] public DateTimeOffset? DeviceBoundAt { get; init; }

    [JsonPropertyName("registered_at")] public DateTimeOffset? RegisteredAt { get; init; }
    [JsonPropertyName("notes")]         public string? Notes { get; init; }

    /// <summary>
    /// Remaining balance, as a decimal string. This is the only piece of the
    /// student's financial file the client can read: finance's own
    /// StudentFinancialFileView is IsAdminOrManager, so the payments table the
    /// design shows on `profile` has no student-reachable endpoint.
    /// </summary>
    [JsonPropertyName("balance")] public string? Balance { get; init; }

    [JsonPropertyName("enrolled_grade")]      public int? EnrolledGrade { get; init; }
    [JsonPropertyName("enrolled_grade_name")] public string? EnrolledGradeName { get; init; }
    [JsonPropertyName("enrolled_level_name")] public string? EnrolledLevelName { get; init; }

    [JsonPropertyName("supervisor")]      public int? Supervisor { get; init; }
    [JsonPropertyName("supervisor_name")] public string? SupervisorName { get; init; }

    [JsonIgnore] public bool IsDeviceBound => !string.IsNullOrWhiteSpace(DeviceId);
}

/// <summary>
/// Enrollment-type wording, mapped from the raw value on the client.
///
/// The API also sends system_type_display, whose value is "أونلاين"/"فلاش".
/// Binding to it is what produces the wrong wording: the React Native app maps
/// from the raw value, so a student using both clients would otherwise see two
/// different words for one enrollment type.
/// </summary>
public static class SystemTypes
{
    public const string Online = "online";
    public const string Flash  = "flash";

    public static string Display(string? systemType) => systemType switch
    {
        Online => "عبر الإنترنت",
        Flash  => "بدون إنترنت (فلاش)",
        _      => "—",
    };

    /// <summary>Where المشرفة has no value the profile shows this, not a dash.</summary>
    public const string NoSupervisor = "توزيع إداري تلقائي";
}
