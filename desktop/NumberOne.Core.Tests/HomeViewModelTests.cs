using System.Net;
using System.Text;
using NumberOne.Core.Abstractions;
using NumberOne.Core.Api;
using NumberOne.Core.Models;
using NumberOne.Core.Services;
using NumberOne.Core.ViewModels;

namespace NumberOne.Core.Tests;

/// <summary>
/// The dashboard aggregates five unrelated endpoints. What these tests protect
/// is the property the design insists on: the sections are independent, so one
/// slow or failing endpoint degrades its own region and nothing else.
/// </summary>
public class HomeViewModelTests
{
    [Fact]
    public async Task Every_section_resolves_with_its_own_data()
    {
        var h = new Harness();
        await h.Vm.LoadAsync();

        Assert.True(h.Vm.Courses.HasData);
        Assert.True(h.Vm.Exams.HasData);
        Assert.True(h.Vm.Notifications.HasData);
        Assert.True(h.Vm.LiveRooms.HasData);
        Assert.True(h.Vm.Progress.HasData);
    }

    [Fact]
    public async Task A_failing_section_does_not_take_the_others_down()
    {
        // This is the reason the sections exist at all. Before per-section
        // state, one 500 from notifications blanked the whole dashboard.
        var h = new Harness();
        h.Server.Fail(ApiEndpoints.Notifications);

        await h.Vm.LoadAsync();

        Assert.True(h.Vm.Notifications.HasError);
        Assert.True(h.Vm.Courses.HasData);
        Assert.True(h.Vm.Exams.HasData);
        Assert.True(h.Vm.LiveRooms.HasData);
    }

    [Fact]
    public async Task A_failed_section_shows_the_server_message_and_can_retry_alone()
    {
        var h = new Harness();
        h.Server.Fail(ApiEndpoints.MyCourses, "تعذّر تحميل الكورسات.");

        await h.Vm.LoadAsync();

        Assert.True(h.Vm.Courses.HasError);
        Assert.Equal("تعذّر تحميل الكورسات.", h.Vm.Courses.ErrorMessage);

        var callsBefore = h.Server.CallCount(ApiEndpoints.StudentExams);

        h.Server.Succeed(ApiEndpoints.MyCourses);
        await h.Vm.Courses.LoadAsync();

        Assert.True(h.Vm.Courses.HasData);

        // The retry refetched only this section.
        Assert.Equal(callsBefore, h.Server.CallCount(ApiEndpoints.StudentExams));
    }

    [Fact]
    public async Task A_slow_section_does_not_delay_the_others()
    {
        var h = new Harness();
        h.Server.Delay(ApiEndpoints.Notifications, TimeSpan.FromMilliseconds(300));

        var load = h.Vm.LoadAsync();

        // Long enough for the fast sections to land, short enough that the slow
        // one certainly has not.
        await Task.Delay(120);

        Assert.True(h.Vm.Courses.HasData);
        Assert.True(h.Vm.Notifications.IsLoading);

        await load;
        Assert.True(h.Vm.Notifications.HasData);
    }

    [Fact]
    public async Task An_empty_section_reports_empty_rather_than_data()
    {
        var h = new Harness();
        h.Server.Respond(ApiEndpoints.MyCourses, "[]");

        await h.Vm.LoadAsync();

        Assert.True(h.Vm.Courses.IsEmpty);
        Assert.False(h.Vm.Courses.HasData);
    }

    [Fact]
    public async Task Stats_are_computed_across_courses_and_progress()
    {
        var h = new Harness();
        await h.Vm.LoadAsync();

        Assert.Equal(1, h.Vm.CourseCount);
        Assert.Equal(4, h.Vm.LessonCount);
        Assert.Equal(1, h.Vm.CompletedLessonCount);
        Assert.Equal(25, h.Vm.ProgressPercent);
    }

    [Fact]
    public async Task Progress_is_zero_rather_than_a_divide_by_zero_when_there_are_no_lessons()
    {
        var h = new Harness();
        h.Server.Respond(ApiEndpoints.MyCourses, "[]");

        await h.Vm.LoadAsync();

        Assert.Equal(0, h.Vm.ProgressPercent);
    }

    [Fact]
    public async Task Only_unattempted_exams_count_as_pending()
    {
        // The dashboard's exam table is "upcoming", not "all".
        var h = new Harness();
        await h.Vm.LoadAsync();

        Assert.Equal(1, h.Vm.PendingExamCount);
        Assert.DoesNotContain(h.Vm.Exams.Value!, e => e.HasBeenAttempted);
    }

    [Fact]
    public async Task A_live_session_wins_the_banner_over_an_earlier_upcoming_one()
    {
        var h = new Harness();
        await h.Vm.LoadAsync();

        Assert.True(h.Vm.HasLiveBanner);
        Assert.True(h.Vm.IsLiveNow);
        Assert.Equal("مباشرة", h.Vm.BannerSession!.SessionName);
    }

    [Fact]
    public async Task With_nothing_live_the_soonest_upcoming_session_leads()
    {
        var h = new Harness();
        h.Server.Respond(ApiEndpoints.MyLiveSessions, Payloads.RoomsUpcomingOnly);

        await h.Vm.LoadAsync();

        Assert.True(h.Vm.HasLiveBanner);
        Assert.False(h.Vm.IsLiveNow);
        Assert.Equal("الأقرب", h.Vm.BannerSession!.SessionName);
    }

    [Fact]
    public async Task An_ended_session_never_leads_the_banner()
    {
        var h = new Harness();
        h.Server.Respond(ApiEndpoints.MyLiveSessions, Payloads.RoomsEndedOnly);

        await h.Vm.LoadAsync();

        Assert.False(h.Vm.HasLiveBanner);
    }

    [Fact]
    public async Task Continue_learning_drops_finished_courses_and_leads_with_the_most_progressed()
    {
        var h = new Harness();
        h.Server.Respond(ApiEndpoints.MyCourses, Payloads.TwoCourses);
        h.Server.Respond(ApiEndpoints.MyProgress, Payloads.ProgressFinishingCourseTwo);

        await h.Vm.LoadAsync();

        // Course 2 is fully done, so it drops out entirely rather than sitting
        // at 100% occupying a card.
        var items = h.Vm.ContinueLearning;
        Assert.Single(items);
        Assert.Equal("الرياضيات", items[0].Course.Name);
        Assert.Equal(50, items[0].Percent);
        Assert.Equal("١ من ٢ محاضرات", items[0].ProgressLabel);
    }

    [Fact]
    public async Task Reload_refetches_every_section()
    {
        var h = new Harness();
        await h.Vm.LoadAsync();

        var before = h.Server.CallCount(ApiEndpoints.MyCourses);
        await h.Vm.ReloadAsync();

        Assert.Equal(before + 1, h.Server.CallCount(ApiEndpoints.MyCourses));
    }

    [Fact]
    public void The_balance_comes_from_the_auth_payload_not_the_finance_app()
    {
        // finance's StudentFinancialFileView is IsAdminOrManager; this string is
        // the only part of the financial file a student can read.
        var h = new Harness();

        Assert.Equal("1500.00", h.Vm.RemainingBalance);
        Assert.True(h.Vm.HasBalance);
        Assert.Equal("عبر الإنترنت", h.Vm.SystemTypeDisplay);
    }

    // ── Harness ──────────────────────────────────────────────────────────────

    private sealed class Harness
    {
        public StubServer Server { get; } = new();
        public HomeViewModel Vm { get; }

        public Harness()
        {
            var baseAddress = new Uri("https://numberoneschools.com/api/");
            var tokens = new Tokens();

            var handler = new AuthenticatingHandler(tokens, new NoRefresh()) { InnerHandler = Server };
            var client = new HttpClient(handler) { BaseAddress = baseAddress };

            var auth = new AuthService(client, tokens, new Device());

            // Sign in so CurrentUser is populated for the header.
            Server.Respond(ApiEndpoints.Login, Payloads.Login);
            auth.SignInAsync("fresh.student", "pass1234").GetAwaiter().GetResult();

            Vm = new HomeViewModel(new StudentApi(client), auth);
        }
    }

    private sealed class StubServer : HttpMessageHandler
    {
        private readonly Dictionary<string, string> _bodies = new();
        private readonly Dictionary<string, string?> _failures = new();
        private readonly Dictionary<string, TimeSpan> _delays = new();
        private readonly Dictionary<string, int> _calls = new();
        private readonly Lock _lock = new();

        public StubServer()
        {
            _bodies[ApiEndpoints.MyCourses] = Payloads.OneCourse;
            _bodies[ApiEndpoints.MyProgress] = Payloads.ProgressOneDone;
            _bodies[ApiEndpoints.StudentExams] = Payloads.Exams;
            _bodies[ApiEndpoints.Notifications] = Payloads.Notifications;
            _bodies[ApiEndpoints.MyLiveSessions] = Payloads.RoomsWithLive;
        }

        public void Respond(string path, string body) => _bodies[path] = body;

        public void Fail(string path, string? message = null) => _failures[path] = message;

        public void Succeed(string path) => _failures.Remove(path);

        public void Delay(string path, TimeSpan delay) => _delays[path] = delay;

        public int CallCount(string path)
        {
            lock (_lock) return _calls.GetValueOrDefault(path);
        }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var path = request.RequestUri!.AbsolutePath.Replace("/api/", "");

            lock (_lock) _calls[path] = _calls.GetValueOrDefault(path) + 1;

            if (_delays.TryGetValue(path, out var delay))
                await Task.Delay(delay, ct);

            if (_failures.TryGetValue(path, out var message))
            {
                var body = message is null
                    ? """{"detail":"خطأ في الخادم."}"""
                    : $$"""{"detail":"{{message}}"}""";

                return new HttpResponseMessage(HttpStatusCode.InternalServerError)
                {
                    Content = new StringContent(body, Encoding.UTF8, "application/json"),
                };
            }

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    _bodies.GetValueOrDefault(path, "[]"), Encoding.UTF8, "application/json"),
            };
        }
    }

    private static class Payloads
    {
        public const string Login = """
        {
          "access": "a", "refresh": "r",
          "user": {
            "id": "209f3831-21b4-4784-a1b9-9660576ea410",
            "username": "fresh.student", "full_name": "طالب جديد",
            "role": "student", "is_active": true,
            "student_profile": {
              "id": 1, "system_type": "online", "balance": "1500.00",
              "device_id": "hw-win-4f2a91c7d0e51b6a", "device_type": "Windows"
            }
          }
        }
        """;

        /// <summary>One course, one unit, four lessons.</summary>
        public const string OneCourse = """
        [{"id":1,"name":"الرياضيات","system_type":"online","units":[
          {"id":1,"course":1,"name":"الوحدة الأولى","lessons":[
            {"id":1,"title":"الأولى"},{"id":2,"title":"الثانية"},
            {"id":3,"title":"الثالثة"},{"id":4,"title":"الرابعة"}]}]}]
        """;

        public const string TwoCourses = """
        [{"id":1,"name":"الرياضيات","system_type":"online","units":[
          {"id":1,"course":1,"name":"و١","lessons":[{"id":1,"title":"أ"},{"id":2,"title":"ب"}]}]},
         {"id":2,"name":"الفيزياء","system_type":"online","units":[
          {"id":2,"course":2,"name":"و٢","lessons":[{"id":3,"title":"ج"}]}]}]
        """;

        public const string ProgressOneDone = """
        [{"id":1,"lesson":1,"is_completed":true},{"id":2,"lesson":2,"is_completed":false}]
        """;

        /// <summary>Course 2 finished; course 1 half done.</summary>
        public const string ProgressFinishingCourseTwo = """
        [{"id":1,"lesson":1,"is_completed":true},{"id":3,"lesson":3,"is_completed":true}]
        """;

        public const string Exams = """
        [{"id":1,"title":"اختبار الجبر","course_id":1,"course_name":"الرياضيات",
          "duration_minutes":30,"passing_score":3.0,"total_marks":6.0,"question_count":4,"attempts":[]},
         {"id":2,"title":"اختبار سابق","course_id":1,"course_name":"الرياضيات",
          "duration_minutes":30,"passing_score":3.0,"total_marks":6.0,"question_count":4,
          "attempts":[{"id":9,"score":5.0,"percentage":83.3,"is_passed":true}]}]
        """;

        public const string Notifications = """
        {"count":2,"next":null,"previous":null,"results":[
          {"id":1,"title":"محاضرة جديدة","message":"...","notification_type":"lecture",
           "is_read":false,"created_at":"2026-08-29T06:00:00+02:00"},
          {"id":2,"title":"اختبار جديد","message":"...","notification_type":"exam",
           "is_read":true,"created_at":"2026-08-28T06:00:00+02:00"}]}
        """;

        public const string RoomsWithLive = """
        [{"id":1,"room_name":"غرفة","room_type":"online","sessions":[
          {"id":1,"session_name":"قادمة","provider":"zoom","status":"upcoming",
           "stream_url":"https://zoom.us/j/1","scheduled_start":"2026-08-30T10:00:00+02:00"},
          {"id":2,"session_name":"مباشرة","provider":"google_meet","status":"live",
           "stream_url":"https://meet.google.com/x"}]}]
        """;

        public const string RoomsUpcomingOnly = """
        [{"id":1,"room_name":"غرفة","room_type":"online","sessions":[
          {"id":1,"session_name":"الأبعد","provider":"zoom","status":"upcoming",
           "stream_url":"https://zoom.us/j/1","scheduled_start":"2026-09-10T10:00:00+02:00"},
          {"id":2,"session_name":"الأقرب","provider":"zoom","status":"upcoming",
           "stream_url":"https://zoom.us/j/2","scheduled_start":"2026-08-30T10:00:00+02:00"}]}]
        """;

        public const string RoomsEndedOnly = """
        [{"id":1,"room_name":"غرفة","room_type":"online","sessions":[
          {"id":1,"session_name":"منتهية","provider":"zoom","status":"ended",
           "stream_url":"https://zoom.us/j/1"}]}]
        """;
    }

    private sealed class NoRefresh : ITokenRefresher
    {
        public Task<TokenPair?> RefreshAsync(string t, CancellationToken ct) => Task.FromResult<TokenPair?>(null);
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
