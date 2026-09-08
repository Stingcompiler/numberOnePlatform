using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NumberOne.Core.Models;
using NumberOne.Core.Services;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// The exam runner: one question at a time, a countdown, and a submit that is
/// final.
///
/// The clock is entirely client-side and advisory. There is no server-side
/// attempt: ExamAttempt.started_at is written at submit time alongside
/// submitted_at, so nothing enforces the duration, limits attempts, or survives
/// the app closing. Do not present the timer as if the server were enforcing it.
/// </summary>
public sealed partial class ExamRunnerViewModel : ObservableObject
{
    private readonly StudentApi _api;
    private readonly int _examId;

    /// <summary>question id → the answer built for it.</summary>
    private readonly Dictionary<int, ExamAnswer> _answers = new();

    public ExamRunnerViewModel(StudentApi api, int examId)
    {
        _api = api;
        _examId = examId;

        Exam = new SectionState<ExamDetail>(LoadExamAsync, e => e.Questions.Count == 0);
    }

    public SectionState<ExamDetail> Exam { get; }

    /// <summary>Raised on "العودة إلى الاختبارات" after a result.</summary>
    public event EventHandler? Finished;

    /// <summary>Raised by "حفظ والخروج" — the attempt is kept locally.</summary>
    public event EventHandler? SavedAndExited;

    /// <summary>Warning toast text, e.g. "اختر إجابة للمتابعة".</summary>
    public event EventHandler<string>? Warned;

    // ── Position ─────────────────────────────────────────────────────────────

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(CurrentQuestion), nameof(QuestionLabel), nameof(Progress),
        nameof(IsFirstQuestion), nameof(IsLastQuestion), nameof(NextLabel))]
    private int _questionIndex;

    public IReadOnlyList<ExamQuestion> Questions =>
        Exam.Value?.Questions.OrderBy(q => q.DisplayOrder).ToList() ?? new List<ExamQuestion>();

    public ExamQuestion? CurrentQuestion =>
        QuestionIndex >= 0 && QuestionIndex < Questions.Count ? Questions[QuestionIndex] : null;

    /// <summary>"سؤال ١ من ٥"</summary>
    public string QuestionLabel => Questions.Count == 0
        ? ""
        : $"سؤال {UiText.ToArabicIndicDigits((QuestionIndex + 1).ToString())} " +
          $"من {UiText.ToArabicIndicDigits(Questions.Count.ToString())}";

    public double Progress => Questions.Count == 0 ? 0 : (QuestionIndex + 1.0) / Questions.Count;

    public bool IsFirstQuestion => QuestionIndex == 0;
    public bool IsLastQuestion => Questions.Count > 0 && QuestionIndex == Questions.Count - 1;

    public string NextLabel => IsLastQuestion ? "إنهاء وتسليم" : "السؤال التالي";

    // ── Timer ────────────────────────────────────────────────────────────────

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(RemainingLabel), nameof(IsTimeUp))]
    private TimeSpan _remaining;

    public bool IsTimeUp => Remaining <= TimeSpan.Zero;

    /// <summary>"٢٨:١٤" — mm:ss, in Arabic-Indic digits.</summary>
    public string RemainingLabel
    {
        get
        {
            var clamped = Remaining < TimeSpan.Zero ? TimeSpan.Zero : Remaining;
            return UiText.ToArabicIndicDigits($"{(int)clamped.TotalMinutes:00}:{clamped.Seconds:00}");
        }
    }

    /// <summary>
    /// Advances the clock. Driven by the view so nothing keeps ticking after the
    /// screen is gone. Submits automatically when time runs out — the student
    /// keeps whatever they had answered rather than losing the attempt.
    /// </summary>
    public async Task TickAsync(TimeSpan elapsed, CancellationToken ct = default)
    {
        if (HasResult || Remaining <= TimeSpan.Zero) return;

        Remaining -= elapsed;

        if (Remaining <= TimeSpan.Zero)
        {
            Remaining = TimeSpan.Zero;
            await SubmitAsync(ct).ConfigureAwait(true);
        }
    }

    // ── Answering ────────────────────────────────────────────────────────────

    public void Answer(ExamAnswer answer) => _answers[answer.QuestionId] = answer;

    public bool IsAnswered(int questionId) => _answers.ContainsKey(questionId);

    public int AnsweredCount => _answers.Count;

    /// <summary>The chosen option, for rendering the selected radio row.</summary>
    public int? ChosenOption(int questionId) =>
        _answers.TryGetValue(questionId, out var answer)
        && answer.Answer.TryGetValue("option_id", out var value)
        && value is int optionId
            ? optionId
            : null;

    public bool? ChosenBoolean(int questionId) =>
        _answers.TryGetValue(questionId, out var answer)
        && answer.Answer.TryGetValue("value", out var value)
        && value is bool flag
            ? flag
            : null;

    // ── Navigation ───────────────────────────────────────────────────────────

    [RelayCommand]
    private void Previous()
    {
        if (QuestionIndex > 0) QuestionIndex--;
    }

    [RelayCommand]
    private async Task NextAsync(CancellationToken ct)
    {
        if (CurrentQuestion is null) return;

        // Advancing with nothing selected raises a warning rather than silently
        // recording a blank — a blank scores zero, and the student should know.
        if (!IsAnswered(CurrentQuestion.Id))
        {
            Warned?.Invoke(this, "اختر إجابة للمتابعة");
            return;
        }

        if (IsLastQuestion)
        {
            // The design opens the shared confirm dialog here; the view raises
            // it and calls SubmitAsync on confirmation.
            RequestSubmitConfirmation?.Invoke(this, EventArgs.Empty);
            return;
        }

        QuestionIndex++;
        await Task.CompletedTask;
    }

    /// <summary>Raised on the last question, so the view can confirm before submitting.</summary>
    public event EventHandler? RequestSubmitConfirmation;

    [RelayCommand]
    private void SaveAndExit() => SavedAndExited?.Invoke(this, EventArgs.Empty);

    // ── Result ───────────────────────────────────────────────────────────────

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasResult), nameof(IsRunning), nameof(VerdictLabel), nameof(ScoreLabel))]
    private ExamAttemptDetail? _result;

    public bool HasResult => Result is not null;

    /// <summary>
    /// The question card is showing. Not simply the negation of HasResult: it
    /// must also be gone while the exam is still loading or has failed, or an
    /// empty card sits above the error panel.
    /// </summary>
    public bool IsRunning => Result is null && Exam.HasData;

    public string VerdictLabel => Result?.IsPassed == true ? "ناجح" : "راسب";

    /// <summary>"٤٢ / ٥٠" — tabular, Arabic-Indic.</summary>
    public string ScoreLabel => Result is null
        ? ""
        : $"{UiText.ToArabicIndicDigits(Format(Result.Score))} / " +
          $"{UiText.ToArabicIndicDigits(Format(Exam.Value?.TotalMarks ?? 0))}";

    private static string Format(double value) =>
        value == Math.Floor(value) ? ((int)value).ToString() : value.ToString("0.##");

    /// <summary>
    /// Submits every question — including the ones left blank, explicitly. The
    /// server treats a missing question as blank anyway, so sending them keeps
    /// the answer count matching what the student actually saw.
    /// </summary>
    [RelayCommand]
    public async Task SubmitAsync(CancellationToken ct = default)
    {
        if (HasResult) return;

        var answers = Questions
            .Select(q => _answers.TryGetValue(q.Id, out var answer) ? answer : ExamAnswers.Blank(q.Id))
            .ToList();

        var response = await _api
            .SubmitExamAsync(_examId, new ExamSubmission { Answers = answers }, ct)
            .ConfigureAwait(true);

        Result = response?.Attempt;
    }

    [RelayCommand]
    private void Finish() => Finished?.Invoke(this, EventArgs.Empty);

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        await Exam.LoadAsync(ct).ConfigureAwait(true);

        if (Exam.Value is not null)
            Remaining = TimeSpan.FromMinutes(Exam.Value.DurationMinutes);

        QuestionIndex = 0;
        OnPropertyChanged(nameof(IsRunning));
        OnPropertyChanged(nameof(Questions));
        OnPropertyChanged(nameof(CurrentQuestion));
        OnPropertyChanged(nameof(QuestionLabel));
        OnPropertyChanged(nameof(IsLastQuestion));
        OnPropertyChanged(nameof(NextLabel));
    }

    private async Task<ExamDetail> LoadExamAsync(CancellationToken ct)
        => await _api.GetExamAsync(_examId, ct).ConfigureAwait(true)
           ?? throw new InvalidOperationException($"Exam {_examId} returned no body.");
}
