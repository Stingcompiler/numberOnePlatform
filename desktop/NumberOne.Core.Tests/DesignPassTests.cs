using NumberOne.Core.Services;
using NumberOne.Core.Models;
using NumberOne.Core.ViewModels;

namespace NumberOne.Core.Tests;

/// <summary>
/// The behaviour the v2 design pass introduced: Arabic number agreement, the
/// top-bar search, the results pager and its sorts, and the derived dashboard
/// captions.
///
/// These are hermetic — no server, no HTTP. What they guard is the arithmetic
/// and the wording, which is exactly where a design pass goes wrong quietly.
/// </summary>
public class ArabicCountingTests
{
    [Theory]
    // Arabic has four number forms where English has two, and the design's own
    // copy uses all of them. Eleven and above returns to the SINGULAR — "١٢
    // جلسة", never "١٢ جلسات" — which is the form most often got wrong.
    [InlineData(0, "لا توجد جلسات")]
    [InlineData(1, "جلسة واحدة")]
    [InlineData(2, "جلستان")]
    [InlineData(3, "٣ جلسات")]
    [InlineData(10, "١٠ جلسات")]
    [InlineData(11, "١١ جلسة")]
    [InlineData(42, "٤٢ جلسة")]
    public void Counting_follows_Arabic_number_agreement(int n, string expected)
    {
        Assert.Equal(expected, UiText.Count(n, "جلسة", "جلستان", "جلسات"));
    }

    [Fact]
    public void The_one_form_carries_the_gender_the_noun_cannot()
    {
        // جلسة is feminine and takes واحدة; كورس is masculine and takes واحد.
        // Without the override every singular reads as feminine.
        Assert.Equal("جلسة واحدة", UiText.Count(1, "جلسة", "جلستان", "جلسات"));
        Assert.Equal("كورس واحد", UiText.Count(1, "كورس", "كورسان", "كورسات", "واحد"));
    }

    [Fact]
    public void Digits_in_counted_nouns_are_arabic_indic()
    {
        // Content digits are Arabic-Indic throughout the app; only technical
        // values — device ids, timestamps — keep Latin ones.
        Assert.DoesNotContain('5', UiText.Count(5, "سؤال", "سؤالان", "أسئلة", "واحد"));
    }
}

public class CoursesSearchTests
{
    private static CourseRow Row(string name, string teacher) => new()
    {
        Id = 1,
        Name = name,
        TeacherName = teacher,
        SystemTypeDisplay = "عبر الإنترنت",
        IsOnline = true,
        LessonCount = 4,
        UnitCount = 2,
        CompletedCount = 1,
    };

    [Fact]
    public void The_content_label_counts_units_and_lessons_separately()
    {
        var row = Row("الرياضيات", "أ. سالم");

        Assert.Equal("وحدتان · ٤ محاضرات", row.ContentLabel);
    }

    [Fact]
    public void Progress_is_whole_percent_over_the_lesson_count()
    {
        var row = Row("الرياضيات", "أ. سالم");

        Assert.Equal(25, row.Percent);
        Assert.Equal("٢٥٪", row.PercentLabel);
        Assert.Equal(0.25, row.Fraction);
    }

    [Fact]
    public void A_course_with_no_lessons_is_zero_percent_not_a_division_by_zero()
    {
        var row = Row("جديد", "—") with { LessonCount = 0, CompletedCount = 0 };

        Assert.Equal(0, row.Percent);
    }

    [Fact]
    public void An_unassigned_teacher_reads_as_a_dash_rather_than_blank()
    {
        var course = new Course { Id = 1, Name = "الرياضيات", TeacherName = null };

        var row = CourseRow.From(course, new HashSet<int>());

        Assert.Equal("—", row.TeacherName);
    }
}

public class ExamSummaryLabelTests
{
    private static ExamSummary Exam(params ExamAttemptSummary[] attempts) => new()
    {
        Id = 1,
        Title = "اختبار الجبر",
        CourseName = "الرياضيات",
        DurationMinutes = 30,
        QuestionCount = 12,
        TotalMarks = 50,
        Attempts = attempts.ToList(),
    };

    [Fact]
    public void An_unattempted_exam_offers_to_start_and_shows_no_score()
    {
        var exam = Exam();

        Assert.Equal("ابدأ", exam.StartLabel);
        Assert.Equal("", exam.BestScoreLabel);
        Assert.Equal("", exam.BestVerdictLabel);
    }

    [Fact]
    public void An_attempted_exam_offers_a_retry_because_nothing_limits_attempts()
    {
        // There is no server-side attempt limit: exams/views.py creates a new
        // ExamAttempt on every submit. Offering only "ابدأ" would misstate that.
        var exam = Exam(new ExamAttemptSummary { Id = 7, Score = 42, Percentage = 84, IsPassed = true });

        Assert.Equal("إعادة المحاولة", exam.StartLabel);
    }

    [Fact]
    public void The_completed_row_reports_the_best_attempt_not_the_last()
    {
        var exam = Exam(
            new ExamAttemptSummary { Id = 1, Score = 20, Percentage = 40, IsPassed = false },
            new ExamAttemptSummary { Id = 2, Score = 46, Percentage = 92, IsPassed = true },
            new ExamAttemptSummary { Id = 3, Score = 30, Percentage = 60, IsPassed = false });

        Assert.Equal("٤٦ / ٥٠", exam.BestScoreLabel);
        Assert.True(exam.BestAttemptPassed);
        Assert.Equal("ناجح", exam.BestVerdictLabel);
    }

    [Fact]
    public void Duration_and_question_count_are_counted_nouns_not_bare_numbers()
    {
        var exam = Exam();

        Assert.Equal("٣٠ دقيقة", exam.DurationLabel);
        Assert.Equal("١٢ سؤال", exam.QuestionCountLabel);
    }
}

public class ResultsPagingTests
{
    /// <summary>
    /// N attempts, one per exam, built as the exams endpoint really returns
    /// them: results are derived from /exams/student/list/, not from a results
    /// endpoint, and every attempt rides along on that payload.
    ///
    /// Fed through the real HTTP path rather than by seeding the section, so
    /// the projection is exercised as well as the paging.
    /// </summary>
    private static async Task<ResultsViewModel> LoadedAsync(int rowCount)
    {
        var exams = string.Join(",", Enumerable.Range(1, rowCount).Select(i => $$"""
        {"id":{{i}},"title":"اختبار {{i}}","duration_minutes":30,"passing_score":25,
         "course_id":{{i}},"course_name":"{{(i % 2 == 0 ? "الرياضيات" : "الفيزياء")}}",
         "total_marks":50,"question_count":10,
         "attempts":[{"id":{{i}},"score":{{i}},"percentage":{{i * 5}},
                      "is_passed":{{(i % 3 != 0).ToString().ToLowerInvariant()}},
                      "submitted_at":"2026-01-{{i:00}}T12:00:00Z"}]}
        """));

        var client = new HttpClient(new CannedHandler($"[{exams}]"))
        {
            BaseAddress = new Uri("https://numberoneschools.com/api/"),
        };

        var vm = new ResultsViewModel(new StudentApi(client));
        await vm.LoadAsync();

        return vm;
    }

    private sealed class CannedHandler : HttpMessageHandler
    {
        private readonly string _body;

        public CannedHandler(string body) => _body = body;

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken ct)
            => Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new StringContent(_body, System.Text.Encoding.UTF8, "application/json"),
            });
    }

    [Fact]
    public async Task A_page_holds_eight_rows_and_the_rest_spill_onto_the_next()
    {
        var vm = await LoadedAsync(13);

        Assert.Equal(ResultsViewModel.PageSize, vm.PageRows.Count);
        Assert.Equal(2, vm.PageCount);

        vm.NextPageCommand.Execute(null);

        Assert.Equal(5, vm.PageRows.Count);
        Assert.False(vm.CanGoForward);
    }

    [Fact]
    public async Task The_pager_cannot_walk_off_either_end()
    {
        var vm = await LoadedAsync(3);

        Assert.False(vm.CanGoBack);
        Assert.False(vm.CanGoForward);

        vm.NextPageCommand.Execute(null);
        vm.PreviousPageCommand.Execute(null);

        Assert.Equal(1, vm.Page);
    }

    [Fact]
    public async Task Filtering_returns_to_page_one()
    {
        // Page 2 of an unfiltered table is usually past the end of a filtered
        // one, and an empty page reads as "no results" rather than "wrong page".
        var vm = await LoadedAsync(13);
        vm.NextPageCommand.Execute(null);
        Assert.Equal(2, vm.Page);

        vm.FilterFailedCommand.Execute(null);

        Assert.Equal(1, vm.Page);
    }

    [Fact]
    public async Task Each_header_toggles_its_own_column_between_directions()
    {
        var vm = await LoadedAsync(5);

        vm.SortByScoreCommand.Execute(null);
        Assert.Equal(ResultSort.ScoreDescending, vm.Sort);
        Assert.Equal(25.0, vm.PageRows[0].Percentage);

        vm.SortByScoreCommand.Execute(null);
        Assert.Equal(ResultSort.ScoreAscending, vm.Sort);
        Assert.Equal(5.0, vm.PageRows[0].Percentage);
    }

    [Fact]
    public async Task Switching_columns_starts_that_column_at_its_natural_direction()
    {
        var vm = await LoadedAsync(5);

        vm.SortByScoreCommand.Execute(null);
        vm.SortByTitleCommand.Execute(null);

        // Names ascend, scores and dates descend.
        Assert.Equal(ResultSort.TitleAscending, vm.Sort);
    }

    [Fact]
    public async Task Search_narrows_the_rows_and_the_shown_label_says_by_how_much()
    {
        var vm = await LoadedAsync(13);

        vm.ApplySearch("الرياضيات");

        Assert.Equal(6, vm.Visible.Count);
        Assert.Contains("٦", vm.ShownLabel);
        Assert.Contains("١٣", vm.ShownLabel);
    }

    [Fact]
    public async Task A_search_that_matches_nothing_is_a_filter_result_not_an_empty_record()
    {
        // Distinct states with distinct remedies: clear the search, versus sit
        // an exam. Collapsing them would tell a student with a full record that
        // they have never taken a test.
        var vm = await LoadedAsync(5);

        vm.ApplySearch("لا يوجد");

        Assert.True(vm.IsFilteredEmpty);
        Assert.False(vm.Results.IsEmpty);
    }

    [Fact]
    public async Task The_best_attempt_card_names_the_exam_it_came_from()
    {
        var vm = await LoadedAsync(5);

        Assert.Equal("٥ / ٥٠", vm.BestScoreLabel);
        Assert.Equal("اختبار 5", vm.BestExamName);
    }

    [Fact]
    public async Task Clearing_the_filters_restores_every_row()
    {
        var vm = await LoadedAsync(13);
        vm.ApplySearch("الرياضيات");
        vm.FilterPassedCommand.Execute(null);

        vm.ClearFiltersCommand.Execute(null);

        Assert.Equal(13, vm.Visible.Count);
        Assert.True(vm.IsAllSelected);
    }
}

public class LiveSessionLabelTests
{
    private static LiveSession Session(string provider, string status) => new()
    {
        Id = 1,
        SessionName = "مراجعة",
        Provider = provider,
        Status = status,
        StreamUrl = "https://zoom.us/j/123",
    };

    [Theory]
    [InlineData("zoom", "Zoom")]
    [InlineData("google_meet", "Google Meet")]
    [InlineData("teams", "Teams")]
    [InlineData("youtube", "YouTube")]
    public void The_provider_is_named_by_its_product(string raw, string expected)
    {
        Assert.Equal(expected, Session(raw, "live").ProviderLabel);
    }

    [Fact]
    public void A_provider_added_after_this_client_shipped_reads_as_itself()
    {
        // Not "أخرى": a new provider on the server should surface under its own
        // name rather than as unknown, which would look like a client bug.
        var session = new LiveSession
        {
            Id = 1,
            Provider = "webex",
            ProviderDisplay = "Webex",
            Status = "live",
        };

        Assert.Equal("Webex", session.ProviderLabel);
    }

    [Theory]
    [InlineData("live", "دخول")]
    [InlineData("upcoming", "دخول")]
    [InlineData("ended", "انتهت")]
    [InlineData("archived", "مؤرشفة")]
    public void A_finished_session_states_its_state_where_the_link_would_be(
        string status, string expected)
    {
        Assert.Equal(expected, Session("zoom", status).ActionLabel);
    }

    [Fact]
    public void Only_a_running_session_carries_the_pulsing_dot()
    {
        Assert.True(Session("zoom", "live").IsLiveNow);
        Assert.False(Session("zoom", "upcoming").IsLiveNow);
    }

    [Fact]
    public void A_session_with_no_schedule_shows_no_time_rather_than_a_zero_clock()
    {
        Assert.Equal("", Session("zoom", "live").TimeLabel);
    }
}

public class NotificationTimeTests
{
    [Fact]
    public void Todays_notifications_show_a_clock_and_older_ones_a_date()
    {
        // Inside a list already grouped by day, repeating the date on every row
        // says nothing; the time is what distinguishes them.
        var today = new Notification { Id = 1, CreatedAt = DateTimeOffset.Now };
        var old = new Notification { Id = 2, CreatedAt = DateTimeOffset.Now.AddDays(-3) };

        Assert.Contains(":", today.TimeLabel);
        Assert.Contains("/", old.TimeLabel);
    }
}
