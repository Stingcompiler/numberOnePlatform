using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NumberOne.Core.Models;
using NumberOne.Core.Services;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// The dashboard. Four unrelated endpoints, four independently-resolving
/// sections — the design is explicit that a slow notifications feed must not
/// hold up the stat row, and that a retry refetches only its own section.
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
            ct => _api.GetMyCoursesAsync(ct),
            list => list.Count == 0);

        Exams = new SectionState<List<ExamSummary>>(
            async ct => (await _api.GetExamsAsync(ct).ConfigureAwait(true))
                .Where(e => !e.HasBeenAttempted)
                .ToList(),
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

    // ── Header ───────────────────────────────────────────────────────────────

    public string StudentName => _auth.CurrentUser?.WatermarkName ?? "";

    /// <summary>
    /// Remaining balance, shown in `warning`. Comes from the auth payload rather
    /// than the finance app: StudentFinancialFileView is IsAdminOrManager, so
    /// this string is the only part of the financial file a student can read.
    /// </summary>
    public string? RemainingBalance => _auth.CurrentUser?.StudentProfile?.Balance;

    public bool HasBalance =>
        !string.IsNullOrWhiteSpace(RemainingBalance) && RemainingBalance != "0.00";

    /// <summary>عبر الإنترنت / بدون إنترنت (فلاش), mapped from the raw value.</summary>
    public string SystemTypeDisplay =>
        SystemTypes.Display(_auth.CurrentUser?.StudentProfile?.SystemType);

    // ── Stat row ─────────────────────────────────────────────────────────────

    public int CourseCount => Courses.Value?.Count ?? 0;

    public int LessonCount => Courses.Value?.Sum(c => c.AllLessons.Count()) ?? 0;

    public int CompletedLessonCount => Progress.Value?.Count(p => p.IsCompleted) ?? 0;

    /// <summary>
    /// Whole-percent completion across every lesson the student can see. Zero
    /// when there are no lessons rather than a division by zero.
    /// </summary>
    public int ProgressPercent =>
        LessonCount == 0 ? 0 : (int)Math.Round(CompletedLessonCount * 100.0 / LessonCount);

    public int PendingExamCount => Exams.Value?.Count ?? 0;

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

    public bool HasLiveBanner => BannerSession is not null;

    public bool IsLiveNow => BannerSession?.Status == LiveStatuses.Live;

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
            Track(Notifications.LoadAsync(ct), () => { }),
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

    private void NotifyStats()
    {
        OnPropertyChanged(nameof(CourseCount));
        OnPropertyChanged(nameof(LessonCount));
        OnPropertyChanged(nameof(CompletedLessonCount));
        OnPropertyChanged(nameof(ProgressPercent));
        OnPropertyChanged(nameof(PendingExamCount));
        OnPropertyChanged(nameof(ContinueLearning));
    }

    private void NotifyBanner()
    {
        OnPropertyChanged(nameof(BannerSession));
        OnPropertyChanged(nameof(HasLiveBanner));
        OnPropertyChanged(nameof(IsLiveNow));
    }
}

/// <summary>A course with how far through it the student is.</summary>
public sealed record CourseProgress(Course Course, int Completed, int Total)
{
    public int Percent => Total == 0 ? 0 : (int)Math.Round(Completed * 100.0 / Total);

    /// <summary>"٣ من ٨ محاضرات" — content digits are Arabic-Indic.</summary>
    public string ProgressLabel =>
        $"{UiText.ToArabicIndicDigits(Completed.ToString())} من " +
        $"{UiText.ToArabicIndicDigits(Total.ToString())} محاضرات";
}
