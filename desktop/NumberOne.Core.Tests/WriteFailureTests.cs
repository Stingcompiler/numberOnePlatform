using System.Net;
using System.Text;
using NumberOne.Core.Services;
using NumberOne.Core.ViewModels;

namespace NumberOne.Core.Tests;

/// <summary>
/// What the write paths do when the connection dies under them.
///
/// Reads have always gone through SectionState, which catches transport
/// failures and offers a retry. The writes did not: marking a lecture complete,
/// submitting an exercise, marking a notification read and submitting an exam
/// all called the API bare, so a dropped connection threw straight out of a
/// command.
///
/// The exam submit was the one that mattered. It is reached from a countdown
/// whose Tick handler is `async void`, where an exception has nowhere to go and
/// takes the process with it — at the moment a student's time expires and their
/// answers are still unsent.
///
/// These tests fail the transport deliberately and assert that nothing throws
/// and nothing is silently lost.
/// </summary>
public class WriteFailureTests
{
    // ── The exam ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task A_dropped_connection_during_the_exam_submit_does_not_throw()
    {
        var vm = await RunnerAsync(new DropsOnWriteHandler());

        // The countdown reaches this through `async void`. Throwing here is the
        // difference between a message and a crash.
        var boom = await Record.ExceptionAsync(() => vm.SubmitAsync());

        Assert.Null(boom);
    }

    [Fact]
    public async Task A_failed_submit_says_so_and_keeps_the_runner_on_screen()
    {
        var vm = await RunnerAsync(new DropsOnWriteHandler());

        await vm.SubmitAsync();

        Assert.True(vm.HasSubmitError);
        Assert.False(vm.HasResult);

        // Still running, so the answers and the submit control are still there.
        Assert.True(vm.IsRunning);
    }

    [Fact]
    public async Task An_aborted_socket_is_treated_as_a_transport_failure_not_a_bug()
    {
        // The shape the app actually produces when a request is killed:
        // TaskCanceledException wrapping IOException wrapping SocketException.
        // Only the outermost type is matched by a plain `is` check, which is
        // why the filter names IOException too.
        var vm = await RunnerAsync(new AbortsSocketHandler());

        var boom = await Record.ExceptionAsync(() => vm.SubmitAsync());

        Assert.Null(boom);
        Assert.True(vm.HasSubmitError);
    }

    [Fact]
    public async Task Retrying_after_a_failure_sends_the_same_answers_and_succeeds()
    {
        // The point of keeping the runner alive: the paper is not lost.
        var handler = new FailsOnceThenSucceedsHandler();
        var vm = await RunnerAsync(handler);

        await vm.SubmitAsync();
        Assert.True(vm.HasSubmitError);

        await vm.SubmitAsync();

        Assert.True(vm.HasResult);
        Assert.False(vm.HasSubmitError);
        Assert.Equal(2, handler.Submits);
    }

    [Fact]
    public async Task A_second_submit_is_refused_while_one_is_already_in_flight()
    {
        // The countdown and the student's own button can both fire. Two
        // submits are two attempts on the academic record.
        var handler = new BlockingWriteHandler();
        var vm = await RunnerAsync(handler);

        var first = vm.SubmitAsync();
        await vm.SubmitAsync();          // returns immediately, IsSubmitting is set

        handler.Release();
        await first;

        Assert.Equal(1, handler.Submits);
    }

    // ── The lecture ──────────────────────────────────────────────────────────

    [Fact]
    public async Task Marking_a_lecture_complete_offline_reports_rather_than_throws()
    {
        var vm = Lesson(new DropsOnWriteHandler());
        await vm.LoadAsync();

        ToastMessage? toast = null;
        vm.Toasted += (_, m) => toast = m;

        var boom = await Record.ExceptionAsync(() => vm.MarkCompleteCommand.ExecuteAsync(null));

        Assert.Null(boom);
        Assert.False(vm.IsCompleted);
        Assert.Equal(ToastKind.Error, toast?.Kind);
    }

    // ── Notifications ────────────────────────────────────────────────────────

    [Fact]
    public async Task Marking_all_read_offline_does_not_throw()
    {
        var api = new StudentApi(Client(new DropsOnWriteHandler()));
        var vm = new NotificationsViewModel(api);

        var boom = await Record.ExceptionAsync(() => vm.MarkAllReadCommand.ExecuteAsync(null));

        Assert.Null(boom);
    }

    // ── The filter itself ────────────────────────────────────────────────────

    [Theory]
    [InlineData(typeof(HttpRequestException))]
    [InlineData(typeof(TaskCanceledException))]
    [InlineData(typeof(OperationCanceledException))]
    [InlineData(typeof(IOException))]
    public void Transport_failures_are_recognised(Type type)
    {
        var ex = (Exception)Activator.CreateInstance(type)!;

        Assert.True(ApiAttempt.IsTransport(ex));
    }

    [Theory]
    [InlineData(typeof(InvalidOperationException))]
    [InlineData(typeof(NullReferenceException))]
    public void A_real_bug_is_not_mistaken_for_a_dropped_connection(Type type)
    {
        // Swallowing these would hide defects behind "no connection", which is
        // exactly how a broken screen comes to look like a network problem.
        var ex = (Exception)Activator.CreateInstance(type)!;

        Assert.False(ApiAttempt.IsTransport(ex));
    }

    [Fact]
    public async Task A_cancellation_the_caller_asked_for_carries_no_message()
    {
        // The screen went away. There is nobody to tell.
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        var attempt = await ApiAttempt.TryAsync<int>(
            _ => throw new OperationCanceledException(), cts.Token);

        Assert.False(attempt.Ok);
        Assert.Equal("", attempt.Error);
    }

    // ── Plumbing ─────────────────────────────────────────────────────────────

    private static HttpClient Client(HttpMessageHandler handler) =>
        new(handler) { BaseAddress = new Uri("https://numberoneschools.com/api/") };

    private static async Task<ExamRunnerViewModel> RunnerAsync(HttpMessageHandler handler)
    {
        var vm = new ExamRunnerViewModel(new StudentApi(Client(handler)), 1);
        await vm.LoadAsync();
        return vm;
    }

    private static LessonViewModel Lesson(HttpMessageHandler handler) =>
        new(new StudentApi(Client(handler)), null!,
            new Uri("https://numberoneschools.com/api/"), 1, 1);

    /// <summary>Reads succeed; anything that writes dies on the wire.</summary>
    private class DropsOnWriteHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (request.Method == HttpMethod.Get) return Task.FromResult(Read(request));

            throw new HttpRequestException("offline");
        }

        protected static HttpResponseMessage Read(HttpRequestMessage request)
        {
            var path = request.RequestUri!.AbsolutePath;

            const string exam =
                """{"id":1,"title":"اختبار","course_name":"مادة","duration_minutes":30,"total_marks":50,"questions":[{"id":1,"text":"س","question_type":"true_false","marks":5,"display_order":1,"options":[]}]}""";

            const string lesson =
                """{"id":1,"title":"محاضرة","youtube_embed_url":null,"exercise":null}""";

            var body = path.Contains("exams/student/1/") ? exam
                     : path.Contains("my-lessons") ? lesson
                     : "[]";

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            };
        }
    }

    /// <summary>The exact shape an aborted socket produces.</summary>
    private sealed class AbortsSocketHandler : DropsOnWriteHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (request.Method == HttpMethod.Get) return Task.FromResult(Read(request));

            var socket = new System.Net.Sockets.SocketException(995);   // OPERATION_ABORTED
            throw new TaskCanceledException("The operation was canceled.",
                new IOException("Unable to read data from the transport connection.", socket));
        }
    }

    private sealed class FailsOnceThenSucceedsHandler : DropsOnWriteHandler
    {
        public int Submits { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (request.Method == HttpMethod.Get) return Task.FromResult(Read(request));

            Submits++;
            if (Submits == 1) throw new HttpRequestException("offline");

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    """{"attempt":{"id":9,"score":40,"percentage":80,"is_passed":true}}""",
                    Encoding.UTF8, "application/json"),
            });
        }
    }

    private sealed class BlockingWriteHandler : DropsOnWriteHandler
    {
        private readonly TaskCompletionSource _gate = new();

        public int Submits { get; private set; }

        public void Release() => _gate.TrySetResult();

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (request.Method == HttpMethod.Get) return Read(request);

            Submits++;
            await _gate.Task;

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    """{"attempt":{"id":9,"score":40,"percentage":80,"is_passed":true}}""",
                    Encoding.UTF8, "application/json"),
            };
        }
    }
}
