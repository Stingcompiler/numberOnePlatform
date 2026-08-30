using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NumberOne.Core.Models;
using NumberOne.Core.Services;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// «عرض التفاصيل» — the answer sheet for a finished attempt, and the only row
/// action the results table has.
///
/// This is where correct answers finally arrive. The exam endpoint omits them
/// while the exam can still be sat; the attempt endpoint includes them, which is
/// safe because the attempt is over.
/// </summary>
public sealed partial class AttemptDetailViewModel : ObservableObject
{
    private readonly StudentApi _api;
    private readonly int _attemptId;

    public AttemptDetailViewModel(StudentApi api, int attemptId)
    {
        _api = api;
        _attemptId = attemptId;

        Attempt = new SectionState<ExamAttemptDetail>(
            async ct => await _api.GetAttemptAsync(_attemptId, ct).ConfigureAwait(true)
                        ?? throw new InvalidOperationException($"Attempt {_attemptId} returned no body."),
            a => a.Answers.Count == 0);
    }

    public SectionState<ExamAttemptDetail> Attempt { get; }

    public event EventHandler? BackRequested;

    public string VerdictLabel => Attempt.Value?.IsPassed == true ? "ناجح" : "راسب";

    public bool IsPassed => Attempt.Value?.IsPassed == true;

    public string ScoreLabel => Attempt.Value is { } a
        ? $"{UiText.ToArabicIndicDigits(Format(a.Score))} / {UiText.ToArabicIndicDigits(Format(a.TotalMarks))}"
        : "";

    public string DateLabel => Attempt.Value?.SubmittedAt is { } at ? UiText.FormatDate(at) : "";

    /// <summary>The answer sheet, ordered as the student saw it.</summary>
    public IReadOnlyList<AnswerRow> Answers =>
        Attempt.Value?.Answers.Select((a, index) => AnswerRow.From(a, index + 1)).ToList()
        ?? new List<AnswerRow>();

    public int CorrectCount => Attempt.Value?.Answers.Count(a => a.IsCorrect) ?? 0;

    [RelayCommand]
    private void Back() => BackRequested?.Invoke(this, EventArgs.Empty);

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        await Attempt.LoadAsync(ct).ConfigureAwait(true);

        OnPropertyChanged(nameof(Answers));
        OnPropertyChanged(nameof(VerdictLabel));
        OnPropertyChanged(nameof(IsPassed));
        OnPropertyChanged(nameof(ScoreLabel));
        OnPropertyChanged(nameof(DateLabel));
        OnPropertyChanged(nameof(CorrectCount));
    }

    private static string Format(double value) =>
        value == Math.Floor(value) ? ((int)value).ToString() : value.ToString("0.##");
}

/// <summary>One question of the answer sheet, rendered after the fact.</summary>
public sealed record AnswerRow
{
    public required int Index { get; init; }
    public required string QuestionText { get; init; }
    public required string QuestionType { get; init; }
    public required bool IsCorrect { get; init; }
    public required double EarnedMarks { get; init; }
    public required double QuestionMarks { get; init; }
    public required string StudentAnswerLabel { get; init; }
    public required string CorrectAnswerLabel { get; init; }

    public string IndexLabel => UiText.ToArabicIndicDigits(Index.ToString());

    public string MarksLabel =>
        $"{UiText.ToArabicIndicDigits(Fmt(EarnedMarks))} / {UiText.ToArabicIndicDigits(Fmt(QuestionMarks))}";

    public static AnswerRow From(ExamAttemptAnswer answer, int index) => new()
    {
        Index = index,
        QuestionText = answer.QuestionText ?? "",
        QuestionType = answer.QuestionType ?? "",
        IsCorrect = answer.IsCorrect,
        EarnedMarks = answer.EarnedMarks,
        QuestionMarks = answer.QuestionMarks,
        StudentAnswerLabel = Describe(answer.QuestionType, answer.StudentAnswer, answer.Options),
        CorrectAnswerLabel = Describe(answer.QuestionType, answer.CorrectAnswer, answer.Options),
    };

    /// <summary>
    /// Renders a stored answer as something a student can read.
    ///
    /// The payload shape differs per question type, and the values arrive as
    /// JsonElement rather than CLR types because the server stores them in a
    /// JSONField — so this reads them defensively and falls back to a dash
    /// rather than showing raw JSON on a results screen.
    /// </summary>
    private static string Describe(
        string? questionType,
        Dictionary<string, object?>? payload,
        IReadOnlyList<ExamOption> options)
    {
        if (payload is null || payload.Count == 0) return "—";

        switch (questionType)
        {
            case ExamAnswers.TrueFalse:
                var flag = ReadBool(payload, "value");
                return flag is null ? "—" : flag.Value ? "صواب" : "خطأ";

            case ExamAnswers.MultipleChoice:
                var optionId = ReadInt(payload, "option_id");
                var option = optionId is null ? null : options.FirstOrDefault(o => o.Id == optionId);
                return option?.Text ?? "—";

            case ExamAnswers.FillBlank:
                var text = ReadString(payload, "text");
                return string.IsNullOrWhiteSpace(text) ? "—" : text!;

            case ExamAnswers.Matching:
                // Rendering every pair would overflow the row; the count is what
                // the student needs, and the verdict already says whether the
                // whole set matched.
                return "مطابقة";

            default:
                return "—";
        }
    }

    private static bool? ReadBool(Dictionary<string, object?> payload, string key)
    {
        if (!payload.TryGetValue(key, out var raw) || raw is null) return null;
        if (raw is bool b) return b;

        if (raw is System.Text.Json.JsonElement element)
        {
            return element.ValueKind switch
            {
                System.Text.Json.JsonValueKind.True => true,
                System.Text.Json.JsonValueKind.False => false,
                _ => null,
            };
        }

        return bool.TryParse(raw.ToString(), out var parsed) ? parsed : null;
    }

    private static int? ReadInt(Dictionary<string, object?> payload, string key)
    {
        if (!payload.TryGetValue(key, out var raw) || raw is null) return null;
        if (raw is int i) return i;

        if (raw is System.Text.Json.JsonElement element
            && element.ValueKind == System.Text.Json.JsonValueKind.Number
            && element.TryGetInt32(out var value))
        {
            return value;
        }

        return int.TryParse(raw.ToString(), out var parsedInt) ? parsedInt : null;
    }

    private static string? ReadString(Dictionary<string, object?> payload, string key)
    {
        if (!payload.TryGetValue(key, out var raw) || raw is null) return null;

        if (raw is System.Text.Json.JsonElement element)
            return element.ValueKind == System.Text.Json.JsonValueKind.String ? element.GetString() : null;

        return raw.ToString();
    }

    private static string Fmt(double value) =>
        value == Math.Floor(value) ? ((int)value).ToString() : value.ToString("0.##");
}
