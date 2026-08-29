using System.Net;
using System.Text;
using NumberOne.Core.Api;
using NumberOne.Core.Models;
using NumberOne.Core.Services;
using NumberOne.Core.ViewModels;

namespace NumberOne.Core.Tests;

/// <summary>
/// The exam runner. The clock and the in-flight attempt are entirely
/// client-side — the server writes started_at at submit time — so everything
/// that protects a student's work has to be protected here.
/// </summary>
public class ExamRunnerViewModelTests
{
    [Fact]
    public async Task The_countdown_starts_at_the_exams_duration()
    {
        var h = new Harness();
        await h.Runner.LoadAsync();

        Assert.Equal(TimeSpan.FromMinutes(30), h.Runner.Remaining);
        Assert.Equal("٣٠:٠٠", h.Runner.RemainingLabel);
    }

    [Fact]
    public async Task Advancing_with_nothing_selected_warns_instead_of_recording_a_blank()
    {
        // A blank scores zero. Moving on silently would cost marks the student
        // never knowingly gave up.
        var h = new Harness();
        await h.Runner.LoadAsync();

        string? warning = null;
        h.Runner.Warned += (_, text) => warning = text;

        await h.Runner.NextCommand.ExecuteAsync(null);

        Assert.Equal("اختر إجابة للمتابعة", warning);
        Assert.Equal(0, h.Runner.QuestionIndex);
    }

    [Fact]
    public async Task Answering_then_advancing_moves_on()
    {
        var h = new Harness();
        await h.Runner.LoadAsync();

        h.Runner.Answer(ExamAnswers.ForTrueFalse(h.Runner.CurrentQuestion!.Id, true));
        await h.Runner.NextCommand.ExecuteAsync(null);

        Assert.Equal(1, h.Runner.QuestionIndex);
        Assert.Equal("سؤال ٢ من ٣", h.Runner.QuestionLabel);
    }

    [Fact]
    public async Task The_last_question_asks_for_confirmation_rather_than_submitting()
    {
        // Submitting is final, so it goes through the shared confirm dialog.
        var h = new Harness();
        await h.Runner.LoadAsync();

        foreach (var question in h.Runner.Questions)
            h.Runner.Answer(ExamAnswers.ForTrueFalse(question.Id, true));

        h.Runner.QuestionIndex = h.Runner.Questions.Count - 1;

        var confirmationRequested = false;
        h.Runner.RequestSubmitConfirmation += (_, _) => confirmationRequested = true;

        await h.Runner.NextCommand.ExecuteAsync(null);

        Assert.True(confirmationRequested);
        Assert.False(h.Runner.HasResult);
    }

    [Fact]
    public async Task Going_back_is_possible_but_not_past_the_first_question()
    {
        var h = new Harness();
        await h.Runner.LoadAsync();

        h.Runner.PreviousCommand.Execute(null);
        Assert.Equal(0, h.Runner.QuestionIndex);
        Assert.True(h.Runner.IsFirstQuestion);
    }

    [Fact]
    public async Task Unanswered_questions_are_submitted_explicitly_as_blanks()
    {
        // The server treats a missing question as blank anyway, but sending them
        // keeps the submitted count matching what the student actually saw.
        var h = new Harness();
        await h.Runner.LoadAsync();

        h.Runner.Answer(ExamAnswers.ForTrueFalse(h.Runner.Questions[0].Id, true));
        await h.Runner.SubmitAsync();

        Assert.Equal(3, h.Server.LastSubmittedAnswerCount);
    }

    [Fact]
    public async Task Running_out_of_time_submits_what_the_student_had()
    {
        // Losing the attempt entirely would be the worst outcome of a clock
        // nothing on the server is enforcing.
        var h = new Harness();
        await h.Runner.LoadAsync();

        h.Runner.Answer(ExamAnswers.ForTrueFalse(h.Runner.Questions[0].Id, true));

        await h.Runner.TickAsync(TimeSpan.FromMinutes(31));

        Assert.True(h.Runner.IsTimeUp);
        Assert.Equal("٠٠:٠٠", h.Runner.RemainingLabel);
        Assert.True(h.Runner.HasResult);
        Assert.Equal(1, h.Server.SubmitCount);
    }

    [Fact]
    public async Task The_clock_stops_once_a_result_exists()
    {
        var h = new Harness();
        await h.Runner.LoadAsync();

        await h.Runner.SubmitAsync();
        var remaining = h.Runner.Remaining;

        await h.Runner.TickAsync(TimeSpan.FromMinutes(5));

        Assert.Equal(remaining, h.Runner.Remaining);
        Assert.Equal(1, h.Server.SubmitCount);
    }

    [Fact]
    public async Task Submitting_twice_does_nothing_the_second_time()
    {
        var h = new Harness();
        await h.Runner.LoadAsync();

        await h.Runner.SubmitAsync();
        await h.Runner.SubmitAsync();

        Assert.Equal(1, h.Server.SubmitCount);
    }

    [Fact]
    public async Task The_result_reads_as_a_score_out_of_the_exam_total()
    {
        var h = new Harness();
        await h.Runner.LoadAsync();

        await h.Runner.SubmitAsync();

        Assert.Equal("ناجح", h.Runner.VerdictLabel);
        Assert.Equal("٤ / ٦", h.Runner.ScoreLabel);
    }

    [Fact]
    public async Task Questions_follow_display_order_not_serialisation_order()
    {
        var h = new Harness();
        await h.Runner.LoadAsync();

        Assert.Equal(new[] { 1, 2, 3 }, h.Runner.Questions.Select(q => q.DisplayOrder));
    }

    private sealed class Harness
    {
        public StubServer Server { get; } = new();
        public ExamRunnerViewModel Runner { get; }

        public Harness()
        {
            var client = new HttpClient(Server) { BaseAddress = new Uri("https://numberoneschools.com/api/") };
            Runner = new ExamRunnerViewModel(new StudentApi(client), 1);
        }
    }

    private sealed class StubServer : HttpMessageHandler
    {
        public int SubmitCount { get; private set; }
        public int LastSubmittedAnswerCount { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var path = request.RequestUri!.AbsolutePath;

            if (path.Contains("/submit/"))
            {
                SubmitCount++;

                var body = await request.Content!.ReadAsStringAsync(ct);
                using var doc = System.Text.Json.JsonDocument.Parse(body);
                LastSubmittedAnswerCount = doc.RootElement.GetProperty("answers").GetArrayLength();

                return Json("""
                {"detail":"ok","attempt":{"id":7,"score":4.0,"percentage":66.7,"is_passed":true,
                 "exam_title":"اختبار","total_marks":6.0,"answers":[]}}
                """);
            }

            // Deliberately out of display order.
            return Json("""
            {"id":1,"course":1,"course_name":"الرياضيات","title":"اختبار الجبر",
             "duration_minutes":30,"passing_score":3.0,"total_marks":6.0,"question_count":3,
             "questions":[
               {"id":30,"question_type":"true_false","text":"ج","marks":2.0,"display_order":3},
               {"id":10,"question_type":"true_false","text":"أ","marks":2.0,"display_order":1},
               {"id":20,"question_type":"true_false","text":"ب","marks":2.0,"display_order":2}]}
            """);
        }

        private static HttpResponseMessage Json(string body) => new(HttpStatusCode.OK)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
    }
}
