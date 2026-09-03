using NumberOne.Core.Abstractions;
using NumberOne.Core.Services;
using NumberOne.Core.ViewModels;

namespace NumberOne.Desktop.Views;

/// <summary>
/// The signed-in chrome. Hosts one content view at a time beside the sidebar,
/// under a 48px top bar.
///
/// Not a MAUI Shell: the design specifies its own rail on the RTL leading edge,
/// and Shell would add flyout chrome we would then have to hide.
/// </summary>
public partial class ShellPage : ContentPage
{
    private readonly AuthService _auth;
    private readonly StudentApi _api;
    private readonly IWindowProtection _protection;
    private readonly IDeviceIdentityProvider _device;
    private readonly HomeView _home;

    /// <summary>
    /// The view currently hosted, when it owns a timer. The lesson player and
    /// the exam runner both tick every second; leaving one running behind
    /// another screen would keep a watermark clock or an exam countdown alive
    /// after the student navigated away.
    /// </summary>
    private Action? _teardownCurrent;

    /// <summary>
    /// What the back button does, or null on a root route. The design shows the
    /// button only where there is somewhere to return to.
    /// </summary>
    private Action? _goBack;

    /// <summary>
    /// The hosted view's search sink, when it has a list worth filtering. Null
    /// hides the field rather than leaving a box that does nothing.
    /// </summary>
    private ISearchable? _searchTarget;

    private IDispatcherTimer? _badgeTimer;
    private IDispatcherTimer? _toastTimer;

    private Route _route = Route.Home;
    private bool _railExpanded = true;

    /// <summary>The routes the sidebar can mark as current.</summary>
    private enum Route { Home, Courses, Live, Exams, Results, Notifications, Profile }

    public ShellPage(
        AuthService auth,
        StudentApi api,
        IWindowProtection protection,
        IDeviceIdentityProvider device,
        HomeView home)
    {
        InitializeComponent();

        _auth = auth;
        _api = api;
        _protection = protection;
        _device = device;
        _home = home;

        var user = auth.CurrentUser;
        SidebarStudentName.Text = user?.WatermarkName ?? "";
        SidebarStudentGrade.Text = user?.StudentProfile?.EnrolledGradeName
                                   ?? Core.Models.SystemTypes.Display(user?.StudentProfile?.SystemType);
        SidebarInitial.Text = FirstLetter(user?.WatermarkName);

        // The machine name, not the id: the chip is orientation, and the id is
        // long, opaque, and belongs on the profile screen where it can be copied.
        DeviceTypeLabel.Text = SafeDeviceType();

        OfflineLabel.Text = SessionViewModel.OfflineMessage;

        ApplyStoredTheme();

        // The dashboard's cross-links and row actions are navigation, which
        // belongs to the host. Wired once: HomeView is a singleton instance
        // reused across visits, unlike the screens rebuilt in Show*.
        _home.ViewModel.ShowExamsRequested += (_, _) => ShowExams();
        _home.ViewModel.ShowLiveRequested += (_, _) => ShowLive();
        _home.ViewModel.ShowNotificationsRequested += (_, _) => ShowNotifications();
        _home.ViewModel.ShowCoursesRequested += (_, _) => ShowCourses();
        _home.ViewModel.ShowResultsRequested += (_, _) => ShowResults();
        _home.ViewModel.ShowProfileRequested += (_, _) => ShowProfile();
        _home.ViewModel.CourseOpened += (_, courseId) => ShowCourseDetail(courseId);
        _home.ViewModel.ExamStarted += (_, examId) => ShowExamRunner(examId);
        _home.ViewModel.Toasted += (_, message) => ShowToast(message.Text, message.Kind);

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

    private static string FirstLetter(string? name) =>
        string.IsNullOrWhiteSpace(name) ? "؟" : name.Trim()[..1];

    /// <summary>
    /// The device type, or a dash. A provider that cannot read the hardware
    /// throws; the chip is decoration and must never take the app down with it.
    /// </summary>
    private string SafeDeviceType()
    {
        try { return _device.GetDeviceType(); }
        catch (Exception) { return "—"; }
    }

    // ── Navigation ───────────────────────────────────────────────────────────

    private void OnHomeClicked(object? sender, EventArgs e) => ShowHome();
    private void OnCoursesClicked(object? sender, EventArgs e) => ShowCourses();
    private void OnLiveClicked(object? sender, EventArgs e) => ShowLive();
    private void OnExamsClicked(object? sender, EventArgs e) => ShowExams();
    private void OnResultsClicked(object? sender, EventArgs e) => ShowResults();
    private void OnNotificationsClicked(object? sender, EventArgs e) => ShowNotifications();
    private void OnProfileClicked(object? sender, EventArgs e) => ShowProfile();

    private void OnBackClicked(object? sender, EventArgs e) => _goBack?.Invoke();

    /// <summary>
    /// Swaps the hosted view, tearing down whatever the previous one was
    /// running first, and resets the chrome that belongs to a route: the title,
    /// the count, the back button and the search field.
    /// </summary>
    private void Host(
        View view,
        Route route,
        string title,
        Action? teardown = null,
        Action? back = null,
        ISearchable? search = null)
    {
        _teardownCurrent?.Invoke();
        _teardownCurrent = teardown;

        // Leaving a lecture that was expanded must not take the nav with it.
        ApplyChromeVisibility(true);

        _route = route;
        _goBack = back;
        _searchTarget = search;

        ContentHost.Content = view;

        PageTitle.Text = title;
        PageCount.Text = "";
        BackButton.IsVisible = back is not null;

        SearchField.IsVisible = search is not null;
        if (search is not null)
        {
            SearchEntry.Text = "";
            SearchEntry.Placeholder = search.SearchPlaceholder;
        }

        ApplyRouteHighlight();
    }

    /// <summary>
    /// The count beside the title. Screens call this once their rows land,
    /// because a count printed before the data arrives would read as zero.
    /// </summary>
    private void SetCount(string text) => PageCount.Text = text;

    /// <summary>
    /// Hides the sidebar and top bar so a fullscreen lecture is the only thing
    /// on screen, and restores them after.
    ///
    /// Always restored on navigation: leaving the lecture while it is expanded
    /// would otherwise strand the student in a window with no nav and no way
    /// back, which is the failure mode that makes a fullscreen toggle dangerous
    /// rather than merely broken.
    /// </summary>
    private void ApplyChromeVisibility(bool visible)
    {
        Sidebar.IsVisible = visible;
        TopBar.IsVisible = visible;

        // The row is fixed at 48, so hiding the bar without collapsing it would
        // leave a dead band above the picture.
        TopBarRow.Height = visible ? new GridLength(48) : new GridLength(0);
    }

    private void ShowHome()
    {
        Host(_home, Route.Home, "الرئيسية");

        // Sections start loading as the view is shown. Deliberately not awaited:
        // each renders as it lands, which is the whole point of them being
        // independent.
        _home.BeginLoad();
    }

    private void ShowCourses()
    {
        // Rebuilt on each visit so the table reflects progress made since the
        // last time it was open, rather than a stale snapshot.
        var courses = new CoursesView(new CoursesViewModel(_api, _auth));
        courses.ViewModel.CourseOpened += (_, courseId) => ShowCourseDetail(courseId);
        courses.ViewModel.CountChanged += (_, label) => SetCount(label);

        Host(courses, Route.Courses, "الكورسات", search: courses.ViewModel);
        courses.BeginLoad();
    }

    private void ShowCourseDetail(int courseId)
    {
        var detail = new CourseDetailView(new CourseDetailViewModel(_api, _auth, courseId));
        detail.ViewModel.LessonOpened += (_, lessonId) => ShowLesson(lessonId, courseId);

        Host(detail, Route.Courses, "الكورس", back: ShowCourses);
        detail.BeginLoad();
    }

    private void ShowLesson(int lessonId, int courseId)
    {
        var lesson = new LessonView(
            new LessonViewModel(_api, _auth, MauiProgram.ApiBaseAddress, lessonId, courseId),
            _protection);

        // Picking another lecture out of the unit rail rebuilds the screen
        // rather than swapping the source: the watermark clock, the exercise
        // state and the playlist selection all belong to one lecture.
        lesson.ViewModel.LessonPicked += (_, nextLessonId) => ShowLesson(nextLessonId, courseId);
        lesson.ViewModel.Toasted += (_, message) => ShowToast(message.Text, message.Kind);

        // Fullscreen means the lecture and nothing else, so the chrome goes
        // too. It belongs to this page, which is why the lecture screen asks
        // rather than doing it itself.
        lesson.FullscreenChanged += (_, on) => ApplyChromeVisibility(!on);

        // Teardown stops the watermark clock when the student leaves.
        Host(lesson, Route.Courses, "المحاضرة",
             teardown: lesson.Teardown, back: () => ShowCourseDetail(courseId));

        lesson.BeginLoad();
    }

    private void ShowExams()
    {
        var exams = new ExamsView(new ExamsViewModel(_api));
        exams.ViewModel.ExamStarted += (_, examId) => ShowExamRunner(examId);
        exams.ViewModel.CountChanged += (_, label) => SetCount(label);

        Host(exams, Route.Exams, "الإختبارات والإمتحانات", search: exams.ViewModel);
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

        // No back button: leaving an exam is a decision, and the runner's own
        // "حفظ والخروج" is where it is made.
        Host(runner, Route.Exams, "الاختبار", teardown: runner.Teardown);
        runner.BeginLoad();
    }

    private void ShowResults()
    {
        var results = new ResultsView(new ResultsViewModel(_api));
        results.ViewModel.AttemptOpened += (_, attemptId) => ShowAttemptDetail(attemptId);
        results.ViewModel.CountChanged += (_, label) => SetCount(label);

        Host(results, Route.Results, "النتائج", search: results.ViewModel);
        results.BeginLoad();
    }

    private void ShowAttemptDetail(int attemptId)
    {
        var detail = new AttemptDetailView(new AttemptDetailViewModel(_api, attemptId));

        Host(detail, Route.Results, "تفاصيل المحاولة", back: ShowResults);
        detail.BeginLoad();
    }

    private void ShowNotifications()
    {
        var notifications = new NotificationsView(new NotificationsViewModel(_api));

        // Reading the list is what clears the badge, so refresh it on the way
        // out of the screen as well as on the timer.
        notifications.ViewModel.CountChanged += (_, label) => SetCount(label);
        notifications.ViewModel.ReadStateChanged += async (_, _) => await RefreshBadgeAsync();

        Host(notifications, Route.Notifications, "الإشعارات");
        notifications.BeginLoad();
    }

    private void ShowLive()
    {
        var live = new LiveView(new LiveViewModel(_api));
        live.ViewModel.CountChanged += (_, label) => SetCount(label);
        live.ViewModel.Toasted += (_, message) => ShowToast(message.Text, message.Kind);

        Host(live, Route.Live, "البث المباشر");
        live.BeginLoad();
    }

    private void ShowProfile()
    {
        var profile = new ProfileView(new ProfileViewModel(_auth));
        profile.ViewModel.Toasted += (_, message) => ShowToast(message.Text, message.Kind);

        Host(profile, Route.Profile, "حسابي");
    }

    // ── Sidebar state ────────────────────────────────────────────────────────

    /// <summary>
    /// Paints the current route. A row is marked three ways at once — tinted
    /// background, ink, and the 2px bar on the leading edge — because the tint
    /// alone is too faint to survive a bright classroom projector.
    /// </summary>
    private void ApplyRouteHighlight()
    {
        Mark(Route.Home, NavHomeBg, NavHomeBar, NavHomeIcon, NavHomeLabel);
        Mark(Route.Courses, NavCoursesBg, NavCoursesBar, NavCoursesIcon, NavCoursesLabel);
        Mark(Route.Live, NavLiveBg, NavLiveBar, NavLiveIcon, NavLiveLabel);
        Mark(Route.Exams, NavExamsBg, NavExamsBar, NavExamsIcon, NavExamsLabel);
        Mark(Route.Results, NavResultsBg, NavResultsBar, NavResultsIcon, NavResultsLabel);
        Mark(Route.Notifications, NavNotificationsBg, NavNotificationsBar,
             NavNotificationsIcon, NavNotificationsLabel);
        Mark(Route.Profile, NavProfileBg, NavProfileBar, NavProfileIcon, NavProfileLabel);
    }

    private void Mark(
        Route route, Border background, BoxView bar,
        Microsoft.Maui.Controls.Shapes.Path icon, Label label)
    {
        var current = _route == route;

        background.BackgroundColor = current ? Themed("Active") : Colors.Transparent;
        bar.IsVisible = current;

        var ink = current ? Themed("Text") : Themed("TextSecondary");
        icon.Stroke = ink;
        label.TextColor = ink;

        // The design's active row is 500, not bold. FontAttributes could only
        // ask for bold, which MAUI would synthesise over the 400 outline — a
        // heavier, blurrier stroke than the medium face this swaps in.
        label.FontFamily = Fonts.Resolve(current ? "FontUiMedium" : "FontUi");
    }

    /// <summary>
    /// Resolves a Light/Dark token pair for the theme in force. The XAML side
    /// uses AppThemeBinding; code-behind cannot, so the pair is looked up by
    /// name and the half matching the current theme is returned.
    /// </summary>
    private Color Themed(string token)
    {
        var suffix = Application.Current?.RequestedTheme == AppTheme.Dark ? "Dark" : "Light";

        return Resources.TryGetValue(token + suffix, out var value) ||
               Application.Current?.Resources.TryGetValue(token + suffix, out value) == true
            ? (Color)value!
            : Colors.Transparent;
    }

    /// <summary>
    /// Collapses the rail to icons. Every label hides, the brand text and the
    /// student's identity go with them, and the unread count becomes a dot —
    /// a two-digit number has nowhere to sit in 56px.
    /// </summary>
    private void OnRailToggleClicked(object? sender, EventArgs e)
    {
        _railExpanded = !_railExpanded;

        Sidebar.WidthRequest = _railExpanded ? 240 : 56;

        BrandText.IsVisible = _railExpanded;
        NavGroupLabel.IsVisible = _railExpanded;
        SidebarIdentity.IsVisible = _railExpanded;
        ThemeToggle.IsVisible = _railExpanded;

        NavHomeLabel.IsVisible = _railExpanded;
        NavCoursesLabel.IsVisible = _railExpanded;
        NavLiveLabel.IsVisible = _railExpanded;
        NavExamsLabel.IsVisible = _railExpanded;
        NavResultsLabel.IsVisible = _railExpanded;
        NavNotificationsLabel.IsVisible = _railExpanded;
        NavProfileLabel.IsVisible = _railExpanded;
        NavSignOutLabel.IsVisible = _railExpanded;

        ApplyBadgeVisibility();
    }

    // ── Theme ────────────────────────────────────────────────────────────────

    private void OnLightThemeClicked(object? sender, EventArgs e) => SetTheme(AppTheme.Light);
    private void OnDarkThemeClicked(object? sender, EventArgs e) => SetTheme(AppTheme.Dark);

    private void ApplyStoredTheme()
    {
        var stored = Preferences.Default.Get(App.ThemePreferenceKey, "");

        // Light is the default, and it is pinned rather than inherited.
        //
        // Following the OS looked reasonable and was wrong here: school and lab
        // machines are frequently left on the Windows dark default, so a student
        // who had never touched the setting would open a dark app — while every
        // printed handout, the web dashboard and the design itself are light.
        // Dark is a choice this app offers, not one the machine makes for it.
        var theme = stored switch
        {
            "dark" => AppTheme.Dark,
            _ => AppTheme.Light,
        };

        if (Application.Current is not null)
            Application.Current.UserAppTheme = theme;

        PaintThemeToggle(theme);
    }

    private void SetTheme(AppTheme theme)
    {
        if (Application.Current is not null)
            Application.Current.UserAppTheme = theme;

        Preferences.Default.Set(App.ThemePreferenceKey, theme == AppTheme.Dark ? "dark" : "light");

        PaintThemeToggle(theme);

        // The nav highlight is painted in code, so it does not follow the
        // theme on its own the way an AppThemeBinding would.
        ApplyRouteHighlight();
    }

    private void PaintThemeToggle(AppTheme theme)
    {
        var dark = theme == AppTheme.Dark;

        ThemeLightCell.BackgroundColor = dark ? Colors.Transparent : Themed("Hover");
        ThemeDarkCell.BackgroundColor = dark ? Themed("Hover") : Colors.Transparent;

        ThemeLightIcon.Stroke = dark ? Themed("TextMuted") : Themed("Text");
        ThemeDarkIcon.Stroke = dark ? Themed("Text") : Themed("TextMuted");
    }

    // ── Search ───────────────────────────────────────────────────────────────

    private void OnSearchChanged(object? sender, TextChangedEventArgs e)
        => _searchTarget?.ApplySearch(e.NewTextValue ?? "");

    // ── Toast ────────────────────────────────────────────────────────────────

    /// <summary>
    /// A transient message for an outcome with no screen of its own — a copied
    /// device id, a session opening in the browser, a link the server never
    /// filled in.
    /// </summary>
    private void ShowToast(string text, ToastKind kind)
    {
        ToastLabel.Text = text;
        ToastDot.Fill = new SolidColorBrush(kind switch
        {
            ToastKind.Error => Themed("Danger"),
            ToastKind.Warning => Themed("Warning"),
            _ => Themed("Success"),
        });

        Toast.IsVisible = true;

        _toastTimer?.Stop();
        _toastTimer = Dispatcher.CreateTimer();
        _toastTimer.Interval = TimeSpan.FromSeconds(4);
        _toastTimer.Tick += (_, _) =>
        {
            Toast.IsVisible = false;
            _toastTimer?.Stop();
            _toastTimer = null;
        };
        _toastTimer.Start();
    }

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

    private int _unread;

    private async Task RefreshBadgeAsync()
    {
        try
        {
            _unread = await _api.GetUnreadCountAsync();

            var label = _unread switch
            {
                <= 0 => "",
                > 99 => "٩٩+",
                _ => UiText.ToArabicIndicDigits(_unread.ToString()),
            };

            NotificationBadge.Text = label;
            TopBarBellCount.Text = label;

            ApplyBadgeVisibility();
        }
        catch (Exception)
        {
            // Leave the previous count showing rather than flashing to zero on
            // one failed poll.
        }
    }

    private void ApplyBadgeVisibility()
    {
        var has = _unread > 0;

        NotificationBadge.IsVisible = has && _railExpanded;
        NotificationDot.IsVisible = has && !_railExpanded;
        TopBarBellBadge.IsVisible = has;
    }

    private async void OnSignOutClicked(object? sender, EventArgs e)
    {
        NavSignOut.IsEnabled = false;

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
            NavSignOut.IsEnabled = true;
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

        _toastTimer?.Stop();
        _toastTimer = null;

        Connectivity.Current.ConnectivityChanged -= OnConnectivityChanged;
        SessionEvents.SessionExpired -= OnSessionExpired;
    }
}
