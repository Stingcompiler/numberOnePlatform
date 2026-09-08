using System.Net;
using System.Text;
using NumberOne.Core.Abstractions;
using NumberOne.Core.Services;
using NumberOne.Core.ViewModels;

namespace NumberOne.Core.Tests;

/// <summary>
/// المحاضرات — the flat list of every lecture across every course.
///
/// The screen exists to answer "what have I not watched yet", which six
/// separate course trees cannot show at once. What is worth pinning is that it
/// flattens in the right order, carries the course id each row needs to open,
/// and keeps "nothing matched the filter" distinct from "no lectures".
/// </summary>
public class LecturesTests
{
    [Fact]
    public async Task Every_lecture_from_every_course_appears_once()
    {
        var vm = await LoadedAsync();

        Assert.Equal(4, vm.Lectures.Value!.Count);
    }

    [Fact]
    public async Task Rows_follow_course_then_unit_then_lesson_order()
    {
        // Flattening loses the tree, so the order has to carry what the tree
        // was saying: the display_order the teacher set, not id order.
        var vm = await LoadedAsync();

        Assert.Equal(
            new[] { "الأولى", "الثانية", "الثالثة", "الفيزياء ١" },
            vm.Lectures.Value!.Select(r => r.Title));
    }

    [Fact]
    public async Task A_row_carries_its_course_so_the_player_can_build_its_rail()
    {
        // Without the course id the lecture cannot be opened from here at all:
        // my-lessons/{id}/ knows nothing of a lecture's neighbours, so the
        // player builds its unit rail from the course tree.
        var vm = await LoadedAsync();

        Assert.All(vm.Lectures.Value!, row => Assert.NotEqual(0, row.CourseId));
        Assert.Equal(2, vm.Lectures.Value!.Last().CourseId);
    }

    [Fact]
    public async Task Opening_a_row_reports_both_the_lecture_and_its_course()
    {
        var vm = await LoadedAsync();

        (int LessonId, int CourseId) opened = default;
        vm.LectureOpened += (_, target) => opened = target;

        vm.OpenLectureCommand.Execute(vm.Lectures.Value![0]);

        Assert.Equal((11, 1), opened);
    }

    [Fact]
    public async Task Progress_marks_the_lectures_already_watched()
    {
        var vm = await LoadedAsync();

        Assert.True(vm.Lectures.Value!.Single(r => r.Id == 11).IsCompleted);
        Assert.False(vm.Lectures.Value!.Single(r => r.Id == 12).IsCompleted);
    }

    [Fact]
    public async Task The_unwatched_filter_hides_what_is_done()
    {
        // The reason to open a flat list: by mid-term most rows are watched.
        var vm = await LoadedAsync();

        vm.ShowUnwatchedCommand.Execute(null);

        Assert.Equal(3, vm.Visible.Count);
        Assert.DoesNotContain(vm.Visible, r => r.IsCompleted);
    }

    [Fact]
    public async Task Search_matches_the_lecture_the_course_or_the_unit()
    {
        var vm = await LoadedAsync();

        vm.ApplySearch("الفيزياء");
        Assert.Single(vm.Visible);

        vm.ApplySearch("الوحدة الأولى");
        Assert.Equal(2, vm.Visible.Count);
    }

    [Fact]
    public async Task A_filter_that_matches_nothing_is_not_an_empty_library()
    {
        // Distinct states, distinct remedies: clear the filter, versus wait for
        // a teacher to publish. Collapsing them would tell a student with four
        // lectures that they have none.
        var vm = await LoadedAsync();

        vm.ApplySearch("لا يوجد");

        Assert.True(vm.IsFilteredEmpty);
        Assert.False(vm.Lectures.IsEmpty);
    }

    [Fact]
    public async Task Clearing_the_filters_restores_every_row()
    {
        var vm = await LoadedAsync();
        vm.ApplySearch("الفيزياء");
        vm.ShowUnwatchedCommand.Execute(null);

        vm.ClearFiltersCommand.Execute(null);

        Assert.Equal(4, vm.Visible.Count);
        Assert.True(vm.ShowingAll);
    }

    [Fact]
    public async Task The_header_counts_what_has_been_watched()
    {
        var vm = await LoadedAsync();

        // ١ من ٤ مكتملة — Arabic-Indic, because it is content.
        Assert.Contains("١", vm.WatchedLabel);
        Assert.Contains("٤", vm.WatchedLabel);
    }

    [Fact]
    public async Task A_student_with_no_courses_gets_the_empty_state_not_an_error()
    {
        var vm = Build("[]");
        await vm.LoadAsync();

        Assert.True(vm.Lectures.IsEmpty);
        Assert.False(vm.Lectures.HasError);
    }

    // ── Plumbing ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Two courses. The first has two units out of display order, to prove the
    /// flattening sorts rather than trusting the payload's sequence.
    /// </summary>
    private const string Courses = """
    [
      {"id":1,"name":"الرياضيات","system_type":"online","units":[
        {"id":102,"name":"الوحدة الثانية","display_order":2,"lessons":[
          {"id":13,"title":"الثالثة","display_order":1,"duration_minutes":20}]},
        {"id":101,"name":"الوحدة الأولى","display_order":1,"lessons":[
          {"id":12,"title":"الثانية","display_order":2,"duration_minutes":30},
          {"id":11,"title":"الأولى","display_order":1,"duration_minutes":24,
           "pdf_file":"https://numberoneschools.com/media/a.pdf"}]}]},
      {"id":2,"name":"الفيزياء","system_type":"online","units":[
        {"id":201,"name":"الحركة","display_order":1,"lessons":[
          {"id":21,"title":"الفيزياء ١","display_order":1}]}]}
    ]
    """;

    private const string Progress = """[{"id":1,"lesson":11,"is_completed":true}]""";

    private static async Task<LecturesViewModel> LoadedAsync()
    {
        var vm = Build(Courses);
        await vm.LoadAsync();
        return vm;
    }

    private static LecturesViewModel Build(string courses)
    {
        var client = new HttpClient(new TreeHandler(courses))
        {
            BaseAddress = new Uri("https://numberoneschools.com/api/"),
        };

        // A real AuthService: the load reads _auth.CurrentUser to pick the
        // courses endpoint, so a null one is a NullReferenceException rather
        // than a test double.
        var auth = new AuthService(client, new Tokens(), new Device());

        return new LecturesViewModel(new StudentApi(client), auth);
    }

    private sealed class Device : IDeviceIdentityProvider
    {
        public string GetDeviceId() => "hw-win-4f2a91c7d0e51b6a";
        public string GetDeviceType() => "Windows";
        public string GetMachineName() => "DESKTOP-A2REKKA";
    }

    private sealed class Tokens : ITokenStore
    {
        public Task<string?> GetAccessTokenAsync() => Task.FromResult<string?>("access");
        public Task<string?> GetRefreshTokenAsync() => Task.FromResult<string?>("refresh");
        public Task SaveAsync(string a, string r) => Task.CompletedTask;
        public Task ClearAsync() => Task.CompletedTask;
    }

    private sealed class TreeHandler(string courses) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var body = request.RequestUri!.AbsolutePath.Contains("my-progress")
                ? Progress
                : courses;

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            });
        }
    }
}
