using System.Net;
using System.Text;
using NumberOne.Core.Abstractions;
using NumberOne.Core.Api;
using NumberOne.Core.Models;
using NumberOne.Core.Services;
using NumberOne.Core.ViewModels;

namespace NumberOne.Core.Tests;

/// <summary>
/// The courses table and the course detail. Both join two endpoints — the tree
/// and the progress rows — so most of what can go wrong here is the join.
/// </summary>
public class CoursesViewModelTests
{
    [Fact]
    public async Task Rows_join_progress_onto_courses()
    {
        var h = new Harness();
        await h.Courses.LoadAsync();

        var rows = h.Courses.Courses.Value!;
        Assert.Equal(2, rows.Count);

        var maths = rows.Single(r => r.Name == "الرياضيات");
        Assert.Equal(2, maths.LessonCount);
        Assert.Equal(1, maths.CompletedCount);
        Assert.Equal(50, maths.Percent);
        Assert.Equal("٥٠٪", maths.PercentLabel);
    }

    [Fact]
    public async Task System_type_is_mapped_client_side_not_taken_from_the_server_label()
    {
        // The API also sends system_type_display, whose values are
        // "أونلاين"/"فلاش". Binding to it is what makes a student see two
        // different words for one enrollment type across the two clients.
        var h = new Harness();
        await h.Courses.LoadAsync();

        var rows = h.Courses.Courses.Value!;

        Assert.Equal("عبر الإنترنت", rows.Single(r => r.Name == "الرياضيات").SystemTypeDisplay);
        Assert.Equal("بدون إنترنت (فلاش)", rows.Single(r => r.Name == "الفيزياء").SystemTypeDisplay);
    }

    [Fact]
    public async Task A_course_with_no_teacher_shows_a_dash_rather_than_blank()
    {
        var h = new Harness();
        await h.Courses.LoadAsync();

        Assert.Equal("—", h.Courses.Courses.Value!.Single(r => r.Name == "الفيزياء").TeacherName);
    }

    [Fact]
    public async Task A_course_with_no_lessons_reads_zero_rather_than_dividing_by_zero()
    {
        var h = new Harness();
        h.Server.Respond(ApiEndpoints.MyCourses, """[{"id":9,"name":"فارغ","system_type":"online","units":[]}]""");

        await h.Courses.LoadAsync();

        var row = Assert.Single(h.Courses.Courses.Value!);
        Assert.Equal(0, row.Percent);
        Assert.Equal(0, row.LessonCount);
    }

    [Fact]
    public async Task No_courses_is_an_empty_state_not_an_error()
    {
        var h = new Harness();
        h.Server.Respond(ApiEndpoints.MyCourses, "[]");

        await h.Courses.LoadAsync();

        Assert.True(h.Courses.Courses.IsEmpty);
        Assert.False(h.Courses.Courses.HasError);
    }

    [Fact]
    public async Task Opening_a_row_reports_the_course_id()
    {
        var h = new Harness();
        await h.Courses.LoadAsync();

        int? opened = null;
        h.Courses.CourseOpened += (_, id) => opened = id;

        h.Courses.OpenCourseCommand.Execute(h.Courses.Courses.Value![0]);

        Assert.Equal(1, opened);
    }

    // ── Course detail ────────────────────────────────────────────────────────

    [Fact]
    public async Task Detail_orders_units_and_lessons_and_numbers_them_within_the_unit()
    {
        var h = new Harness();
        var vm = h.Detail(1);

        await vm.LoadAsync();

        var detail = vm.Course.Value!;
        Assert.Equal(2, detail.UnitCount);

        // display_order wins over the order the server happened to serialise in.
        Assert.Equal("الوحدة الأولى", detail.Units[0].Name);
        Assert.Equal("الوحدة الثانية", detail.Units[1].Name);

        // Numbering restarts per unit, matching the accordion the design shows.
        Assert.Equal(new[] { 1, 2 }, detail.Units[0].Lessons.Select(l => l.Index));
        Assert.Equal(new[] { 1 }, detail.Units[1].Lessons.Select(l => l.Index));
    }

    [Fact]
    public async Task The_current_lesson_is_the_first_unfinished_one_in_order()
    {
        var h = new Harness();
        var vm = h.Detail(1);

        await vm.LoadAsync();

        // Lesson 1 is complete, so lesson 2 carries the leading bar.
        Assert.Equal(2, vm.Course.Value!.CurrentLesson?.Id);
    }

    [Fact]
    public async Task A_finished_course_has_no_current_lesson()
    {
        var h = new Harness();
        h.Server.Respond(ApiEndpoints.MyProgress, """
        [{"id":1,"lesson":1,"is_completed":true},
         {"id":2,"lesson":2,"is_completed":true},
         {"id":3,"lesson":3,"is_completed":true}]
        """);

        var vm = h.Detail(1);
        await vm.LoadAsync();

        Assert.Null(vm.Course.Value!.CurrentLesson);
        Assert.Equal(100, vm.Course.Value.Percent);
    }

    [Fact]
    public async Task Duration_renders_in_Arabic_digits_and_is_blank_when_absent()
    {
        var h = new Harness();
        var vm = h.Detail(1);

        await vm.LoadAsync();

        var lessons = vm.Course.Value!.Units[0].Lessons;
        Assert.Equal("٢٤ دقيقة", lessons[0].DurationLabel);
        Assert.Equal("", lessons[1].DurationLabel);
    }

    [Fact]
    public async Task A_refused_course_surfaces_the_servers_own_message()
    {
        var h = new Harness();
        h.Server.Fail(ApiEndpoints.MyCourse(1), HttpStatusCode.Forbidden,
            "ليس لديك صلاحية الوصول لهذا الكورس.");

        var vm = h.Detail(1);
        await vm.LoadAsync();

        Assert.True(vm.Course.HasError);
        Assert.Equal("ليس لديك صلاحية الوصول لهذا الكورس.", vm.Course.ErrorMessage);
    }

    // ── Harness ──────────────────────────────────────────────────────────────

    private sealed class Harness
    {
        public StubServer Server { get; } = new();
        public CoursesViewModel Courses { get; }

        private readonly StudentApi _api;
        private readonly AuthService _auth;

        public Harness(bool online = false, int? gradeId = 1)
        {
            var handler = new AuthenticatingHandler(new Tokens(), new NoRefresh()) { InnerHandler = Server };
            var client = new HttpClient(handler) { BaseAddress = new Uri("https://numberoneschools.com/api/") };

            _api = new StudentApi(client);

            // No signed-in user, so CurrentUser is null and the API falls back to
            // the flash path (/academic/my-courses/) -- which is what this stub
            // server serves.
            _auth = new AuthService(client, new Tokens(), new StubDevice());

            if (online)
            {
                Server.Respond(ApiEndpoints.Login, LoginAsOnline(gradeId));
                _auth.SignInAsync("a.student", "pass1234").GetAwaiter().GetResult();
            }

            Courses = new CoursesViewModel(_api, _auth);
        }

        public CourseDetailViewModel Detail(int courseId) => new(_api, _auth, courseId);
    }

    private sealed class StubServer : HttpMessageHandler
    {
        private readonly Dictionary<string, string> _bodies = new();
        private readonly Dictionary<string, (HttpStatusCode Status, string Message)> _failures = new();

        public StubServer()
        {
            _bodies[ApiEndpoints.MyCourses] = TwoCourses;
            _bodies[ApiEndpoints.MyCourse(1)] = CourseOne;
            _bodies[ApiEndpoints.MyProgress] = Progress;
        }

        /// <summary>
        /// Every path requested. A list rather than "the last one": the courses
        /// and progress calls run concurrently, so whichever finishes last would
        /// otherwise decide what the test sees.
        /// </summary>
        public List<string> Paths { get; } = new();

        public void Respond(string path, string body) => _bodies[path] = body;

        public void Fail(string path, HttpStatusCode status, string message)
            => _failures[path] = (status, message);

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var path = request.RequestUri!.AbsolutePath.Replace("/api/", "");

            if (!path.Contains("auth/"))
            {
                lock (Paths) Paths.Add(path);
            }

            // The grade-filtered list carries a query string; match on the path.
            if (path == "academic/courses/")
                return Task.FromResult(Ok(OnlineCoursesPage));

            if (_failures.TryGetValue(path, out var failure))
            {
                return Task.FromResult(new HttpResponseMessage(failure.Status)
                {
                    Content = new StringContent(
                        $$"""{"detail":"{{failure.Message}}"}""", Encoding.UTF8, "application/json"),
                });
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    _bodies.GetValueOrDefault(path, "[]"), Encoding.UTF8, "application/json"),
            });
        }

        /// <summary>Maths (online, with a teacher) and Physics (flash, without).</summary>
        private const string TwoCourses = """
        [{"id":1,"name":"الرياضيات","system_type":"online","teacher_name":"أ. محمد","units":[
           {"id":1,"course":1,"name":"الوحدة الأولى","display_order":1,"lessons":[
             {"id":1,"title":"الأولى","display_order":1,"duration_minutes":24},
             {"id":2,"title":"الثانية","display_order":2}]}]},
         {"id":2,"name":"الفيزياء","system_type":"flash","units":[
           {"id":3,"course":2,"name":"و","display_order":1,"lessons":[
             {"id":5,"title":"درس","display_order":1}]}]}]
        """;

        /// <summary>Units deliberately serialised out of display order.</summary>
        private const string CourseOne = """
        {"id":1,"name":"الرياضيات","system_type":"online","teacher_name":"أ. محمد",
         "description":"منهج كامل","units":[
          {"id":2,"course":1,"name":"الوحدة الثانية","display_order":2,"lessons":[
            {"id":3,"title":"الثالثة","display_order":1,"duration_minutes":15}]},
          {"id":1,"course":1,"name":"الوحدة الأولى","display_order":1,"lessons":[
            {"id":2,"title":"الثانية","display_order":2},
            {"id":1,"title":"الأولى","display_order":1,"duration_minutes":24}]}]}
        """;

        /// <summary>
        /// What /academic/courses/ actually returns: a pagination envelope whose
        /// rows come from CourseListSerializer -- no units, but a lesson_count.
        /// </summary>
        private const string OnlineCoursesPage = """
        {"count":1,"next":null,"previous":null,"results":[
          {"id":1,"name":"الرياضيات","system_type":"online","teacher_name":"أ. محمد",
           "grade":1,"grade_name":"الصف الثالث","is_active":true,"lesson_count":7}]}
        """;

        private static HttpResponseMessage Ok(string body) => new(HttpStatusCode.OK)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };

        private const string Progress = """
        [{"id":1,"lesson":1,"is_completed":true},{"id":2,"lesson":2,"is_completed":false}]
        """;
    }

    private static string LoginAsOnline(int? gradeId)
    {
        var grade = gradeId is null ? "null" : gradeId.Value.ToString();

        // Built by substitution rather than interpolation: the JSON ends in a
        // run of closing braces, which an interpolated raw literal reads as
        // holes no matter how many $ it carries.
        const string template = """
        {"access":"a","refresh":"r","user":{
          "id":"209f3831-21b4-4784-a1b9-9660576ea410","username":"a.student",
          "full_name":"طالب","role":"student","is_active":true,
          "student_profile":{"id":1,"system_type":"online","enrolled_grade":GRADE,
            "device_id":"hw-win-4f2a91c7d0e51b6a","device_type":"Windows"}}}
        """;

        return template.Replace("GRADE", gradeId?.ToString() ?? "null");
    }

    private sealed class StubDevice : IDeviceIdentityProvider
    {
        public string GetDeviceId() => "hw-win-4f2a91c7d0e51b6a";
        public string GetDeviceType() => "Windows";
        public string GetMachineName() => "DESKTOP-A2REKKA";
    }

    private sealed class NoRefresh : ITokenRefresher
    {
        public Task<TokenPair?> RefreshAsync(string t, CancellationToken ct) => Task.FromResult<TokenPair?>(null);
    }

    private sealed class Tokens : ITokenStore
    {
        public Task<string?> GetAccessTokenAsync() => Task.FromResult<string?>("token");
        public Task<string?> GetRefreshTokenAsync() => Task.FromResult<string?>("refresh");
        public Task SaveAsync(string a, string r) => Task.CompletedTask;
        public Task ClearAsync() => Task.CompletedTask;
    }
}
