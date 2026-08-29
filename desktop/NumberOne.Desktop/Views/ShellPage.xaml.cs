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
    private readonly HomeView _home;

    private CoursesView? _courses;

    public ShellPage(AuthService auth, StudentApi api, HomeView home)
    {
        InitializeComponent();

        _auth = auth;
        _api = api;
        _home = home;

        SidebarStudentName.Text = auth.CurrentUser?.WatermarkName ?? "";

        ShowHome();
    }

    /// <summary>Raised after the session is cleared, so the host can return to login.</summary>
    public event EventHandler? SignedOut;

    private void OnHomeClicked(object? sender, EventArgs e) => ShowHome();

    private void OnCoursesClicked(object? sender, EventArgs e) => ShowCourses();

    private void ShowHome()
    {
        ContentHost.Content = _home;

        // Sections start loading as the view is shown. Deliberately not awaited:
        // each renders as it lands, which is the whole point of them being
        // independent.
        _home.BeginLoad();
    }

    private void ShowCourses()
    {
        // Rebuilt on each visit so the table reflects progress made since the
        // last time it was open, rather than a stale snapshot.
        _courses = new CoursesView(new CoursesViewModel(_api));
        _courses.ViewModel.CourseOpened += (_, courseId) => ShowCourseDetail(courseId);

        ContentHost.Content = _courses;
        _courses.BeginLoad();
    }

    private void ShowCourseDetail(int courseId)
    {
        var detail = new CourseDetailView(new CourseDetailViewModel(_api, courseId));
        detail.BackRequested += (_, _) => ShowCourses();

        ContentHost.Content = detail;
        detail.BeginLoad();
    }

    private async void OnSignOutClicked(object? sender, EventArgs e)
    {
        SignOutButton.IsEnabled = false;

        try
        {
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
}
