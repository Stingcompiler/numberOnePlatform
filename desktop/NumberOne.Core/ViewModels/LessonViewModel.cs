using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NumberOne.Core.Api;
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
    private readonly Uri _apiBase;
    private readonly int _lessonId;

    public LessonViewModel(StudentApi api, AuthService auth, Uri apiBase, int lessonId)
    {
        _api = api;
        _auth = auth;
        _apiBase = apiBase;
        _lessonId = lessonId;

        Lesson = new SectionState<Lesson>(LoadLessonAsync, l => string.IsNullOrWhiteSpace(l.Title));
    }

    public SectionState<Lesson> Lesson { get; }

    /// <summary>
    /// Shown when the server refuses the lecture. Names the cause, because
    /// "you are not authorised" on a course the app just listed reads as a
    /// broken app rather than an unactivated subscription.
    /// </summary>
    public const string LessonLockedMessage =
        "لم يُفعَّل اشتراكك في هذا الكورس بعد، لذلك لا يمكن فتح المحاضرة. يرجى التواصل مع إدارة المدرسة لتفعيل الاشتراك.";

    // ── Video ────────────────────────────────────────────────────────────────

    /// <summary>
    /// What the WebView actually loads: the player page on the API host, which
    /// wraps the YouTube embed in an iframe.
    ///
    /// Pointing the WebView straight at youtube.com/embed/... produces
    /// "Error 153 - video player configuration error", because that URL is
    /// meant to sit inside an iframe on a page rather than be navigated to.
    /// The web dashboard and the mobile app both wrap it; this now does too.
    ///
    /// Null when the lesson has no video, or when no id can be read out of the
    /// server's embed URL - better an empty frame than a page that errors.
    /// </summary>
    public string? PlayerUrl
    {
        get
        {
            var videoId = VideoId;
            if (videoId is null) return null;

            // Falls back to the embed URL against a server without the player
            // route. That still shows YouTube's own error rather than playing,
            // but it is honest about being a video problem instead of showing a
            // 404 page that reads as a missing lesson.
            return _playerPageAvailable
                ? new Uri(_apiBase, ApiEndpoints.LessonPlayer(videoId)).AbsoluteUri
                : Lesson.Value?.YoutubeEmbedUrl;
        }
    }

    private bool _playerPageAvailable = true;

    /// <summary>
    /// Shown when the server predates the player page, so the student is told
    /// the app is ahead of the server rather than left staring at an error.
    /// </summary>
    public bool IsServerOutdatedForPlayback => VideoId is not null && !_playerPageAvailable;

    public const string ServerOutdatedMessage =
        "تعذّر تشغيل الفيديو: نسخة الخادم أقدم من التطبيق. يرجى إبلاغ الإدارة.";

    /// <summary>
    /// The YouTube id, read out of the embed URL the server built.
    ///
    /// The server falls back to returning the raw URL when it cannot parse one
    /// (it only handles "youtu.be/" and "v="), so a lesson saved with a /live/
    /// or /shorts/ link arrives here as something that is not an embed URL at
    /// all. Those forms are handled here rather than assumed away.
    /// </summary>
    private string? VideoId
    {
        get
        {
            var url = Lesson.Value?.YoutubeEmbedUrl;
            if (string.IsNullOrWhiteSpace(url)) return null;

            foreach (var marker in new[] { "/embed/", "youtu.be/", "/live/", "/shorts/", "v=" })
            {
                var at = url.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
                if (at < 0) continue;

                var id = url[(at + marker.Length)..];
                id = id.Split('?', '&', '/')[0].Trim();

                if (IsVideoId(id)) return id;
            }

            return null;
        }
    }

    private static bool IsVideoId(string value) =>
        value.Length is >= 6 and <= 20 &&
        value.All(c => char.IsLetterOrDigit(c) || c == '_' || c == '-');

    /// <summary>The raw embed URL as the server sent it. Kept for diagnostics.</summary>
    public string? EmbedUrl => Lesson.Value?.YoutubeEmbedUrl;

    public bool HasVideo => PlayerUrl is not null;

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

        if (VideoId is not null)
            _playerPageAvailable = await _api.PlayerPageAvailableAsync(ct).ConfigureAwait(true);

        OnPropertyChanged(nameof(IsServerOutdatedForPlayback));
        OnPropertyChanged(nameof(EmbedUrl));
        OnPropertyChanged(nameof(PlayerUrl));
        OnPropertyChanged(nameof(HasVideo));
        OnPropertyChanged(nameof(Exercise));
        OnPropertyChanged(nameof(HasExercise));

        MarkCompleteCommand.NotifyCanExecuteChanged();
        SubmitExerciseCommand.NotifyCanExecuteChanged();
    }

    private async Task<Lesson> LoadLessonAsync(CancellationToken ct)
    {
        Lesson? lesson;

        try
        {
            // This GET is what creates the LessonProgress row, so it is also what
            // makes MarkComplete possible. Not a free read.
            lesson = await _api.GetLessonAsync(_lessonId, ct).ConfigureAwait(true);
        }
        catch (ApiRequestException ex) when (ex.IsForbidden)
        {
            // The student was shown this course, then refused the lecture inside
            // it. That is not a client inconsistency to paper over: the courses
            // list and the exams list are keyed on enrolled_grade, while
            // MyLessonDetailView requires a StudentCourseAccess row that an
            // online student only receives on their first payment.
            //
            // The server's wording is accurate but leaves the student with
            // nothing to do, so it is restated with the reason and the remedy.
            throw ApiRequestException.Restated(
                System.Net.HttpStatusCode.Forbidden, LessonLockedMessage);
        }

        if (lesson is null)
            throw new InvalidOperationException($"Lesson {_lessonId} returned no body.");

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
