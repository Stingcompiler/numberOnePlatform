using NumberOne.Core.Abstractions;
using NumberOne.Core.Services;
using NumberOne.Core.ViewModels;

namespace NumberOne.Desktop.Views;

/// <summary>
/// The signed-in chrome. Hosts one content view at a time beside the sidebar.
///
/// Not a MAUI Shell: the design specifies its own 240px rail on the RTL leading
/// edge, and Shell would add flyout chrome we would then have to hide.
/// </summary>
public partial class ShellPage : ContentPage
{
    private readonly AuthService _auth;
    private readonly StudentApi _api;
    private readonly IWindowProtection _protection;
    private readonly HomeView _home;

    /// <summary>
    /// The view currently hosted, when it owns a timer. The lesson player and
    /// the exam runner both tick every second; leaving one running behind
    /// another screen would keep a watermark clock or an exam countdown alive
    /// after the student navigated away.
    /// </summary>
    private Action? _teardownCurrent;

    private IDispatcherTimer? _badgeTimer;

    public ShellPage(AuthService auth, StudentApi api, IWindowProtection protection, HomeView home)
    {
        InitializeComponent();

        _auth = auth;
        _api = api;
        _protection = protection;
        _home = home;

        SidebarStudentName.Text = auth.CurrentUser?.WatermarkName ?? "";
        OfflineLabel.Text = SessionViewModel.OfflineMessage;

        // Connectivity is polled by the platform, not inferred from a failed
        // request: a single 500 is not the same as being offline, and treating
        // it that way would hide real server errors behind a network bar.
        Connectivity.Current.ConnectivityChanged += OnConnectivityChanged;
        ApplyConnectivity(Connectivity.Current.NetworkAccess);

        SessionEvents.SessionExpired += OnSessionExpired;

        ShowHome();
        StartBadgePolling();
    }

    /// <summary>Raised after the session is cleared, so the host can return to login.</summary>
    public event EventHandler? SignedOut;

    // ── Navigation ───────────────────────────────────────────────────────────

    private void OnHomeClicked(object? sender, EventArgs e) => ShowHome();
    private void OnCoursesClicked(object? sender, EventArgs e) => ShowCourses();
    private void OnLiveClicked(object? sender, EventArgs e) => ShowLive();
    private void OnExamsClicked(object? sender, EventArgs e) => ShowExams();
    private void OnResultsClicked(object? sender, EventArgs e) => ShowResults();
    private void OnNotificationsClicked(object? sender, EventArgs e) => ShowNotifications();
    private void OnProfileClicked(object? sender, EventArgs e) => ShowProfile();

    /// <summary>
    /// Swaps the hosted view, tearing down whatever the previous one was
    /// running first.
    /// </summary>
    private void Host(View view, Action? teardown = null)
    {
        _teardownCurrent?.Invoke();
        _teardownCurrent = teardown;

        ContentHost.Content = view;
    }

    private void ShowHome()
    {
        Host(_home);

        // Sections start loading as the view is shown. Deliberately not awaited:
        // each renders as it lands, which is the whole point of them being
        // independent.
        _home.BeginLoad();
    }

    private void ShowCourses()
    {
        // Rebuilt on each visit so the table reflects progress made since the
        // last time it was open, rather than a stale snapshot.
        var courses = new CoursesView(new CoursesViewModel(_api));
        courses.ViewModel.CourseOpened += (_, courseId) => ShowCourseDetail(courseId);

        Host(courses);
        courses.BeginLoad();
    }

    private void ShowCourseDetail(int courseId)
    {
        var detail = new CourseDetailView(new CourseDetailViewModel(_api, courseId));
        detail.BackRequested += (_, _) => ShowCourses();
        detail.ViewModel.LessonOpened += (_, lessonId) => ShowLesson(lessonId, courseId);

        Host(detail);
        detail.BeginLoad();
    }

    private void ShowLesson(int lessonId, int courseId)
    {
        var lesson = new LessonView(
            new LessonViewModel(_api, _auth, lessonId), _protection);

        lesson.BackRequested += (_, _) => ShowCourseDetail(courseId);

        // Teardown stops the watermark clock when the student leaves.
        Host(lesson, lesson.Teardown);
        lesson.BeginLoad();
    }

    private void ShowExams()
    {
        var exams = new ExamsView(new ExamsViewModel(_api));
        exams.ViewModel.ExamStarted += (_, examId) => ShowExamRunner(examId);

        Host(exams);
        exams.BeginLoad();
    }

    private void ShowExamRunner(int examId)
    {
        var runner = new ExamRunnerView(new ExamRunnerViewModel(_api, examId));

        // Both exits land back on the exams list. "حفظ والخروج" keeps nothing
        // server-side — there is no server attempt to save — so it is honestly
        // just leaving, and the student is told as much by the exams screen.
        runner.ViewModel.Finished += (_, _) => ShowExams();
        runner.ViewModel.SavedAndExited += (_, _) => ShowExams();

        // Teardown stops the countdown when the student leaves.
        Host(runner, runner.Teardown);
        runner.BeginLoad();
    }

    private void ShowResults()
    {
        var results = new ResultsView(new ResultsViewModel(_api));
        results.ViewModel.AttemptOpened += (_, attemptId) => ShowAttemptDetail(attemptId);

        Host(results);
        results.BeginLoad();
    }

    private void ShowAttemptDetail(int attemptId)
    {
        var detail = new AttemptDetailView(new AttemptDetailViewModel(_api, attemptId));
        detail.ViewModel.BackRequested += (_, _) => ShowResults();

        Host(detail);
        detail.BeginLoad();
    }

    private void ShowNotifications()
    {
        var notifications = new NotificationsView(new NotificationsViewModel(_api));

        Host(notifications);
        notifications.BeginLoad();
    }

    private void ShowLive()
    {
        var live = new LiveView(new LiveViewModel(_api));

        Host(live);
        live.BeginLoad();
    }

    private void ShowProfile() => Host(new ProfileView(new ProfileViewModel(_auth)));

    // ── Cross-cutting interrupts ─────────────────────────────────────────────

    private void OnConnectivityChanged(object? sender, ConnectivityChangedEventArgs e)
        => MainThread.BeginInvokeOnMainThread(() => ApplyConnectivity(e.NetworkAccess));

    private void ApplyConnectivity(NetworkAccess access)
        => OfflineBar.IsVisible = access != NetworkAccess.Internet;

    private void OnReconnectClicked(object? sender, EventArgs e)
    {
        ApplyConnectivity(Connectivity.Current.NetworkAccess);

        // Re-running the current screen is the useful half of "reconnect":
        // there is nothing to dial, only work to retry.
        ShowHome();
    }

    private void OnSessionExpired(object? sender, EventArgs e)
        => MainThread.BeginInvokeOnMainThread(() => SessionExpiredScrim.IsVisible = true);

    /// <summary>
    /// Both dialog buttons end the same way. The design has the primary return
    /// the student to the page they were on, but the tokens are already cleared
    /// by the time this fires, so there is no session to resume with — sending
    /// them to login is the only honest option until a re-auth flow exists.
    /// </summary>
    private void OnSessionExpiredContinue(object? sender, EventArgs e)
    {
        SessionExpiredScrim.IsVisible = false;

        _teardownCurrent?.Invoke();
        _teardownCurrent = null;

        SignedOut?.Invoke(this, EventArgs.Empty);
    }

    // ── Notification badge ───────────────────────────────────────────────────

    /// <summary>
    /// Polls the unread count. There is no push channel on desktop -- the
    /// mobile app uses Expo, and /notifications/register-token/ stores Expo
    /// tokens only -- so polling is the whole mechanism.
    /// </summary>
    private void StartBadgePolling()
    {
        _badgeTimer = Dispatcher.CreateTimer();

        // A minute is frequent enough for a school notification and slow enough
        // that a classroom of clients is not hammering a 512MB Render instance.
        _badgeTimer.Interval = TimeSpan.FromMinutes(1);
        _badgeTimer.Tick += async (_, _) => await RefreshBadgeAsync();
        _badgeTimer.Start();

        _ = RefreshBadgeAsync();
    }

    private async Task RefreshBadgeAsync()
    {
        try
        {
            var count = await _api.GetUnreadCountAsync();

            NotificationBadge.Text = count switch
            {
                <= 0 => "",
                > 99 => "٩٩+",
                _ => UiText.ToArabicIndicDigits(count.ToString()),
            };
            NotificationBadge.IsVisible = count > 0;
        }
        catch (Exception)
        {
            // Leave the previous count showing rather than flashing to zero on
            // one failed poll.
        }
    }

    private async void OnSignOutClicked(object? sender, EventArgs e)
    {
        SignOutButton.IsEnabled = false;

        try
        {
            Teardown();

            // Clears local tokens even when the server is unreachable — a failed
            // logout call must never leave a session on a shared machine.
            await _auth.SignOutAsync();
            SignedOut?.Invoke(this, EventArgs.Empty);
        }
        finally
        {
            SignOutButton.IsEnabled = true;
        }
    }

    /// <summary>Stops everything this page owns. Called on sign-out and expiry.</summary>
    private void Teardown()
    {
        _teardownCurrent?.Invoke();
        _teardownCurrent = null;

        if (_badgeTimer is not null)
        {
            _badgeTimer.Stop();
            _badgeTimer = null;
        }

        Connectivity.Current.ConnectivityChanged -= OnConnectivityChanged;
        SessionEvents.SessionExpired -= OnSessionExpired;
    }
}
