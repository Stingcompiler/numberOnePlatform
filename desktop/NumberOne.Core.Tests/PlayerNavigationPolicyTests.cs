using NumberOne.Core.Services;
using NumberOne.Core.ViewModels;

namespace NumberOne.Core.Tests;

/// <summary>
/// The rule that keeps a student inside the app.
///
/// This is content protection, not presentation, so it is tested branch by
/// branch and by destination rather than by a couple of happy paths. Each case
/// below is a real way out of a lecture: the watch page behind YouTube's logo,
/// the channel behind its avatar, a share link, a redirect, a new window.
///
/// The policy is an ALLOWLIST. That is the property worth defending here — a
/// YouTube path nobody anticipated is refused by default rather than permitted,
/// so the app does not depend on having enumerated every exit YouTube offers
/// today or adds tomorrow.
/// </summary>
public class PlayerNavigationPolicyTests
{
    private static readonly Uri Player =
        new("https://numberoneschools.com/api/academic/player/");

    // ── The main frame ───────────────────────────────────────────────────────

    [Fact]
    public void The_lecture_page_itself_is_allowed()
    {
        Assert.True(PlayerNavigationPolicy.AllowsTopLevel(
            Player, "https://numberoneschools.com/api/academic/player/?v=dQw4w9WgXcQ"));
    }

    [Theory]
    // Every one of these is reachable from YouTube's own chrome, and every one
    // takes the student out of the lecture.
    [InlineData("https://www.youtube.com/watch?v=dQw4w9WgXcQ")]
    [InlineData("https://youtu.be/dQw4w9WgXcQ")]
    [InlineData("https://www.youtube.com/channel/UC123")]
    [InlineData("https://www.youtube.com/@someteacher")]
    [InlineData("https://www.youtube.com/results?search_query=x")]
    [InlineData("https://www.youtube.com/")]
    [InlineData("https://www.youtube.com/embed/dQw4w9WgXcQ")]
    [InlineData("https://accounts.google.com/signin")]
    public void No_youtube_destination_may_take_over_the_window(string url)
    {
        Assert.False(PlayerNavigationPolicy.AllowsTopLevel(Player, url));
    }

    [Theory]
    // A host that merely looks like the school's, and a path on the real host
    // that is not the player. Both are refused: the check is host AND path.
    [InlineData("https://numberoneschools.com.evil.test/api/academic/player/")]
    [InlineData("https://evil.test/api/academic/player/")]
    [InlineData("https://numberoneschools.com/admin/")]
    [InlineData("https://numberoneschools.com/api/academic/my-courses/")]
    public void A_lookalike_host_or_a_different_path_is_refused(string url)
    {
        Assert.False(PlayerNavigationPolicy.AllowsTopLevel(Player, url));
    }

    [Theory]
    // Schemes that hand the destination to the operating system rather than to
    // the web view — the app would be left behind entirely.
    [InlineData("file:///C:/Windows/System32/")]
    [InlineData("ms-windows-store://home")]
    [InlineData("javascript:window.open('https://youtube.com')")]
    [InlineData("data:text/html,<a href=https://youtube.com>x</a>")]
    [InlineData("vnd.youtube://dQw4w9WgXcQ")]
    public void Only_http_and_https_are_considered_at_all(string url)
    {
        Assert.False(PlayerNavigationPolicy.AllowsTopLevel(Player, url));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not a url")]
    [InlineData("/relative/path")]
    public void Anything_unparseable_is_refused_rather_than_assumed_safe(string? url)
    {
        Assert.False(PlayerNavigationPolicy.AllowsTopLevel(Player, url));
    }

    [Fact]
    public void About_blank_stays_allowed_because_the_control_starts_there()
    {
        // Refusing this would break the web view before it ever loaded a
        // lecture — it is how the control initialises and how a handler resets
        // it between lessons.
        Assert.True(PlayerNavigationPolicy.AllowsTopLevel(Player, "about:blank"));
    }

    [Fact]
    public void The_host_comparison_ignores_case()
    {
        Assert.True(PlayerNavigationPolicy.AllowsTopLevel(
            Player, "https://NumberOneSchools.com/api/academic/player/?v=abc123"));
    }

    // ── The embed frame ──────────────────────────────────────────────────────

    [Theory]
    [InlineData("https://www.youtube.com/embed/dQw4w9WgXcQ")]
    [InlineData("https://www.youtube.com/embed/dQw4w9WgXcQ?controls=0&rel=0")]
    [InlineData("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")]
    [InlineData("https://www.youtube.com/s/player/abc/player.js")]
    [InlineData("https://www.youtube.com/youtubei/v1/player")]
    public void The_frame_may_go_where_the_video_actually_lives(string url)
    {
        Assert.True(PlayerNavigationPolicy.AllowsFrame(url));
    }

    [Theory]
    // Same host as the embed, and all of them a way out. This is why the frame
    // rule filters by path rather than trusting youtube.com wholesale.
    [InlineData("https://www.youtube.com/watch?v=dQw4w9WgXcQ")]
    [InlineData("https://www.youtube.com/channel/UC123")]
    [InlineData("https://www.youtube.com/results?search_query=x")]
    [InlineData("https://www.youtube.com/playlist?list=PL1")]
    [InlineData("https://www.youtube.com/shorts/abc123")]
    [InlineData("https://www.youtube.com/live/abc123")]
    [InlineData("https://www.youtube.com/")]
    [InlineData("https://youtu.be/dQw4w9WgXcQ")]
    public void The_frame_may_not_go_anywhere_a_student_could_browse_from(string url)
    {
        Assert.False(PlayerNavigationPolicy.AllowsFrame(url));
    }

    [Theory]
    [InlineData("https://evil.test/embed/dQw4w9WgXcQ")]
    [InlineData("https://youtube.com.evil.test/embed/abc")]
    public void An_embed_path_on_the_wrong_host_is_still_refused(string url)
    {
        // The path allowlist is not a substitute for the host check; a page
        // anywhere could serve "/embed/" and inherit the frame's trust.
        Assert.False(PlayerNavigationPolicy.AllowsFrame(url));
    }

    // ── New windows ──────────────────────────────────────────────────────────

    [Fact]
    public void A_new_window_is_never_granted()
    {
        // "Watch on YouTube", the share sheet and a middle-click all arrive as
        // a new-window request. There is no destination that makes one
        // acceptable, so this takes no argument at all.
        Assert.False(PlayerNavigationPolicy.AllowsNewWindow());
    }
}

/// <summary>
/// What the student is told when the player refuses to leave.
/// </summary>
public class BlockedNavigationMessageTests
{
    [Fact]
    public void The_first_refusal_is_reported()
    {
        var vm = Player();

        ToastMessage? toast = null;
        vm.Toasted += (_, message) => toast = message;

        vm.ReportBlockedNavigation();

        Assert.NotNull(toast);
        Assert.Equal(LessonViewModel.NavigationBlockedMessage, toast!.Text);
    }

    [Fact]
    public void A_burst_of_refusals_produces_one_message_not_a_stack_of_them()
    {
        // One click on YouTube's chrome can fire several attempts — the anchor,
        // a script, a new-window request. Three identical toasts would read as
        // something breaking rather than a rule being applied.
        var vm = Player();

        var count = 0;
        vm.Toasted += (_, _) => count++;

        vm.ReportBlockedNavigation();
        vm.ReportBlockedNavigation();
        vm.ReportBlockedNavigation();

        Assert.Equal(1, count);
    }

    [Fact]
    public void The_message_states_the_rule_rather_than_apologising_for_a_failure()
    {
        // The wording matters: this is the app working as the school intends.
        Assert.Contains("داخل التطبيق", LessonViewModel.NavigationBlockedMessage);
        Assert.DoesNotContain("خطأ", LessonViewModel.NavigationBlockedMessage);
        Assert.DoesNotContain("تعذّر", LessonViewModel.NavigationBlockedMessage);
    }

    private static LessonViewModel Player() =>
        new(null!, null!, new Uri("https://numberoneschools.com/api/"), 1, 1);
}
