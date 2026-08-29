using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NumberOne.Core.Models;
using NumberOne.Core.Services;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// The lesson player: video, watermark, completion toggle and the exercise.
/// </summary>
public sealed partial class LessonViewModel : ObservableObject
{
    private readonly StudentApi _api;
    private readonly AuthService _auth;
    private readonly int _lessonId;

    public LessonViewModel(StudentApi api, AuthService auth, int lessonId)
    {
        _api = api;
        _auth = auth;
        _lessonId = lessonId;

        Lesson = new SectionState<Lesson>(LoadLessonAsync, l => string.IsNullOrWhiteSpace(l.Title));
    }

    public SectionState<Lesson> Lesson { get; }

    // ── Video ────────────────────────────────────────────────────────────────

    /// <summary>
    /// The /embed/ URL for the WebView. The raw watch URL is never sent to
    /// students, so there is nothing else to fall back to.
    /// </summary>
    public string? EmbedUrl => Lesson.Value?.YoutubeEmbedUrl;

    public bool HasVideo => Lesson.Value?.HasVideo == true;

    /// <summary>
    /// The video surface is fixed at 920 x 518 — an 11in 16:9 diagonal at 96 DPI.
    /// It is both a size and a maximum: the picture never renders larger however
    /// wide the window, and where the column is narrower it is scaled down about
    /// its centre rather than cropped.
    /// </summary>
    public const double VideoWidth = 920;
    public const double VideoHeight = 518;

    // ── Watermark ────────────────────────────────────────────────────────────

    /// <summary>
    /// Student name for the overlay. This is the layer that actually works
    /// everywhere: it does not stop a recording, it makes a leak traceable,
    /// which in a school is the stronger deterrent.
    /// </summary>
    public string WatermarkName => _auth.CurrentUser?.WatermarkName ?? "";

    /// <summary>Phone, rendered LTR beside the name.</summary>
    public string WatermarkPhone => _auth.CurrentUser?.Phone ?? "";

    [ObservableProperty]
    private string _watermarkTimestamp = "";

    /// <summary>
    /// Which of the anchor positions the overlay currently sits in. Moved every
    /// 15-20 seconds so the mark cannot simply be cropped out of a recording.
    /// </summary>
    [ObservableProperty]
    private int _watermarkPosition;

    /// <summary>How many anchor positions the overlay cycles through.</summary>
    public const int WatermarkPositions = 4;

    /// <summary>
    /// Advances the clock and, when due, the position. Driven by the view's
    /// timer rather than an internal one so the player owns its own lifetime and
    /// nothing keeps ticking after the screen is gone.
    /// </summary>
    public void TickWatermark(DateTimeOffset now, bool movePosition)
    {
        WatermarkTimestamp = now.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss");

        if (movePosition)
            WatermarkPosition = (WatermarkPosition + 1) % WatermarkPositions;
    }

    // ── Completion ───────────────────────────────────────────────────────────

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(CompletionLabel))]
    private bool _isCompleted;

    public string CompletionLabel => IsCompleted ? "مكتملة" : "تعليم كمكتملة";

    /// <summary>
    /// Marks the lesson complete. The server requires an existing LessonProgress
    /// row, which the lesson GET creates — so this can only succeed after the
    /// lesson has loaded, and the command is gated on that.
    /// </summary>
    [RelayCommand(CanExecute = nameof(CanComplete))]
    private async Task MarkCompleteAsync(CancellationToken ct)
    {
        if (await _api.MarkLessonCompleteAsync(_lessonId, ct).ConfigureAwait(true))
            IsCompleted = true;
    }

    private bool CanComplete() => Lesson.HasData && !IsCompleted;

    // ── Exercise ─────────────────────────────────────────────────────────────

    public Exercise? Exercise => Lesson.Value?.Exercise;

    public bool HasExercise => Exercise is { Questions.Count: > 0 };

    /// <summary>question id → chosen choice id.</summary>
    private readonly Dictionary<int, int> _answers = new();

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(SubmitLabel))]
    [NotifyCanExecuteChangedFor(nameof(SubmitExerciseCommand))]
    private Submission? _result;

    public bool HasResult => Result is not null;

    /// <summary>The primary becomes "إعادة المحاولة" once an attempt is graded.</summary>
    public string SubmitLabel => HasResult ? "إعادة المحاولة" : "تسليم";

    public void Choose(int questionId, int choiceId)
    {
        _answers[questionId] = choiceId;
        SubmitExerciseCommand.NotifyCanExecuteChanged();
    }

    public int? ChosenChoice(int questionId) =>
        _answers.TryGetValue(questionId, out var choiceId) ? choiceId : null;

    private bool CanSubmit() =>
        HasExercise && Exercise!.Questions.All(q => _answers.ContainsKey(q.Id));

    [RelayCommand(CanExecute = nameof(CanSubmit))]
    private async Task SubmitExerciseAsync(CancellationToken ct)
    {
        if (HasResult)
        {
            // "إعادة المحاولة" clears the previous grading and lets the student
            // answer again. The server keeps every attempt; attempt_number
            // increments on its side.
            Result = null;
            _answers.Clear();
            SubmitExerciseCommand.NotifyCanExecuteChanged();
            return;
        }

        var request = new SubmissionRequest
        {
            ExerciseId = Exercise!.Id,
            Answers = _answers
                .Select(pair => new SubmissionAnswerRequest { QuestionId = pair.Key, ChoiceId = pair.Value })
                .ToList(),
        };

        Result = await _api.SubmitExerciseAsync(request, ct).ConfigureAwait(true);
    }

    /// <summary>
    /// After grading: whether this choice was the student's, and whether it was
    /// right. Correct rows turn success, a wrong pick turns danger.
    /// </summary>
    public ChoiceOutcome OutcomeFor(Question question, Choice choice)
    {
        if (Result is null) return ChoiceOutcome.Unanswered;

        var answer = Result.Answers.FirstOrDefault(a => a.QuestionText == question.Text);
        if (answer is null) return ChoiceOutcome.Unanswered;

        var chosen = ChosenChoice(question.Id) == choice.Id;

        if (choice.Text == answer.CorrectChoice) return ChoiceOutcome.Correct;
        return chosen ? ChoiceOutcome.Wrong : ChoiceOutcome.Unanswered;
    }

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        await Lesson.LoadAsync(ct).ConfigureAwait(true);

        OnPropertyChanged(nameof(EmbedUrl));
        OnPropertyChanged(nameof(HasVideo));
        OnPropertyChanged(nameof(Exercise));
        OnPropertyChanged(nameof(HasExercise));

        MarkCompleteCommand.NotifyCanExecuteChanged();
        SubmitExerciseCommand.NotifyCanExecuteChanged();
    }

    private async Task<Lesson> LoadLessonAsync(CancellationToken ct)
    {
        // This GET is what creates the LessonProgress row, so it is also what
        // makes MarkComplete possible. Not a free read.
        var lesson = await _api.GetLessonAsync(_lessonId, ct).ConfigureAwait(true)
                     ?? throw new InvalidOperationException($"Lesson {_lessonId} returned no body.");

        var progress = await _api.GetMyProgressAsync(ct).ConfigureAwait(true);
        IsCompleted = progress.Any(p => p.Lesson == _lessonId && p.IsCompleted);

        return lesson;
    }
}

public enum ChoiceOutcome
{
    Unanswered,
    Correct,
    Wrong,
}
