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

        public Harness()
        {
            var handler = new AuthenticatingHandler(new Tokens(), new NoRefresh()) { InnerHandler = Server };
            var client = new HttpClient(handler) { BaseAddress = new Uri("https://numberoneschools.com/api/") };

            _api = new StudentApi(client);
            Courses = new CoursesViewModel(_api);
        }

        public CourseDetailViewModel Detail(int courseId) => new(_api, courseId);
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

        public void Respond(string path, string body) => _bodies[path] = body;

        public void Fail(string path, HttpStatusCode status, string message)
            => _failures[path] = (status, message);

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var path = request.RequestUri!.AbsolutePath.Replace("/api/", "");

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

        private const string Progress = """
        [{"id":1,"lesson":1,"is_completed":true},{"id":2,"lesson":2,"is_completed":false}]
        """;
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
