using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NumberOne.Core.Models;
using NumberOne.Core.Services;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// The dashboard. Five unrelated endpoints, five independently-resolving
/// sections — the design is explicit that a slow notifications feed must not
/// hold up the stat row, and that a retry refetches only its own section.
///
/// On the stat captions: the design mocks up four of them, and only three have
/// anything behind them. "٤ نشطة هذا الأسبوع" and "+٥ هذا الأسبوع" come from
/// LessonProgress, which carries last_viewed and completed_at. "أقربها بعد
/// يومين" does not: exams.Exam has no opening or closing date at all — only a
/// duration — so nothing in the API can say when an exam is due. That caption
/// states what is true instead, and "+٦٪ عن الفصل السابق" is replaced by the
/// attempt count, because there are no terms in the schema to compare across.
/// Inventing either would put a number on the dashboard that no query could
/// reproduce.
/// </summary>
public sealed partial class HomeViewModel : ObservableObject
{
    private readonly StudentApi _api;
    private readonly AuthService _auth;

    public HomeViewModel(StudentApi api, AuthService auth)
    {
        _api = api;
        _auth = auth;

        Courses = new SectionState<List<Course>>(
            ct => _api.GetMyCoursesAsync(_auth.CurrentUser?.StudentProfile, ct),
            list => list.Count == 0);

        // Every exam, not just the unattempted ones: the table shows what is
        // still open, but the average needs the attempts that ride along on the
        // same payload, and fetching the list twice for that would be waste.
        Exams = new SectionState<List<ExamSummary>>(
            ct => _api.GetExamsAsync(ct),
            list => list.Count == 0);

        Notifications = new SectionState<List<Notification>>(
            async ct => (await _api.GetNotificationsAsync(1, ct).ConfigureAwait(true)).Results,
            list => list.Count == 0);

        LiveRooms = new SectionState<List<LiveRoom>>(
            ct => _api.GetLiveRoomsAsync(ct),
            list => list.SelectMany(r => r.Sessions).Any() is false);

        Progress = new SectionState<List<LessonProgress>>(
            ct => _api.GetMyProgressAsync(ct),
            _ => false); // the stat row renders zeroes rather than an empty state
    }

    // ── Sections ─────────────────────────────────────────────────────────────

    public SectionState<List<Course>> Courses { get; }
    public SectionState<List<ExamSummary>> Exams { get; }
    public SectionState<List<Notification>> Notifications { get; }
    public SectionState<List<LiveRoom>> LiveRooms { get; }
    public SectionState<List<LessonProgress>> Progress { get; }

    // ── Navigation out ───────────────────────────────────────────────────────

    public event EventHandler<int>? CourseOpened;
    public event EventHandler<int>? ExamStarted;
    public event EventHandler? ShowExamsRequested;
    public event EventHandler? ShowLiveRequested;
    public event EventHandler? ShowNotificationsRequested;
    public event EventHandler? ShowCoursesRequested;
    public event EventHandler? ShowResultsRequested;
    public event EventHandler? ShowProfileRequested;

    /// <summary>Opens a URL in the system browser; supplied by the host.</summary>
    public Func<string, Task<bool>> BrowserLauncher { get; set; } = _ => Task.FromResult(false);

    public event EventHandler<ToastMessage>? Toasted;

    [RelayCommand] private void OpenCourse(CourseProgress? p)
    { if (p is not null) CourseOpened?.Invoke(this, p.Course.Id); }

    [RelayCommand] private void StartExam(ExamSummary? e)
    { if (e is not null) ExamStarted?.Invoke(this, e.Id); }

    [RelayCommand] private void ShowExams() => ShowExamsRequested?.Invoke(this, EventArgs.Empty);
    [RelayCommand] private void ShowLive() => ShowLiveRequested?.Invoke(this, EventArgs.Empty);
    [RelayCommand] private void ShowNotifications() => ShowNotificationsRequested?.Invoke(this, EventArgs.Empty);
    [RelayCommand] private void ShowCourses() => ShowCoursesRequested?.Invoke(this, EventArgs.Empty);
    [RelayCommand] private void ShowResults() => ShowResultsRequested?.Invoke(this, EventArgs.Empty);
    [RelayCommand] private void ShowProfile() => ShowProfileRequested?.Invoke(this, EventArgs.Empty);

    // ── Header ───────────────────────────────────────────────────────────────

    public string StudentName => _auth.CurrentUser?.WatermarkName ?? "";

    /// <summary>"أحمد محمود سالم — الصف الثالث الثانوي".</summary>
    public string StudentTitle
    {
        get
        {
            var grade = _auth.CurrentUser?.StudentProfile?.EnrolledGradeName;
            return string.IsNullOrWhiteSpace(grade) ? StudentName : $"{StudentName} — {grade}";
        }
    }

    /// <summary>
    /// Remaining balance, shown in `warning`. Comes from the auth payload rather
    /// than the finance app: StudentFinancialFileView is IsAdminOrManager, so
    /// this string is the only part of the financial file a student can read.
    /// </summary>
    public string? RemainingBalance => _auth.CurrentUser?.StudentProfile?.Balance;

    public bool HasBalance =>
        !string.IsNullOrWhiteSpace(RemainingBalance) && RemainingBalance != "0.00";

    /// <summary>
    /// The figure with its unit. Sudanese pounds, not the design mock's د.ع —
    /// finance/models.py names the field balance_sdg.
    /// </summary>
    public string BalanceLabel =>
        UiText.ToArabicIndicDigits(RemainingBalance ?? "0") + " ج.س";

    /// <summary>عبر الإنترنت / بدون إنترنت (فلاش), mapped from the raw value.</summary>
    public string SystemTypeDisplay =>
        SystemTypes.Display(_auth.CurrentUser?.StudentProfile?.SystemType);

    // ── Stat row ─────────────────────────────────────────────────────────────

    private static DateTimeOffset WeekAgo => DateTimeOffset.Now.AddDays(-7);

    public int CourseCount => Courses.Value?.Count ?? 0;
    public string CourseCountLabel => Arabic(CourseCount);

    /// <summary>
    /// Courses touched in the last seven days, by last_viewed on any of their
    /// lessons. "Active" is genuinely about attention, not enrolment.
    /// </summary>
    public int ActiveThisWeek
    {
        get
        {
            if (Courses.Value is null || Progress.Value is null) return 0;

            var recent = Progress.Value
                .Where(p => p.LastViewed is { } seen && seen >= WeekAgo)
                .Select(p => p.Lesson)
                .ToHashSet();

            return Courses.Value.Count(c => c.AllLessons.Any(l => recent.Contains(l.Id)));
        }
    }

    public string ActiveThisWeekCaption =>
        ActiveThisWeek == 0 ? "لم تُفتح كورسات هذا الأسبوع"
                            : $"{Arabic(ActiveThisWeek)} نشطة هذا الأسبوع";

    public int LessonCount => Courses.Value?.Sum(c => c.LessonCount) ?? 0;

    public int CompletedLessonCount => Progress.Value?.Count(p => p.IsCompleted) ?? 0;
    public string CompletedLessonLabel => Arabic(CompletedLessonCount);

    /// <summary>Completed in the last seven days, by completed_at.</summary>
    public int CompletedThisWeek => Progress.Value?
        .Count(p => p.IsCompleted && p.CompletedAt is { } at && at >= WeekAgo) ?? 0;

    public string CompletedThisWeekCaption =>
        CompletedThisWeek == 0 ? "لا جديد هذا الأسبوع"
                               : $"+{Arabic(CompletedThisWeek)} هذا الأسبوع";

    /// <summary>True tints the caption success rather than secondary.</summary>
    public bool HasWeeklyGain => CompletedThisWeek > 0;

    /// <summary>
    /// Whole-percent completion across every lesson the student can see. Zero
    /// when there are no lessons rather than a division by zero.
    /// </summary>
    public int ProgressPercent =>
        LessonCount == 0 ? 0 : (int)Math.Round(CompletedLessonCount * 100.0 / LessonCount);

    /// <summary>Exams never attempted. What the design calls "القادمة".</summary>
    public IReadOnlyList<ExamSummary> UpcomingExams =>
        Exams.Value?.Where(e => !e.HasBeenAttempted).ToList() ?? new List<ExamSummary>();

    public int PendingExamCount => UpcomingExams.Count;
    public string PendingExamLabel => Arabic(PendingExamCount);
    public bool HasUpcomingExams => PendingExamCount > 0;

    /// <summary>
    /// An active exam has no schedule in the schema — no opens_at, no closes_at
    /// — so it is simply open. Saying so is the only caption the data supports.
    /// </summary>
    public string PendingExamCaption =>
        PendingExamCount == 0 ? "لا شيء في انتظارك" : "متاحة الآن";

    private IReadOnlyList<ExamAttemptSummary> AllAttempts =>
        Exams.Value?.SelectMany(e => e.Attempts).ToList() ?? new List<ExamAttemptSummary>();

    public int AveragePercent => AllAttempts is { Count: > 0 } a
        ? (int)Math.Round(a.Average(x => x.Percentage))
        : 0;

    public string AverageLabel => Arabic(AveragePercent) + "٪";

    /// <summary>"من ١٣ محاولة" — the base the average is over, not a trend.</summary>
    public string AverageCaption => AllAttempts.Count == 0
        ? "لم تُجرِ اختباراً بعد"
        : $"من {Arabic(AllAttempts.Count)} محاولة";

    // ── Live banner ──────────────────────────────────────────────────────────

    /// <summary>
    /// The session the banner shows: one that is live now, else the soonest
    /// upcoming one. Ended sessions never lead the banner.
    /// </summary>
    public LiveSession? BannerSession
    {
        get
        {
            var sessions = LiveRooms.Value?.SelectMany(r => r.Sessions).ToList();
            if (sessions is null || sessions.Count == 0) return null;

            return sessions.FirstOrDefault(s => s.Status == LiveStatuses.Live)
                ?? sessions
                    .Where(s => s.Status == LiveStatuses.Upcoming && s.ScheduledStart is not null)
                    .OrderBy(s => s.ScheduledStart)
                    .FirstOrDefault();
        }
    }

    private LiveRoom? BannerRoom => LiveRooms.Value?
        .FirstOrDefault(r => r.Sessions.Any(s => s.Id == BannerSession?.Id));

    public bool HasLiveBanner => BannerSession is not null;

    public bool IsLiveNow => BannerSession?.Status == LiveStatuses.Live;

    public string BannerTitle =>
        BannerSession is null ? "" : $"بث مباشر — {BannerSession.SessionName}";

    /// <summary>"قاعة الرياضيات ٢ · Zoom · ١٦:٠٠".</summary>
    public string BannerMeta
    {
        get
        {
            if (BannerSession is not { } s) return "";

            var parts = new List<string>();
            if (BannerRoom is { } room) parts.Add(room.RoomName);
            parts.Add(s.ProviderLabel);
            if (s.TimeLabel.Length > 0) parts.Add(s.TimeLabel);

            return string.Join(" · ", parts);
        }
    }

    /// <summary>
    /// "جارٍ الآن" or "يبدأ بعد ١٢ دقيقة", from scheduled_start. The design also
    /// shows a connected-student count beside it; nothing in live/ reports one,
    /// so it is left out rather than guessed at.
    /// </summary>
    public string BannerStatus
    {
        get
        {
            if (BannerSession is not { } s) return "";
            if (s.Status == LiveStatuses.Live) return "جارٍ الآن";
            if (s.ScheduledStart is not { } start) return LiveStatuses.Display(s.Status);

            var until = start - DateTimeOffset.Now;
            if (until <= TimeSpan.Zero) return "على وشك البدء";
            if (until < TimeSpan.FromHours(1))
                return $"يبدأ بعد {UiText.Count((int)Math.Ceiling(until.TotalMinutes), "دقيقة", "دقيقتان", "دقائق")}";
            if (until < TimeSpan.FromDays(1))
                return $"يبدأ بعد {UiText.Count((int)Math.Floor(until.TotalHours), "ساعة", "ساعتان", "ساعات")}";

            return $"يبدأ {UiText.FormatDate(start)}";
        }
    }

    /// <summary>The join control is live only while the session is.</summary>
    public bool CanJoinBanner => BannerSession?.CanJoin == true;

    [RelayCommand]
    private async Task JoinLiveAsync()
    {
        if (BannerSession is not { } session) return;

        if (string.IsNullOrWhiteSpace(session.StreamUrl) ||
            !Uri.TryCreate(session.StreamUrl, UriKind.Absolute, out var uri) ||
            uri.Scheme is not ("http" or "https"))
        {
            Toasted?.Invoke(this, new ToastMessage("رابط الجلسة غير صالح — راجع الإدارة", ToastKind.Error));
            return;
        }

        if (await BrowserLauncher(session.StreamUrl!).ConfigureAwait(true))
            Toasted?.Invoke(this, new ToastMessage($"جارٍ فتح {session.ProviderLabel} في المتصفح…"));
        else
            Toasted?.Invoke(this, new ToastMessage("تعذّر فتح المتصفح على هذا الجهاز", ToastKind.Error));
    }

    // ── Continue where you left off ──────────────────────────────────────────

    /// <summary>
    /// Courses with unfinished lessons, most-progressed first — the "تابع من حيث
    /// توقفت" grid. A fully finished course drops out rather than sitting at
    /// 100% taking up space.
    /// </summary>
    public IReadOnlyList<CourseProgress> ContinueLearning
    {
        get
        {
            if (Courses.Value is null) return Array.Empty<CourseProgress>();

            var completed = Progress.Value?
                .Where(p => p.IsCompleted)
                .Select(p => p.Lesson)
                .ToHashSet() ?? new HashSet<int>();

            return Courses.Value
                .Select(c =>
                {
                    var lessons = c.AllLessons.ToList();
                    var done = lessons.Count(l => completed.Contains(l.Id));
                    return new CourseProgress(c, done, lessons.Count);
                })
                .Where(p => p.Total > 0 && p.Completed < p.Total)
                .OrderByDescending(p => p.Percent)
                .ToList();
        }
    }

    public bool HasContinueLearning => ContinueLearning.Count > 0;

    /// <summary>The five most recent notifications; the screen has the rest.</summary>
    public IReadOnlyList<Notification> RecentNotifications =>
        Notifications.Value?.OrderByDescending(n => n.CreatedAt).Take(5).ToList()
        ?? new List<Notification>();

    // ── Loading ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Kicks off all five sections at once and does not wait for them together.
    /// Each renders as it lands, which is the whole point — awaiting them as a
    /// group would make the dashboard as slow as its slowest endpoint.
    /// </summary>
    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        await Task.WhenAll(
            Track(Courses.LoadAsync(ct), NotifyStats),
            Track(Progress.LoadAsync(ct), NotifyStats),
            Track(Exams.LoadAsync(ct), NotifyStats),
            Track(Notifications.LoadAsync(ct), NotifyNotifications),
            Track(LiveRooms.LoadAsync(ct), NotifyBanner)
        ).ConfigureAwait(true);
    }

    /// <summary>The reload control beside the balance. Refetches everything.</summary>
    [RelayCommand]
    public Task ReloadAsync(CancellationToken ct = default) => LoadAsync(ct);

    private static async Task Track(Task work, Action onDone)
    {
        await work.ConfigureAwait(true);
        onDone();
    }

    private static string Arabic(int value) => UiText.ToArabicIndicDigits(value.ToString());

    private void NotifyStats()
    {
        OnPropertyChanged(nameof(CourseCount));
        OnPropertyChanged(nameof(CourseCountLabel));
        OnPropertyChanged(nameof(ActiveThisWeek));
        OnPropertyChanged(nameof(ActiveThisWeekCaption));
        OnPropertyChanged(nameof(LessonCount));
        OnPropertyChanged(nameof(CompletedLessonCount));
        OnPropertyChanged(nameof(CompletedLessonLabel));
        OnPropertyChanged(nameof(CompletedThisWeek));
        OnPropertyChanged(nameof(CompletedThisWeekCaption));
        OnPropertyChanged(nameof(HasWeeklyGain));
        OnPropertyChanged(nameof(ProgressPercent));
        OnPropertyChanged(nameof(UpcomingExams));
        OnPropertyChanged(nameof(PendingExamCount));
        OnPropertyChanged(nameof(PendingExamLabel));
        OnPropertyChanged(nameof(PendingExamCaption));
        OnPropertyChanged(nameof(HasUpcomingExams));
        OnPropertyChanged(nameof(AveragePercent));
        OnPropertyChanged(nameof(AverageLabel));
        OnPropertyChanged(nameof(AverageCaption));
        OnPropertyChanged(nameof(ContinueLearning));
        OnPropertyChanged(nameof(HasContinueLearning));
    }

    private void NotifyNotifications() => OnPropertyChanged(nameof(RecentNotifications));

    private void NotifyBanner()
    {
        OnPropertyChanged(nameof(BannerSession));
        OnPropertyChanged(nameof(HasLiveBanner));
        OnPropertyChanged(nameof(IsLiveNow));
        OnPropertyChanged(nameof(BannerTitle));
        OnPropertyChanged(nameof(BannerMeta));
        OnPropertyChanged(nameof(BannerStatus));
        OnPropertyChanged(nameof(CanJoinBanner));
    }
}

/// <summary>A course with how far through it the student is.</summary>
public sealed record CourseProgress(Course Course, int Completed, int Total)
{
    public int Percent => Total == 0 ? 0 : (int)Math.Round(Completed * 100.0 / Total);

    public double Fraction => Percent / 100.0;

    public string PercentLabel => UiText.ToArabicIndicDigits(Percent.ToString()) + "٪";

    /// <summary>Falls back to a dash: an unassigned course is not an error.</summary>
    public string TeacherName =>
        string.IsNullOrWhiteSpace(Course.TeacherName) ? "—" : Course.TeacherName!;

    /// <summary>"٣ من ٨ محاضرات" — content digits are Arabic-Indic.</summary>
    public string ProgressLabel =>
        $"{UiText.ToArabicIndicDigits(Completed.ToString())} من " +
        $"{UiText.ToArabicIndicDigits(Total.ToString())} محاضرات";
}
