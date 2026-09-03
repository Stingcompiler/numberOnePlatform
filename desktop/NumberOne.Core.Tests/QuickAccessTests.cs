using NumberOne.Core.Services;
using NumberOne.Core.ViewModels;

namespace NumberOne.Core.Tests;

/// <summary>
/// The dashboard's quick-access tiles.
///
/// The requirement was that every tile leads somewhere real, so each one is
/// asserted to raise its own navigation request — a tile wired to the wrong
/// command, or to none, is silent at runtime and looks identical until it is
/// clicked.
///
/// The events are what the shell listens to; the commands are what the tiles
/// bind to. Testing the pair together is what makes "this tile opens that page"
/// a fact rather than an intention.
/// </summary>
public class QuickAccessTests
{
    [Fact]
    public void Every_tile_reaches_its_own_page()
    {
        var vm = Home();

        var reached = new List<string>();

        vm.ShowCoursesRequested += (_, _) => reached.Add("courses");
        vm.ShowLiveRequested += (_, _) => reached.Add("live");
        vm.ShowExamsRequested += (_, _) => reached.Add("exams");
        vm.ShowResultsRequested += (_, _) => reached.Add("results");
        vm.ShowNotificationsRequested += (_, _) => reached.Add("notifications");
        vm.ShowProfileRequested += (_, _) => reached.Add("profile");

        vm.ShowCoursesCommand.Execute(null);
        vm.ShowLiveCommand.Execute(null);
        vm.ShowExamsCommand.Execute(null);
        vm.ShowResultsCommand.Execute(null);
        vm.ShowNotificationsCommand.Execute(null);
        vm.ShowProfileCommand.Execute(null);

        Assert.Equal(
            new[] { "courses", "live", "exams", "results", "notifications", "profile" },
            reached);
    }

    [Theory]
    [InlineData("courses")]
    [InlineData("live")]
    [InlineData("exams")]
    [InlineData("results")]
    [InlineData("notifications")]
    [InlineData("profile")]
    public void A_tile_raises_only_its_own_route(string tile)
    {
        // Guards the copy-paste failure this markup invites: six near-identical
        // tiles where one keeps the command from the tile above it, which no
        // build and no screenshot would catch.
        var vm = Home();
        var reached = new List<string>();

        vm.ShowCoursesRequested += (_, _) => reached.Add("courses");
        vm.ShowLiveRequested += (_, _) => reached.Add("live");
        vm.ShowExamsRequested += (_, _) => reached.Add("exams");
        vm.ShowResultsRequested += (_, _) => reached.Add("results");
        vm.ShowNotificationsRequested += (_, _) => reached.Add("notifications");
        vm.ShowProfileRequested += (_, _) => reached.Add("profile");

        Command(vm, tile).Execute(null);

        Assert.Equal(new[] { tile }, reached);
    }

    [Fact]
    public void The_tiles_need_no_data_to_work()
    {
        // They are navigation, not content. A dashboard whose sections all
        // failed must still get the student to another screen — that is
        // precisely when they need a way out.
        var vm = Home();

        Assert.False(vm.Courses.HasData);

        var reached = false;
        vm.ShowCoursesRequested += (_, _) => reached = true;
        vm.ShowCoursesCommand.Execute(null);

        Assert.True(reached);
    }

    private static System.Windows.Input.ICommand Command(HomeViewModel vm, string tile) => tile switch
    {
        "courses" => vm.ShowCoursesCommand,
        "live" => vm.ShowLiveCommand,
        "exams" => vm.ShowExamsCommand,
        "results" => vm.ShowResultsCommand,
        "notifications" => vm.ShowNotificationsCommand,
        "profile" => vm.ShowProfileCommand,
        _ => throw new ArgumentOutOfRangeException(nameof(tile)),
    };

    private static HomeViewModel Home() =>
        new(new StudentApi(new HttpClient(new DeadHandler())
        {
            BaseAddress = new Uri("https://numberoneschools.com/api/"),
        }), null!);

    private sealed class DeadHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => throw new HttpRequestException("offline");
    }
}
