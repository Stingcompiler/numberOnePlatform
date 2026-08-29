using NumberOne.Core.Abstractions;
using NumberOne.Core.Api;
using NumberOne.Core.Services;
using NumberOne.Core.ViewModels;

namespace NumberOne.Core.Tests;

/// <summary>
/// The view models against a real Django, with real seeded content.
///
/// These exist because "the screen is empty" has two very different causes —
/// a view model that fails to project real data, or a server with nothing to
/// show — and only a test wired to a live server with known content can tell
/// them apart. The hermetic tests prove the projection against JSON I wrote;
/// these prove it against JSON Django wrote.
///
/// Needs desktop/tools/seed_desktop_fixtures.py. Skipped unless
/// NUMBERONE_TEST_API is set. Never point at production.
/// </summary>
public class LiveViewModelTests
{
    private const string SkipReason =
        "NUMBERONE_TEST_API is not set - see LiveApiTests for how to run these.";

    private static Uri? BaseAddress
    {
        get
        {
            var url = Environment.GetEnvironmentVariable("NUMBERONE_TEST_API");
            return string.IsNullOrWhiteSpace(url) ? null : new Uri(url);
        }
    }

    private static async Task<(StudentApi Api, AuthService Auth, HttpClient Client)> SignedInAsync()
    {
        var baseAddress = BaseAddress!;
        var tokens = new Tokens();
        var (client, _) = ApiClientFactory.Create(baseAddress, tokens, new RefreshEndpoint(baseAddress));

        var auth = new AuthService(client, tokens, new Device());
        Assert.IsType<LoginOutcome.Success>(await auth.SignInAsync("fresh.student", "pass1234"));

        return (new StudentApi(client), auth, client);
    }

    [SkippableFact]
    public async Task The_courses_table_projects_real_server_data_into_rows()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, auth, client) = await SignedInAsync();
        using var _c = client;

        var vm = new CoursesViewModel(api, auth);
        await vm.LoadAsync();

        // The distinction that matters: Data, not Empty. An empty table with a
        // healthy server means the student has no StudentCourseAccess rows.
        Assert.True(vm.Courses.HasData,
            $"Expected rows; state was {vm.Courses.Status}, error: {vm.Courses.ErrorMessage}");

        var row = Assert.Single(vm.Courses.Value!);
        Assert.Equal("الرياضيات", row.Name);
        Assert.Equal(2, row.LessonCount);
        Assert.Equal("عبر الإنترنت", row.SystemTypeDisplay);
    }

    [SkippableFact]
    public async Task The_dashboard_sections_all_reach_data_against_a_real_server()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, auth, client) = await SignedInAsync();
        using var _c = client;

        var vm = new HomeViewModel(api, auth);
        await vm.LoadAsync();

        Assert.True(vm.Courses.HasData, $"courses: {vm.Courses.Status} {vm.Courses.ErrorMessage}");
        Assert.True(vm.LiveRooms.HasData, $"live: {vm.LiveRooms.Status} {vm.LiveRooms.ErrorMessage}");
        Assert.True(vm.Notifications.HasData, $"notifications: {vm.Notifications.Status} {vm.Notifications.ErrorMessage}");

        Assert.Equal(1, vm.CourseCount);
        Assert.Equal(2, vm.LessonCount);
    }

    [SkippableFact]
    public async Task The_live_screen_projects_real_rooms_and_sessions()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, _, client) = await SignedInAsync();
        using var _c = client;

        var vm = new LiveViewModel(api);
        await vm.LoadAsync();

        Assert.True(vm.Rooms.HasData, $"live: {vm.Rooms.Status} {vm.Rooms.ErrorMessage}");

        var room = Assert.Single(vm.Rooms.Value!);
        Assert.Equal(3, room.Sessions.Count);
    }

    [SkippableFact]
    public async Task The_course_detail_projects_real_units_and_lessons()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, auth, client) = await SignedInAsync();
        using var _c = client;

        var courses = new CoursesViewModel(api, auth);
        await courses.LoadAsync();

        var vm = new CourseDetailViewModel(api, auth, courses.Courses.Value![0].Id);
        await vm.LoadAsync();

        Assert.True(vm.Course.HasData, $"detail: {vm.Course.Status} {vm.Course.ErrorMessage}");
        Assert.Single(vm.Course.Value!.Units);
        Assert.Equal(2, vm.Course.Value.LessonCount);
    }

    [SkippableFact]
    public async Task The_exams_screen_projects_real_exams()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, _, client) = await SignedInAsync();
        using var _c = client;

        var vm = new ExamsViewModel(api);
        await vm.LoadAsync();

        Assert.True(vm.Exams.HasData, $"exams: {vm.Exams.Status} {vm.Exams.ErrorMessage}");
        Assert.NotEmpty(vm.Exams.Value!);
    }

    [SkippableFact]
    public async Task The_lesson_player_gets_a_real_embed_url()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, auth, client) = await SignedInAsync();
        using var _c = client;

        var courses = await api.GetMyCoursesAsync();
        var lessonId = courses[0].AllLessons.First().Id;

        var vm = new LessonViewModel(api, auth, lessonId);
        await vm.LoadAsync();

        Assert.True(vm.Lesson.HasData, $"lesson: {vm.Lesson.Status} {vm.Lesson.ErrorMessage}");
        Assert.True(vm.HasVideo);
        Assert.Contains("/embed/", vm.EmbedUrl);

        // The watermark needs both, and an empty one would leave a leak
        // untraceable.
        Assert.False(string.IsNullOrWhiteSpace(vm.WatermarkName));
    }

    private sealed class Device : IDeviceIdentityProvider
    {
        public string GetDeviceId() => "hw-win-4f2a91c7d0e51b6a";
        public string GetDeviceType() => "Windows";
        public string GetMachineName() => "DESKTOP-A2REKKA";
    }

    private sealed class Tokens : ITokenStore
    {
        private string? _a, _r;
        public Task<string?> GetAccessTokenAsync() => Task.FromResult(_a);
        public Task<string?> GetRefreshTokenAsync() => Task.FromResult(_r);
        public Task SaveAsync(string a, string r) { _a = a; _r = r; return Task.CompletedTask; }
        public Task ClearAsync() { _a = null; _r = null; return Task.CompletedTask; }
    }
}
