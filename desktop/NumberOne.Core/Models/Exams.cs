using System.Text.Json.Serialization;

namespace NumberOne.Core.Models;

/// <summary>
/// A row of /exams/student/list/. Hand-built by StudentExamListView rather than
/// a serializer, so the field set here is that view's dictionary, not Exam's.
///
/// IMPORTANT: exam access follows a different rule than course access. That view
/// gives an "online" student every active course in their enrolled_grade, while
/// MyCoursesView reads StudentCourseAccess. So <see cref="CourseId"/> may name a
/// course that never appears in my-courses — always display
/// <see cref="CourseName"/> from here rather than resolving the id against the
/// courses list.
/// </summary>
public sealed class ExamSummary
{
    [JsonPropertyName("id")]    public int Id { get; init; }
    [JsonPropertyName("title")] public string Title { get; init; } = "";

    [JsonPropertyName("duration_minutes")] public int DurationMinutes { get; init; }
    [JsonPropertyName("passing_score")]    public double PassingScore { get; init; }

    [JsonPropertyName("course_id")]   public int CourseId { get; init; }
    [JsonPropertyName("course_name")] public string CourseName { get; init; } = "";

    [JsonPropertyName("total_marks")]    public double TotalMarks { get; init; }
    [JsonPropertyName("question_count")] public int QuestionCount { get; init; }

    /// <summary>Every past attempt. Empty means the exam is still available.</summary>
    [JsonPropertyName("attempts")] public List<ExamAttemptSummary> Attempts { get; init; } = new();

    [JsonIgnore] public bool HasBeenAttempted => Attempts.Count > 0;

    /// <summary>
    /// Best result so far, which is what the completed tab shows. There is no
    /// server-side attempt limit, so a student may have several.
    /// </summary>
    [JsonIgnore]
    public ExamAttemptSummary? BestAttempt =>
        Attempts.OrderByDescending(a => a.Percentage).FirstOrDefault();

    /// <summary>"٣٠ دقيقة" for the المدة column.</summary>
    [JsonIgnore]
    public string DurationLabel =>
        ViewModels.UiText.Count(DurationMinutes, "دقيقة", "دقيقتان", "دقائق");

    /// <summary>"١٢ سؤالاً" — the row's second line, under the title.</summary>
    [JsonIgnore]
    public string QuestionCountLabel =>
        ViewModels.UiText.Count(QuestionCount, "سؤال", "سؤالان", "أسئلة", "واحد");

    /// <summary>"٥٠ درجة" — the mark the exam is out of.</summary>
    [JsonIgnore]
    public string TotalMarksLabel =>
        ViewModels.UiText.ToArabicIndicDigits(Whole(TotalMarks)) + " درجة";

    /// <summary>
    /// The best attempt as "٤٢ / ٥٠". Empty where nothing has been attempted,
    /// which is what the available tab shows.
    /// </summary>
    [JsonIgnore]
    public string BestScoreLabel => BestAttempt is { } best
        ? $"{ViewModels.UiText.ToArabicIndicDigits(Whole(best.Score))} / " +
          $"{ViewModels.UiText.ToArabicIndicDigits(Whole(TotalMarks))}"
        : "";

    [JsonIgnore] public bool BestAttemptPassed => BestAttempt?.IsPassed == true;

    [JsonIgnore]
    public string BestVerdictLabel => BestAttempt is null ? "" : BestAttemptPassed ? "ناجح" : "راسب";

    [JsonIgnore]
    public string BestAttemptDateLabel =>
        BestAttempt?.SubmittedAt is { } at ? ViewModels.UiText.FormatDate(at) : "";

    /// <summary>
    /// "ابدأ" the first time, "إعادة المحاولة" after. There is no server-side
    /// attempt limit, so a completed exam can always be sat again.
    /// </summary>
    [JsonIgnore]
    public string StartLabel => HasBeenAttempted ? "إعادة المحاولة" : "ابدأ";

    private static string Whole(double value) =>
        value == Math.Floor(value) ? ((int)value).ToString() : value.ToString("0.##");
}

public sealed class ExamAttemptSummary
{
    [JsonPropertyName("id")]         public int Id { get; init; }
    [JsonPropertyName("score")]      public double Score { get; init; }
    [JsonPropertyName("percentage")] public double Percentage { get; init; }
    [JsonPropertyName("is_passed")]  public bool IsPassed { get; init; }
    [JsonPropertyName("submitted_at")] public DateTimeOffset? SubmittedAt { get; init; }
}

/// <summary>
/// An exam ready to sit — StudentExamDetailSerializer. correct_answer is
/// omitted from every question.
///
/// <see cref="DurationMinutes"/> is advisory. There is no server-side attempt:
/// ExamAttempt.started_at is written at submit time alongside submitted_at, so
/// nothing enforces the clock, limits attempts, or survives the app closing.
/// The countdown and any resume state are the client's own.
/// </summary>
public sealed class ExamDetail
{
    [JsonPropertyName("id")]          public int Id { get; init; }
    [JsonPropertyName("course")]      public int Course { get; init; }
    [JsonPropertyName("course_name")] public string CourseName { get; init; } = "";
    [JsonPropertyName("title")]       public string Title { get; init; } = "";

    [JsonPropertyName("duration_minutes")] public int DurationMinutes { get; init; }
    [JsonPropertyName("passing_score")]    public double PassingScore { get; init; }

    [JsonPropertyName("total_marks")]    public double TotalMarks { get; init; }
    [JsonPropertyName("question_count")] public int QuestionCount { get; init; }

    [JsonPropertyName("questions")] public List<ExamQuestion> Questions { get; init; } = new();
}

public sealed class ExamQuestion
{
    [JsonPropertyName("id")] public int Id { get; init; }

    /// <summary>"true_false", "multiple_choice", "fill_blank" or "matching".</summary>
    [JsonPropertyName("question_type")] public string QuestionType { get; init; } = "";

    [JsonPropertyName("title")] public string? Title { get; init; }
    [JsonPropertyName("text")]  public string Text { get; init; } = "";
    [JsonPropertyName("marks")] public double Marks { get; init; }
    [JsonPropertyName("display_order")] public int DisplayOrder { get; init; }

    [JsonPropertyName("options")]   public List<ExamOption> Options { get; init; } = new();
    [JsonPropertyName("image_url")] public string? ImageUrl { get; init; }

    /// <summary>Matching questions only: the left column, in order.</summary>
    [JsonPropertyName("matching_left")]  public List<string>? MatchingLeft { get; init; }

    /// <summary>Matching questions only: the right column, shuffled server-side.</summary>
    [JsonPropertyName("matching_right")] public List<string>? MatchingRight { get; init; }
}

public sealed class ExamOption
{
    [JsonPropertyName("id")]   public int Id { get; init; }
    [JsonPropertyName("text")] public string Text { get; init; } = "";
    [JsonPropertyName("display_order")] public int DisplayOrder { get; init; }
}

/// <summary>Body of POST /exams/student/&lt;id&gt;/submit/.</summary>
public sealed class ExamSubmission
{
    [JsonPropertyName("answers")] public required List<ExamAnswer> Answers { get; init; }
}

/// <summary>
/// One answer. The shape of <see cref="Answer"/> depends on the question type,
/// and the server grades by reading specific keys out of it
/// (exams/serializers.py StudentExamAttemptCreateSerializer):
///
///   true_false      {"value": true}
///   multiple_choice {"option_id": 12}
///   fill_blank      {"text": "..."}     compared case-insensitively, trimmed
///   matching        {"pairs": [{"a": "...", "b": "..."}]}
///
/// A key the grader does not recognise scores zero silently, so
/// <see cref="ExamAnswers"/> builds these rather than callers hand-rolling them.
/// </summary>
public sealed class ExamAnswer
{
    [JsonPropertyName("question_id")] public required int QuestionId { get; init; }
    [JsonPropertyName("answer")]      public required Dictionary<string, object?> Answer { get; init; }
}

/// <summary>Builds the per-type answer payloads the grader actually reads.</summary>
public static class ExamAnswers
{
    public const string TrueFalse = "true_false";
    public const string MultipleChoice = "multiple_choice";
    public const string FillBlank = "fill_blank";
    public const string Matching = "matching";

    public static ExamAnswer ForTrueFalse(int questionId, bool value) =>
        new() { QuestionId = questionId, Answer = new() { ["value"] = value } };

    public static ExamAnswer ForMultipleChoice(int questionId, int optionId) =>
        new() { QuestionId = questionId, Answer = new() { ["option_id"] = optionId } };

    public static ExamAnswer ForFillBlank(int questionId, string text) =>
        new() { QuestionId = questionId, Answer = new() { ["text"] = text } };

    public static ExamAnswer ForMatching(int questionId, IEnumerable<(string Left, string Right)> pairs) =>
        new()
        {
            QuestionId = questionId,
            Answer = new()
            {
                ["pairs"] = pairs
                    .Select(p => new Dictionary<string, string> { ["a"] = p.Left, ["b"] = p.Right })
                    .ToList(),
            },
        };

    /// <summary>
    /// An unanswered question. The server treats a missing question as an empty
    /// answer and scores it zero, so sending this is equivalent — but explicit,
    /// which keeps the submitted count matching what the student saw.
    /// </summary>
    public static ExamAnswer Blank(int questionId) =>
        new() { QuestionId = questionId, Answer = new() };
}

/// <summary>Response of a submit, and of /exams/student/attempts/&lt;id&gt;/.</summary>
public sealed class ExamSubmitResult
{
    [JsonPropertyName("detail")]  public string? Detail { get; init; }
    [JsonPropertyName("attempt")] public ExamAttemptDetail? Attempt { get; init; }
}

/// <summary>
/// A finished attempt with its answer sheet. correct_answer is included here —
/// after the fact, which is the only time it is safe.
/// </summary>
public sealed class ExamAttemptDetail
{
    [JsonPropertyName("id")]         public int Id { get; init; }
    [JsonPropertyName("score")]      public double Score { get; init; }
    [JsonPropertyName("percentage")] public double Percentage { get; init; }
    [JsonPropertyName("is_passed")]  public bool IsPassed { get; init; }

    [JsonPropertyName("started_at")]   public DateTimeOffset? StartedAt { get; init; }
    [JsonPropertyName("submitted_at")] public DateTimeOffset? SubmittedAt { get; init; }

    [JsonPropertyName("exam_title")]  public string? ExamTitle { get; init; }
    [JsonPropertyName("total_marks")] public double TotalMarks { get; init; }

    [JsonPropertyName("answers")] public List<ExamAttemptAnswer> Answers { get; init; } = new();
}

public sealed class ExamAttemptAnswer
{
    [JsonPropertyName("id")] public int Id { get; init; }

    [JsonPropertyName("question_title")] public string? QuestionTitle { get; init; }
    [JsonPropertyName("question_text")]  public string? QuestionText { get; init; }
    [JsonPropertyName("question_type")]  public string? QuestionType { get; init; }
    [JsonPropertyName("question_marks")] public double QuestionMarks { get; init; }

    [JsonPropertyName("correct_answer")] public Dictionary<string, object?>? CorrectAnswer { get; init; }
    [JsonPropertyName("student_answer")] public Dictionary<string, object?>? StudentAnswer { get; init; }

    [JsonPropertyName("is_correct")]   public bool IsCorrect { get; init; }
    [JsonPropertyName("earned_marks")] public double EarnedMarks { get; init; }

    [JsonPropertyName("options")] public List<ExamOption> Options { get; init; } = new();
}
