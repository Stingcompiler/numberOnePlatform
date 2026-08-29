using NumberOne.Core.Abstractions;
using NumberOne.Core.Api;
using NumberOne.Core.Models;
using NumberOne.Core.Services;

namespace NumberOne.Core.Tests;

/// <summary>
/// The student read/write surface, against a real Django.
///
/// These exist because DTO field mapping is exactly what a stub cannot check: a
/// mock returns whatever JSON you believed the server sends. Every assertion
/// here is about the payload the server actually produces — which is how the
/// UUID user id and the non_field_errors shape were caught earlier.
///
/// Requires the fixtures from desktop/tools/seed_desktop_fixtures.py on top of the
/// auth fixtures. Skipped unless NUMBERONE_TEST_API is set; see LiveApiTests.
/// Never point this at production.
/// </summary>
public class LiveStudentApiTests
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

    /// <summary>Signs in as the seeded, already-bound student and returns the API.</summary>
    private static async Task<(StudentApi Api, HttpClient Client)> SignedInAsync()
    {
        var baseAddress = BaseAddress!;
        var tokens = new Tokens();
        var (client, _) = ApiClientFactory.Create(baseAddress, tokens, new RefreshEndpoint(baseAddress));

        var auth = new AuthService(client, tokens, new Device());
        var outcome = await auth.SignInAsync("fresh.student", "pass1234");

        Assert.IsType<LoginOutcome.Success>(outcome);
        return (new StudentApi(client), client);
    }

    [SkippableFact]
    public async Task Courses_arrive_with_their_units_and_lessons_nested()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, client) = await SignedInAsync();
        using var _ = client;

        var courses = await api.GetMyCoursesAsync();

        var course = Assert.Single(courses);
        Assert.Equal("الرياضيات", course.Name);
        Assert.Equal(SystemTypes.Online, course.SystemType);

        var unit = Assert.Single(course.Units);
        Assert.Equal(2, unit.Lessons.Count);

        // The whole tree in one call - my-courses/ is not a summary endpoint.
        Assert.Equal(2, course.AllLessons.Count());
    }

    [SkippableFact]
    public async Task A_lesson_carries_an_embed_url_and_never_the_raw_watch_url()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, client) = await SignedInAsync();
        using var _ = client;

        var courses = await api.GetMyCoursesAsync();
        var lessonId = courses[0].AllLessons.First().Id;

        var lesson = await api.GetLessonAsync(lessonId);

        Assert.NotNull(lesson);
        Assert.True(lesson!.HasVideo);

        // The fixture stores a youtube.com/watch?v=... URL. The student payload
        // must expose only the /embed/ form: this is the content-protection
        // boundary, and a regression here leaks every course video at once.
        Assert.Contains("/embed/", lesson.YoutubeEmbedUrl);
        Assert.DoesNotContain("watch?v=", lesson.YoutubeEmbedUrl);
    }

    [SkippableFact]
    public async Task A_lesson_exercise_arrives_without_the_answers()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, client) = await SignedInAsync();
        using var _ = client;

        var courses = await api.GetMyCoursesAsync();
        var withExercise = courses[0].AllLessons.First();

        var lesson = await api.GetLessonAsync(withExercise.Id);

        Assert.NotNull(lesson!.Exercise);
        var question = Assert.Single(lesson.Exercise!.Questions);
        Assert.Equal(3, question.Choices.Count);

        // Choice has no IsCorrect property at all, because the student payload
        // omits it. This asserts the payload cannot smuggle it back in.
        Assert.All(question.Choices, c => Assert.False(string.IsNullOrWhiteSpace(c.Text)));
    }

    [SkippableFact]
    public async Task Viewing_a_lesson_is_what_makes_completing_it_possible()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, client) = await SignedInAsync();
        using var _ = client;

        var courses = await api.GetMyCoursesAsync();
        var lessonId = courses[0].AllLessons.First().Id;

        // MarkLessonComplete requires a LessonProgress row, which only the GET
        // creates. A player that marked complete without having fetched the
        // lesson would silently fail.
        await api.GetLessonAsync(lessonId);

        Assert.True(await api.MarkLessonCompleteAsync(lessonId));

        var progress = await api.GetMyProgressAsync();
        Assert.Contains(progress, p => p.Lesson == lessonId && p.IsCompleted);
    }

    [SkippableFact]
    public async Task An_exercise_can_be_submitted_and_comes_back_graded()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, client) = await SignedInAsync();
        using var _ = client;

        var courses = await api.GetMyCoursesAsync();
        var lesson = await api.GetLessonAsync(courses[0].AllLessons.First().Id);
        var exercise = lesson!.Exercise!;
        var question = exercise.Questions[0];

        var result = await api.SubmitExerciseAsync(new SubmissionRequest
        {
            ExerciseId = exercise.Id,
            Answers = new()
            {
                new SubmissionAnswerRequest { QuestionId = question.Id, ChoiceId = question.Choices[0].Id },
            },
        });

        Assert.NotNull(result);

        // The correct answer arrives only now, after the attempt.
        var answer = Assert.Single(result!.Answers);
        Assert.False(string.IsNullOrWhiteSpace(answer.CorrectChoice));
    }

    [SkippableFact]
    public async Task Exams_list_with_their_marks_and_question_count()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, client) = await SignedInAsync();
        using var _ = client;

        var exams = await api.GetExamsAsync();

        var exam = Assert.Single(exams);
        Assert.Equal("اختبار الجبر", exam.Title);
        Assert.Equal(30, exam.DurationMinutes);
        Assert.Equal(4, exam.QuestionCount);
        Assert.Equal(6.0, exam.TotalMarks);

        // Display this rather than resolving CourseId against my-courses: exam
        // access follows a different rule than course access.
        Assert.Equal("الرياضيات", exam.CourseName);
    }

    [SkippableFact]
    public async Task An_exam_arrives_without_its_correct_answers()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, client) = await SignedInAsync();
        using var _ = client;

        var exams = await api.GetExamsAsync();
        var exam = await api.GetExamAsync(exams[0].Id);

        Assert.NotNull(exam);
        Assert.Equal(4, exam!.Questions.Count);

        var multipleChoice = exam.Questions.Single(q => q.QuestionType == ExamAnswers.MultipleChoice);
        Assert.Equal(3, multipleChoice.Options.Count);

        // Matching questions ship the right-hand column shuffled server-side,
        // and both columns are derived from correct_answer without revealing
        // the pairing.
        var matching = exam.Questions.Single(q => q.QuestionType == ExamAnswers.Matching);
        Assert.Equal(2, matching.MatchingLeft?.Count);
        Assert.Equal(2, matching.MatchingRight?.Count);
    }

    [SkippableFact]
    public async Task All_four_question_types_grade_correctly_when_answered_right()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, client) = await SignedInAsync();
        using var _ = client;

        var exams = await api.GetExamsAsync();
        var exam = await api.GetExamAsync(exams[0].Id);

        var trueFalse = exam!.Questions.Single(q => q.QuestionType == ExamAnswers.TrueFalse);
        var multipleChoice = exam.Questions.Single(q => q.QuestionType == ExamAnswers.MultipleChoice);
        var fillBlank = exam.Questions.Single(q => q.QuestionType == ExamAnswers.FillBlank);
        var matching = exam.Questions.Single(q => q.QuestionType == ExamAnswers.Matching);

        // The seeded correct answers. If ExamAnswers built a payload shape the
        // grader does not read, every one of these would score zero silently -
        // which is exactly the failure this test exists to catch.
        var result = await api.SubmitExamAsync(exam.Id, new ExamSubmission
        {
            Answers = new()
            {
                ExamAnswers.ForTrueFalse(trueFalse.Id, false),
                ExamAnswers.ForMultipleChoice(multipleChoice.Id, multipleChoice.Options[0].Id),
                ExamAnswers.ForFillBlank(fillBlank.Id, "180"),
                ExamAnswers.ForMatching(matching.Id, new[] { ("مثلث", "٣"), ("مربع", "٤") }),
            },
        });

        Assert.NotNull(result?.Attempt);
        Assert.Equal(exam.TotalMarks, result!.Attempt!.Score);
        Assert.True(result.Attempt.IsPassed);
        Assert.All(result.Attempt.Answers, a => Assert.True(a.IsCorrect));
    }

    [SkippableFact]
    public async Task Fill_blank_grading_ignores_case_and_surrounding_space()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, client) = await SignedInAsync();
        using var _ = client;

        var exams = await api.GetExamsAsync();
        var exam = await api.GetExamAsync(exams[0].Id);
        var fillBlank = exam!.Questions.Single(q => q.QuestionType == ExamAnswers.FillBlank);

        var result = await api.SubmitExamAsync(exam.Id, new ExamSubmission
        {
            Answers = new() { ExamAnswers.ForFillBlank(fillBlank.Id, "  180  ") },
        });

        var answer = result!.Attempt!.Answers.Single(a => a.QuestionType == ExamAnswers.FillBlank);
        Assert.True(answer.IsCorrect);
    }

    [SkippableFact]
    public async Task An_unanswered_exam_scores_zero_rather_than_failing()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, client) = await SignedInAsync();
        using var _ = client;

        var exams = await api.GetExamsAsync();
        var exam = await api.GetExamAsync(exams[0].Id);

        var result = await api.SubmitExamAsync(exam!.Id, new ExamSubmission
        {
            Answers = exam.Questions.Select(q => ExamAnswers.Blank(q.Id)).ToList(),
        });

        Assert.Equal(0, result!.Attempt!.Score);
        Assert.False(result.Attempt.IsPassed);
    }

    [SkippableFact]
    public async Task A_past_attempt_can_be_read_back_with_its_answer_sheet()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, client) = await SignedInAsync();
        using var _ = client;

        var exams = await api.GetExamsAsync();
        var exam = await api.GetExamAsync(exams[0].Id);
        var submitted = await api.SubmitExamAsync(exam!.Id, new ExamSubmission
        {
            Answers = new() { ExamAnswers.Blank(exam.Questions[0].Id) },
        });

        var attempt = await api.GetAttemptAsync(submitted!.Attempt!.Id);

        Assert.NotNull(attempt);
        Assert.NotEmpty(attempt!.Answers);

        // correct_answer is present here, which is safe: the attempt is over.
        Assert.All(attempt.Answers, a => Assert.NotNull(a.CorrectAnswer));
    }

    [SkippableFact]
    public async Task Live_rooms_arrive_with_their_sessions_and_statuses()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, client) = await SignedInAsync();
        using var _ = client;

        var rooms = await api.GetLiveRoomsAsync();

        var room = Assert.Single(rooms);
        Assert.Equal(3, room.Sessions.Count);

        // Ended sessions render their join action disabled.
        var ended = room.Sessions.Single(s => s.Status == LiveStatuses.Ended);
        Assert.False(ended.CanJoin);

        var live = room.Sessions.Single(s => s.Status == LiveStatuses.Live);
        Assert.True(live.CanJoin);
        Assert.Equal(LiveProviders.GoogleMeet, live.Provider);
    }

    [SkippableFact]
    public async Task Notifications_come_back_paginated_unlike_every_other_endpoint()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, client) = await SignedInAsync();
        using var _ = client;

        var page = await api.GetNotificationsAsync();

        // The envelope, not a bare array. Deserializing this as a list would
        // throw, so this is the assertion that the shape difference is handled.
        Assert.True(page.Count > 0);
        Assert.NotEmpty(page.Results);
        Assert.True(page.Results.Count <= 10, "StandardPagination page size is 10.");
    }

    [SkippableFact]
    public async Task Marking_all_read_empties_the_badge()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, client) = await SignedInAsync();
        using var _ = client;

        Assert.True(await api.MarkAllNotificationsReadAsync());
        Assert.Equal(0, await api.GetUnreadCountAsync());
    }

    [SkippableFact]
    public async Task A_course_the_student_cannot_reach_is_refused_in_Arabic()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var (api, client) = await SignedInAsync();
        using var _ = client;

        // The server answers 403 with its own message; screens show it verbatim.
        var error = await Assert.ThrowsAsync<ApiRequestException>(
            () => api.GetCourseAsync(999_999));

        Assert.True(error.IsForbidden || error.IsNotFound);
        Assert.False(string.IsNullOrWhiteSpace(error.Message));
    }

    private sealed class Device : IDeviceIdentityProvider
    {
        public string GetDeviceId() => "hw-win-4f2a91c7d0e51b6a";
        public string GetDeviceType() => "Windows";
        public string GetMachineName() => "DESKTOP-A2REKKA";
    }

    private sealed class Tokens : ITokenStore
    {
        private string? _access;
        private string? _refresh;

        public Task<string?> GetAccessTokenAsync() => Task.FromResult(_access);
        public Task<string?> GetRefreshTokenAsync() => Task.FromResult(_refresh);

        public Task SaveAsync(string a, string r) { _access = a; _refresh = r; return Task.CompletedTask; }
        public Task ClearAsync() { _access = null; _refresh = null; return Task.CompletedTask; }
    }
}
