using System.Diagnostics;
using System.Net;
using System.Text;
using NumberOne.Core.Abstractions;
using NumberOne.Core.Api;
using NumberOne.Core.Models;
using NumberOne.Core.Services;
using NumberOne.Core.ViewModels;

namespace NumberOne.Core.Tests;

/// <summary>Exams, results, notifications, live and profile.</summary>
public class ScreenViewModelTests
{
    // ── Exams ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Exams_split_into_never_attempted_and_completed()
    {
        var vm = new ExamsViewModel(Api(Payloads.Exams));
        await vm.LoadAsync();

        Assert.Single(vm.Available);
        Assert.Single(vm.Completed);
        Assert.Equal("اختبار جديد", vm.Available[0].Title);
    }

    [Fact]
    public async Task The_completed_tab_reports_the_best_attempt_not_the_latest()
    {
        // There is no server-side attempt limit, so a student may have several.
        var vm = new ExamsViewModel(Api(Payloads.Exams));
        await vm.LoadAsync();

        Assert.Equal(83.3, vm.Completed[0].BestAttempt!.Percentage);
    }

    // ── Results ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Results_flatten_every_attempt_across_every_exam()
    {
        var vm = new ResultsViewModel(Api(Payloads.Exams));
        await vm.LoadAsync();

        // Two attempts on one exam, none on the other.
        Assert.Equal(2, vm.TotalCount);
        Assert.Equal(1, vm.PassedCount);
        Assert.Equal(1, vm.FailedCount);
    }

    [Fact]
    public async Task Results_filter_by_verdict_and_search_by_title()
    {
        var vm = new ResultsViewModel(Api(Payloads.Exams));
        await vm.LoadAsync();

        vm.FilterPassedCommand.Execute(null);
        Assert.Single(vm.Visible);
        Assert.True(vm.Visible[0].IsPassed);

        vm.FilterAllCommand.Execute(null);
        vm.Query = "لا يوجد";
        Assert.Empty(vm.Visible);
    }

    [Fact]
    public async Task Results_sort_newest_first_by_default()
    {
        var vm = new ResultsViewModel(Api(Payloads.Exams));
        await vm.LoadAsync();

        Assert.True(vm.Visible[0].SubmittedAt >= vm.Visible[1].SubmittedAt);
    }

    [Fact]
    public async Task A_result_row_reads_as_a_score_out_of_the_total()
    {
        var vm = new ResultsViewModel(Api(Payloads.Exams));
        await vm.LoadAsync();

        Assert.Equal("٥ / ٦", vm.Visible.First(r => r.IsPassed).ScoreLabel);
        Assert.Equal("ناجح", vm.Visible.First(r => r.IsPassed).VerdictLabel);
    }

    // ── Notifications ────────────────────────────────────────────────────────

    [Fact]
    public async Task Notifications_group_todays_under_the_word_for_today()
    {
        var today = DateTimeOffset.Now.ToString("yyyy-MM-ddTHH:mm:sszzz");
        var yesterday = DateTimeOffset.Now.AddDays(-1).ToString("yyyy-MM-ddTHH:mm:sszzz");

        var vm = new NotificationsViewModel(Api($$"""
        {"count":2,"results":[
          {"id":1,"title":"أ","message":"م","notification_type":"lecture","is_read":false,"created_at":"{{today}}"},
          {"id":2,"title":"ب","message":"م","notification_type":"exam","is_read":true,"created_at":"{{yesterday}}"}]}
        """, unreadCount: 1));

        await vm.LoadAsync();

        Assert.Equal(2, vm.Groups.Count);
        Assert.Equal("اليوم", vm.Groups[0].Label);
        Assert.Equal("أمس", vm.Groups[1].Label);
    }

    [Fact]
    public async Task The_badge_hides_at_zero_and_caps_at_ninety_nine()
    {
        var vm = new NotificationsViewModel(Api("""{"count":0,"results":[]}""", unreadCount: 0));
        await vm.LoadAsync();

        Assert.False(vm.HasUnread);
        Assert.Equal("", vm.BadgeLabel);

        vm.UnreadCount = 5;
        Assert.Equal("٥", vm.BadgeLabel);

        vm.UnreadCount = 150;
        Assert.Equal("٩٩+", vm.BadgeLabel);
    }

    [Fact]
    public async Task A_badge_refresh_that_fails_keeps_the_previous_count()
    {
        // Flashing to zero because one poll failed would be worse than stale.
        var vm = new NotificationsViewModel(Api("""{"count":1,"results":[]}""", unreadCount: 3));
        await vm.LoadAsync();
        Assert.Equal(3, vm.UnreadCount);

        var failing = new NotificationsViewModel(FailingApi());
        failing.UnreadCount = 3;
        await failing.RefreshBadgeAsync();

        Assert.Equal(3, failing.UnreadCount);
    }

    // ── Live ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Joining_a_live_session_hands_the_url_to_the_browser()
    {
        var vm = new LiveViewModel(Api(Payloads.Rooms));
        await vm.LoadAsync();

        string? launched = null;
        vm.BrowserLauncher = url => { launched = url; return Task.FromResult(true); };

        var session = vm.Rooms.Value![0].Sessions.Single(s => s.Status == LiveStatuses.Live);
        await vm.JoinCommand.ExecuteAsync(session);

        Assert.Equal("https://meet.google.com/abc-defg-hij", launched);
    }

    [Fact]
    public async Task An_ended_session_says_so_rather_than_opening_a_dead_link()
    {
        var vm = new LiveViewModel(Api(Payloads.Rooms));
        await vm.LoadAsync();

        string? toast = null;
        vm.Toast += (_, text) => toast = text;
        vm.BrowserLauncher = _ => throw new UnreachableException();

        var ended = vm.Rooms.Value![0].Sessions.Single(s => s.Status == LiveStatuses.Ended);
        await vm.JoinCommand.ExecuteAsync(ended);

        Assert.Equal("انتهت هذه الجلسة ولم يبقَ رابط للدخول", toast);
    }

    [Fact]
    public async Task A_malformed_link_is_a_data_problem_and_says_so()
    {
        var vm = new LiveViewModel(Api("""
        [{"id":1,"room_name":"غرفة","room_type":"online","sessions":[
          {"id":9,"session_name":"س","provider":"other","status":"live","stream_url":"not-a-url"}]}]
        """));
        await vm.LoadAsync();

        string? toast = null;
        vm.Toast += (_, text) => toast = text;

        await vm.JoinCommand.ExecuteAsync(vm.Rooms.Value![0].Sessions[0]);

        Assert.Equal("رابط الجلسة غير صالح — راجع الإدارة", toast);
    }

    [Fact]
    public async Task No_browser_on_the_machine_is_reported_to_the_student()
    {
        var vm = new LiveViewModel(Api(Payloads.Rooms));
        await vm.LoadAsync();

        string? toast = null;
        vm.Toast += (_, text) => toast = text;
        vm.BrowserLauncher = _ => Task.FromResult(false);

        var live = vm.Rooms.Value![0].Sessions.Single(s => s.Status == LiveStatuses.Live);
        await vm.JoinCommand.ExecuteAsync(live);

        Assert.Equal("تعذّر فتح المتصفح على هذا الجهاز", toast);
    }

    [Fact]
    public async Task Room_meta_follows_Arabic_number_agreement()
    {
        // Not one plural template: 0 none, 1 singular, 2 dual, 3-10 plural,
        // 11+ singular again after a large number.
        var vm = new LiveViewModel(Api(Payloads.Rooms));
        await vm.LoadAsync();

        Assert.Equal("جلستان", vm.Rooms.Value![0].SessionCountLabel);
    }

    // ── Lesson ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task A_refused_lecture_explains_why_rather_than_just_saying_no()
    {
        // The student was shown this course, then refused the lecture inside it:
        // the courses and exams lists key on enrolled_grade, while
        // MyLessonDetailView requires a StudentCourseAccess row an online
        // student receives only on first payment. The server's wording is
        // accurate but leaves them with nothing to do about it.
        var api = ForbiddenApi("ليس لديك صلاحية الوصول لهذه المحاضرة.");
        var vm = new LessonViewModel(api, SignedInAuth(), new Uri("https://numberoneschools.com/api/"), 1);

        await vm.LoadAsync();

        Assert.True(vm.Lesson.HasError);
        Assert.Equal(LessonViewModel.LessonLockedMessage, vm.Lesson.ErrorMessage);
        Assert.Contains("التواصل مع إدارة المدرسة", vm.Lesson.ErrorMessage);
    }

    [Theory]
    // The server only parses "youtu.be/" and "v=", and returns the raw URL when
    // it cannot. A lesson saved with a /live/ or /shorts/ link therefore arrives
    // as something that is not an embed URL, so the id is read out defensively.
    [InlineData("https://www.youtube.com/embed/dQw4w9WgXcQ?modestbranding=1&rel=0", "dQw4w9WgXcQ")]
    [InlineData("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ")]
    [InlineData("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "dQw4w9WgXcQ")]
    [InlineData("https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ")]
    [InlineData("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ")]
    public async Task The_player_loads_the_wrapper_page_not_the_youtube_url(string embed, string id)
    {
        // Navigating a WebView straight at a /embed/ URL makes YouTube answer
        // "Error 153 - video player configuration error": that URL belongs
        // inside an iframe on a page. The wrapper is served from the API host so
        // the iframe has a real origin, which is what web and mobile already do.
        var vm = await LessonWithVideoAsync(embed);

        Assert.True(vm.HasVideo);
        Assert.Equal($"https://numberoneschools.com/api/academic/player/?v={id}", vm.PlayerUrl);
        Assert.DoesNotContain("youtube.com/embed", vm.PlayerUrl);
    }

    [Fact]
    public async Task A_lesson_with_an_unusable_video_url_reports_no_video()
    {
        // An empty frame beats a frame showing YouTube's error page.
        var vm = await LessonWithVideoAsync("https://example.com/not-a-video");

        Assert.False(vm.HasVideo);
        Assert.Null(vm.PlayerUrl);
    }

    private static async Task<LessonViewModel> LessonWithVideoAsync(string embedUrl)
    {
        var body = $$"""
        {"id":1,"title":"محاضرة","youtube_embed_url":"{{embedUrl}}","exercise":null}
        """;
        var client = new HttpClient(new LessonHandler(body))
        {
            BaseAddress = new Uri("https://numberoneschools.com/api/"),
        };

        var vm = new LessonViewModel(
            new StudentApi(client), SignedInAuth(),
            new Uri("https://numberoneschools.com/api/"), 1);

        await vm.LoadAsync();
        return vm;
    }

    // ── Profile ──────────────────────────────────────────────────────────────

    [Fact]
    public void An_unassigned_supervisor_reads_as_automatic_allocation()
    {
        var vm = new ProfileViewModel(SignedInAuth());

        Assert.Equal("توزيع إداري تلقائي", vm.SupervisorName);
    }

    [Fact]
    public void The_profile_maps_system_type_client_side()
    {
        var vm = new ProfileViewModel(SignedInAuth());

        Assert.Equal("عبر الإنترنت", vm.SystemTypeDisplay);
    }

    [Fact]
    public async Task The_device_identifier_is_copyable_from_the_profile_too()
    {
        var vm = new ProfileViewModel(SignedInAuth());

        string? copied = null;
        vm.ClipboardWriter = text => { copied = text; return Task.CompletedTask; };

        await vm.CopyDeviceIdCommand.ExecuteAsync(null);

        Assert.Equal("hw-win-4f2a91c7d0e51b6a", copied);
        Assert.True(vm.HasToast);
    }

    // ── Plumbing ─────────────────────────────────────────────────────────────

    private static StudentApi Api(string body, int unreadCount = 0)
    {
        var client = new HttpClient(new SingleBodyHandler(body, unreadCount))
        {
            BaseAddress = new Uri("https://numberoneschools.com/api/"),
        };
        return new StudentApi(client);
    }

    private static StudentApi ForbiddenApi(string message)
    {
        var client = new HttpClient(new StatusHandler(HttpStatusCode.Forbidden, message))
        {
            BaseAddress = new Uri("https://numberoneschools.com/api/"),
        };
        return new StudentApi(client);
    }

    private sealed class StatusHandler : HttpMessageHandler
    {
        private readonly HttpStatusCode _status;
        private readonly string _message;

        public StatusHandler(HttpStatusCode status, string message)
        {
            _status = status;
            _message = message;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => Task.FromResult(new HttpResponseMessage(_status)
            {
                Content = new StringContent(
                    "{\"detail\":\"" + _message + "\"}", Encoding.UTF8, "application/json"),
            });
    }

    private static StudentApi FailingApi()
    {
        var client = new HttpClient(new AlwaysFailsHandler())
        {
            BaseAddress = new Uri("https://numberoneschools.com/api/"),
        };
        return new StudentApi(client);
    }

    private static AuthService SignedInAuth()
    {
        var tokens = new Tokens();
        var client = new HttpClient(new SingleBodyHandler(Payloads.Login, 0))
        {
            BaseAddress = new Uri("https://numberoneschools.com/api/"),
        };

        var auth = new AuthService(client, tokens, new Device());
        auth.SignInAsync("fresh.student", "pass1234").GetAwaiter().GetResult();
        return auth;
    }

    /// <summary>
    /// Serves the lesson body for the lesson endpoint and an empty list for
    /// progress. One body for every path made the progress call fail to
    /// deserialise, which masked what the test was actually checking.
    /// </summary>
    private sealed class LessonHandler : HttpMessageHandler
    {
        private readonly string _lesson;

        public LessonHandler(string lesson) => _lesson = lesson;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var body = request.RequestUri!.AbsolutePath.Contains("my-progress") ? "[]" : _lesson;

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            });
        }
    }

    private sealed class SingleBodyHandler : HttpMessageHandler
    {
        private readonly string _body;
        private readonly int _unreadCount;

        public SingleBodyHandler(string body, int unreadCount)
        {
            _body = body;
            _unreadCount = unreadCount;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var path = request.RequestUri!.AbsolutePath;

            var body = path.Contains("notifications/count") ? $$"""{"count":{{_unreadCount}}}""" : _body;

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            });
        }
    }

    private sealed class AlwaysFailsHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => throw new HttpRequestException("offline");
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

    private static class Payloads
    {
        public const string Exams = """
        [{"id":1,"title":"اختبار جديد","course_id":1,"course_name":"الرياضيات",
          "duration_minutes":30,"passing_score":3.0,"total_marks":6.0,"question_count":3,"attempts":[]},
         {"id":2,"title":"اختبار سابق","course_id":1,"course_name":"الرياضيات",
          "duration_minutes":30,"passing_score":3.0,"total_marks":6.0,"question_count":3,
          "attempts":[
            {"id":9,"score":5.0,"percentage":83.3,"is_passed":true,"submitted_at":"2026-08-20T10:00:00+02:00"},
            {"id":8,"score":2.0,"percentage":33.3,"is_passed":false,"submitted_at":"2026-08-10T10:00:00+02:00"}]}]
        """;

        public const string Rooms = """
        [{"id":1,"room_name":"غرفة","room_type":"online","sessions":[
          {"id":1,"session_name":"مباشرة","provider":"google_meet","status":"live",
           "stream_url":"https://meet.google.com/abc-defg-hij"},
          {"id":2,"session_name":"منتهية","provider":"zoom","status":"ended",
           "stream_url":"https://zoom.us/j/1"}]}]
        """;

        public const string Login = """
        {"access":"a","refresh":"r","user":{
          "id":"209f3831-21b4-4784-a1b9-9660576ea410","username":"fresh.student",
          "full_name":"طالب جديد","phone":"0912345678","role":"student","is_active":true,
          "student_profile":{"id":1,"system_type":"online","balance":"1500.00",
            "device_id":"hw-win-4f2a91c7d0e51b6a","device_type":"Windows",
            "device_bound_at":"2026-06-18T10:00:00+02:00","supervisor_name":null}}}
        """;
    }
}
