using System.Text.Json.Serialization;

namespace NumberOne.Core.Models;

/// <summary>
/// A course as the student endpoints return it — academic/serializers.py
/// StudentCourseSerializer. Units and their lessons arrive nested, so
/// my-courses/ is one call for the whole tree.
/// </summary>
public sealed class Course
{
    [JsonPropertyName("id")]   public int Id { get; init; }
    [JsonPropertyName("name")] public string Name { get; init; } = "";
    [JsonPropertyName("description")] public string? Description { get; init; }

    [JsonPropertyName("grade")]      public int? Grade { get; init; }
    [JsonPropertyName("grade_name")] public string? GradeName { get; init; }

    [JsonPropertyName("teacher")]      public int? Teacher { get; init; }
    [JsonPropertyName("teacher_name")] public string? TeacherName { get; init; }

    [JsonPropertyName("thumbnail")] public string? Thumbnail { get; init; }

    [JsonPropertyName("display_order")] public int DisplayOrder { get; init; }
    [JsonPropertyName("is_active")]     public bool IsActive { get; init; }

    /// <summary>Raw "online"/"flash". Map through <see cref="SystemTypes"/>.</summary>
    [JsonPropertyName("system_type")] public string? SystemType { get; init; }

    [JsonPropertyName("units")] public List<Unit> Units { get; init; } = new();

    /// <summary>
    /// Present only on the LIST endpoint, which uses CourseListSerializer and
    /// carries no nested units. Null on the student and detail endpoints, where
    /// the count comes from <see cref="Units"/> instead.
    /// </summary>
    [JsonPropertyName("lesson_count")] public int? LessonCountFromServer { get; init; }

    [JsonIgnore]
    public IEnumerable<Lesson> AllLessons => Units.SelectMany(u => u.Lessons);

    /// <summary>
    /// How many lessons this course has, from whichever source the payload
    /// actually carries. Counting AllLessons alone reads zero on the list
    /// endpoint, because that serializer omits units entirely.
    /// </summary>
    [JsonIgnore]
    public int LessonCount => Units.Count > 0
        ? Units.Sum(u => u.Lessons.Count)
        : LessonCountFromServer ?? 0;
}

public sealed class Unit
{
    [JsonPropertyName("id")]     public int Id { get; init; }
    [JsonPropertyName("course")] public int Course { get; init; }
    [JsonPropertyName("name")]   public string Name { get; init; } = "";
    [JsonPropertyName("display_order")] public int DisplayOrder { get; init; }
    [JsonPropertyName("is_active")]     public bool IsActive { get; init; }

    [JsonPropertyName("lessons")] public List<Lesson> Lessons { get; init; } = new();
}

/// <summary>
/// A lesson. Note what is absent: youtube_url.
///
/// The student serializers expose only youtube_embed_url, so the raw watch URL
/// never reaches this client and there is no property here to hold it. Do not
/// add one — the point is that a single API response cannot be scraped for a
/// course's video links.
/// </summary>
public sealed class Lesson
{
    [JsonPropertyName("id")]    public int Id { get; init; }
    [JsonPropertyName("unit")]  public int? Unit { get; init; }
    [JsonPropertyName("title")] public string Title { get; init; } = "";
    [JsonPropertyName("description")] public string? Description { get; init; }

    /// <summary>An https://www.youtube.com/embed/... URL for the WebView.</summary>
    [JsonPropertyName("youtube_embed_url")] public string? YoutubeEmbedUrl { get; init; }

    [JsonPropertyName("pdf_file")] public string? PdfFile { get; init; }

    [JsonPropertyName("display_order")]    public int DisplayOrder { get; init; }
    [JsonPropertyName("duration_minutes")] public int? DurationMinutes { get; init; }
    [JsonPropertyName("is_active")]        public bool IsActive { get; init; }

    /// <summary>Present on the detail endpoint only, and without is_correct.</summary>
    [JsonPropertyName("exercise")] public Exercise? Exercise { get; init; }

    [JsonIgnore] public bool HasVideo => !string.IsNullOrWhiteSpace(YoutubeEmbedUrl);
    [JsonIgnore] public bool HasAttachment => !string.IsNullOrWhiteSpace(PdfFile);
}

/// <summary>
/// A lesson exercise. The student variant omits is_correct on every choice —
/// the answers are not sent until after submission.
/// </summary>
public sealed class Exercise
{
    [JsonPropertyName("id")]    public int Id { get; init; }
    [JsonPropertyName("title")] public string Title { get; init; } = "";
    [JsonPropertyName("instructions")] public string? Instructions { get; init; }

    [JsonPropertyName("max_attempts")]    public int? MaxAttempts { get; init; }
    [JsonPropertyName("pass_percentage")] public double? PassPercentage { get; init; }
    [JsonPropertyName("total_marks")]     public double TotalMarks { get; init; }

    [JsonPropertyName("questions")] public List<Question> Questions { get; init; } = new();
}

public sealed class Question
{
    [JsonPropertyName("id")]    public int Id { get; init; }
    [JsonPropertyName("text")]  public string Text { get; init; } = "";
    [JsonPropertyName("marks")] public double Marks { get; init; }
    [JsonPropertyName("display_order")] public int DisplayOrder { get; init; }
    [JsonPropertyName("image")] public string? Image { get; init; }

    [JsonPropertyName("choices")] public List<Choice> Choices { get; init; } = new();
}

public sealed class Choice
{
    [JsonPropertyName("id")]   public int Id { get; init; }
    [JsonPropertyName("text")] public string Text { get; init; } = "";
    [JsonPropertyName("display_order")] public int DisplayOrder { get; init; }

    // is_correct is deliberately not modelled: the student payload omits it.
}

// ── Submission ───────────────────────────────────────────────────────────────

/// <summary>
/// Body of POST /academic/submit/.
///
/// The wire names are exercise_id / question_id / choice_id, which do NOT match
/// the names the read serializers use (exercise, question, selected_choice).
/// Mirroring the read shape here produces "هذا الحقل مطلوب." and a lost attempt.
/// </summary>
public sealed class SubmissionRequest
{
    [JsonPropertyName("exercise_id")] public required int ExerciseId { get; init; }
    [JsonPropertyName("answers")]     public required List<SubmissionAnswerRequest> Answers { get; init; }
}

public sealed class SubmissionAnswerRequest
{
    [JsonPropertyName("question_id")] public required int QuestionId { get; init; }

    /// <summary>
    /// Nullable, and the server means it: a null choice records the question as
    /// answered-but-blank rather than rejecting the submission.
    /// </summary>
    [JsonPropertyName("choice_id")] public int? ChoiceId { get; init; }
}

/// <summary>
/// A graded submission. This is where the correct answers finally arrive —
/// after the attempt, never before.
/// </summary>
public sealed class Submission
{
    [JsonPropertyName("id")] public int Id { get; init; }

    [JsonPropertyName("student")]      public int Student { get; init; }
    [JsonPropertyName("student_name")] public string? StudentName { get; init; }

    [JsonPropertyName("exercise")]       public int Exercise { get; init; }
    [JsonPropertyName("exercise_title")] public string? ExerciseTitle { get; init; }

    [JsonPropertyName("score")]      public double Score { get; init; }
    [JsonPropertyName("percentage")] public double Percentage { get; init; }
    [JsonPropertyName("is_passed")]  public bool IsPassed { get; init; }

    [JsonPropertyName("attempt_number")] public int AttemptNumber { get; init; }
    [JsonPropertyName("submitted_at")]   public DateTimeOffset? SubmittedAt { get; init; }

    [JsonPropertyName("answers")] public List<SubmissionAnswerResult> Answers { get; init; } = new();
}

public sealed class SubmissionAnswerResult
{
    [JsonPropertyName("question_text")]  public string? QuestionText { get; init; }
    [JsonPropertyName("selected_text")]  public string? SelectedText { get; init; }
    [JsonPropertyName("is_correct")]     public bool IsCorrect { get; init; }
    [JsonPropertyName("correct_choice")] public string? CorrectChoice { get; init; }
}

/// <summary>One row of /academic/my-progress/.</summary>
public sealed class LessonProgress
{
    [JsonPropertyName("id")]     public int Id { get; init; }
    [JsonPropertyName("lesson")] public int Lesson { get; init; }

    [JsonPropertyName("is_completed")] public bool IsCompleted { get; init; }
    [JsonPropertyName("completed_at")] public DateTimeOffset? CompletedAt { get; init; }
    [JsonPropertyName("last_viewed")]  public DateTimeOffset? LastViewed { get; init; }
}
