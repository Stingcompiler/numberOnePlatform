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
    private readonly int _courseId;

    public LessonViewModel(StudentApi api, AuthService auth, Uri apiBase, int lessonId, int courseId)
    {
        _api = api;
        _auth = auth;
        _apiBase = apiBase;
        _lessonId = lessonId;
        _courseId = courseId;

        Lesson = new SectionState<Lesson>(LoadLessonAsync, l => string.IsNullOrWhiteSpace(l.Title));

        // Its own section: the playlist is a convenience, and a course fetch
        // that fails must not take the video down with it.
        Playlist = new SectionState<UnitPlaylist>(LoadPlaylistAsync, p => p.Lessons.Count == 0);
    }

    public SectionState<Lesson> Lesson { get; }

    /// <summary>
    /// The sibling lectures in this lesson's unit — the design's محتويات الوحدة
    /// rail. Built from the course tree, because my-lessons/{id}/ returns the
    /// lesson alone and knows nothing of its neighbours.
    /// </summary>
    public SectionState<UnitPlaylist> Playlist { get; }

    /// <summary>Raised when another lecture is picked out of the rail.</summary>
    public event EventHandler<int>? LessonPicked;

    [RelayCommand]
    private void OpenLesson(PlaylistRow? row)
    {
        if (row is not null && row.Id != _lessonId) LessonPicked?.Invoke(this, row.Id);
    }

    /// <summary>The lesson's own line under the title: unit, duration, course.</summary>
    public string LessonMeta
    {
        get
        {
            var parts = new List<string>();

            if (Playlist.Value is { } playlist)
            {
                if (!string.IsNullOrWhiteSpace(playlist.CourseName)) parts.Add(playlist.CourseName);
                if (!string.IsNullOrWhiteSpace(playlist.UnitName)) parts.Add(playlist.UnitName);
            }

            if (Lesson.Value?.DurationMinutes is > 0 and int minutes)
                parts.Add(UiText.Count(minutes, "دقيقة", "دقيقتان", "دقائق"));

            return string.Join(" · ", parts);
        }
    }

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
        // Never throws: a dropped connection here used to come out of a command
        // with nothing to catch it.
        var attempt = await ApiAttempt
            .TryAsync(token => _api.MarkLessonCompleteAsync(_lessonId, token), ct)
            .ConfigureAwait(true);

        if (attempt.Ok && attempt.Value)
        {
            IsCompleted = true;
            return;
        }

        if (!string.IsNullOrEmpty(attempt.Error))
            Toasted?.Invoke(this, new ToastMessage(attempt.Error, ToastKind.Error));
    }

    private bool CanComplete() => Lesson.HasData && !IsCompleted;

    // ── Exercise ─────────────────────────────────────────────────────────────

    public Exercise? Exercise => Lesson.Value?.Exercise;

    public bool HasExercise => Exercise is { Questions.Count: > 0 };

    /// <summary>"٤ أسئلة" beside the exercise heading.</summary>
    public string ExerciseCountLabel => Exercise is null
        ? ""
        : UiText.Count(Exercise.Questions.Count, "سؤال", "سؤالان", "أسئلة", "واحد");

    // ── Attachment ───────────────────────────────────────────────────────────

    /// <summary>
    /// Opens the lecture's PDF in the system handler. Supplied by the host so
    /// this view model stays free of platform types.
    /// </summary>
    public Func<string, Task<bool>> BrowserLauncher { get; set; } = _ => Task.FromResult(false);

    public event EventHandler<ToastMessage>? Toasted;

    /// <summary>
    /// Shown when the player refuses to leave the app.
    ///
    /// Stated plainly rather than apologetically: this is the app working as
    /// the school intends, not a failure. A student who clicks YouTube's logo
    /// and gets silence would otherwise reasonably conclude the app is stuck.
    /// </summary>
    public const string NavigationBlockedMessage =
        "المحاضرة تُشاهَد داخل التطبيق فقط.";

    /// <summary>
    /// Called by the view when the web view cancelled a navigation or refused a
    /// new window.
    ///
    /// Rate-limited to one message every few seconds: YouTube's chrome can fire
    /// several attempts from a single click, and three identical toasts would
    /// read as an error rather than a rule.
    /// </summary>
    public void ReportBlockedNavigation()
    {
        var now = DateTimeOffset.UtcNow;

        if (now - _lastBlockedReport < TimeSpan.FromSeconds(4)) return;

        _lastBlockedReport = now;
        Toasted?.Invoke(this, new ToastMessage(NavigationBlockedMessage, ToastKind.Warning));
    }

    private DateTimeOffset _lastBlockedReport = DateTimeOffset.MinValue;

    /// <summary>
    /// The attachment opens outside the app rather than in the WebView. The
    /// player's window already carries capture protection; a second WebView
    /// showing the same material would not, and would quietly become the way
    /// around it.
    /// </summary>
    [RelayCommand]
    private async Task OpenAttachmentAsync()
    {
        var url = Lesson.Value?.PdfFile;

        if (string.IsNullOrWhiteSpace(url) ||
            !Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            uri.Scheme is not ("http" or "https"))
        {
            Toasted?.Invoke(this, new ToastMessage("الملف المرفق غير متاح — راجع الإدارة", ToastKind.Error));
            return;
        }

        if (!await BrowserLauncher(url!).ConfigureAwait(true))
            Toasted?.Invoke(this, new ToastMessage("تعذّر فتح الملف على هذا الجهاز", ToastKind.Error));
    }

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

        // The student's answers stay in _answers on failure, so "تسليم" resends
        // the same paper rather than clearing it.
        var attempt = await ApiAttempt
            .TryAsync(token => _api.SubmitExerciseAsync(request, token), ct)
            .ConfigureAwait(true);

        if (!attempt.Ok)
        {
            if (!string.IsNullOrEmpty(attempt.Error))
                Toasted?.Invoke(this, new ToastMessage(attempt.Error, ToastKind.Error));

            return;
        }

        Result = attempt.Value;
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
        // The video first, the rail after: the student came here to watch, and
        // the playlist arriving a moment later costs them nothing.
        await Lesson.LoadAsync(ct).ConfigureAwait(true);

        if (VideoId is not null)
            _playerPageAvailable = await _api.PlayerPageAvailableAsync(ct).ConfigureAwait(true);

        _ = LoadPlaylistSectionAsync(ct);

        OnPropertyChanged(nameof(IsServerOutdatedForPlayback));
        OnPropertyChanged(nameof(EmbedUrl));
        OnPropertyChanged(nameof(PlayerUrl));
        OnPropertyChanged(nameof(HasVideo));
        OnPropertyChanged(nameof(Exercise));
        OnPropertyChanged(nameof(HasExercise));
        OnPropertyChanged(nameof(ExerciseCountLabel));
        OnPropertyChanged(nameof(LessonMeta));

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

    private async Task LoadPlaylistSectionAsync(CancellationToken ct)
    {
        await Playlist.LoadAsync(ct).ConfigureAwait(true);

        OnPropertyChanged(nameof(LessonMeta));
    }

    private async Task<UnitPlaylist> LoadPlaylistAsync(CancellationToken ct)
    {
        var courseTask = _api.GetCourseAsync(_courseId, _auth.CurrentUser?.StudentProfile, ct);
        var progressTask = _api.GetMyProgressAsync(ct);

        await Task.WhenAll(courseTask, progressTask).ConfigureAwait(true);

        var course = courseTask.Result;
        if (course is null) return UnitPlaylist.Empty;

        var completed = progressTask.Result
            .Where(p => p.IsCompleted)
            .Select(p => p.Lesson)
            .ToHashSet();

        var unit = course.Units.FirstOrDefault(u => u.Lessons.Any(l => l.Id == _lessonId));
        if (unit is null) return UnitPlaylist.Empty;

        var rows = unit.Lessons
            .OrderBy(l => l.DisplayOrder)
            .Select((l, index) => new PlaylistRow
            {
                Id = l.Id,
                Index = index + 1,
                Title = l.Title,
                DurationMinutes = l.DurationMinutes,
                IsCompleted = completed.Contains(l.Id),
                IsCurrent = l.Id == _lessonId,
            })
            .ToList();

        return new UnitPlaylist
        {
            CourseName = course.Name,
            UnitName = unit.Name,
            Lessons = rows,
        };
    }
}

/// <summary>The unit rail beside the player.</summary>
public sealed record UnitPlaylist
{
    public required string CourseName { get; init; }
    public required string UnitName { get; init; }
    public required IReadOnlyList<PlaylistRow> Lessons { get; init; }

    public static UnitPlaylist Empty { get; } =
        new() { CourseName = "", UnitName = "", Lessons = Array.Empty<PlaylistRow>() };

    public int CompletedCount => Lessons.Count(l => l.IsCompleted);

    /// <summary>"٣ من ٥" in the rail's header.</summary>
    public string DoneLabel =>
        $"{UiText.ToArabicIndicDigits(CompletedCount.ToString())} من " +
        $"{UiText.ToArabicIndicDigits(Lessons.Count.ToString())}";

    public int Percent => Lessons.Count == 0
        ? 0
        : (int)Math.Round(CompletedCount * 100.0 / Lessons.Count);

    public double Fraction => Percent / 100.0;

    public string PercentLabel => UiText.ToArabicIndicDigits(Percent.ToString()) + "٪";
}

public sealed record PlaylistRow
{
    public required int Id { get; init; }
    public required int Index { get; init; }
    public required string Title { get; init; }
    public required int? DurationMinutes { get; init; }
    public required bool IsCompleted { get; init; }

    /// <summary>The lecture being watched. Carries the leading bar and the tint.</summary>
    public required bool IsCurrent { get; init; }

    public string IndexLabel => UiText.ToArabicIndicDigits(Index.ToString());

    public string DurationLabel => DurationMinutes is > 0
        ? UiText.Count(DurationMinutes.Value, "دقيقة", "دقيقتان", "دقائق")
        : "";
}

public enum ChoiceOutcome
{
    Unanswered,
    Correct,
    Wrong,
}
