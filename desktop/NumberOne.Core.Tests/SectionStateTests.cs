using System.Diagnostics;
using System.Net;
using System.Text;
using NumberOne.Core.Services;
using NumberOne.Core.ViewModels;

namespace NumberOne.Core.Tests;

/// <summary>
/// A section must always end up somewhere a student can act from. Silently
/// staying on "جارٍ التحميل…" is the one outcome that has no way out.
/// </summary>
public class SectionStateTests
{
    [Fact]
    public async Task A_request_timeout_becomes_an_error_not_a_permanent_spinner()
    {
        // HttpClient reports its own timeout as TaskCanceledException, which
        // derives from OperationCanceledException. Catching the base type first
        // to mean "the caller cancelled" swallows every timeout, and the section
        // spins forever with no error and no retry. This is that regression.
        var section = new SectionState<List<int>>(
            _ => throw new TaskCanceledException("The request timed out."),
            list => list.Count == 0);

        await section.LoadAsync(CancellationToken.None);

        Assert.True(section.HasError);
        Assert.False(section.IsLoading);
        Assert.Equal(DesktopMessages.NoConnection, section.ErrorMessage);
    }

    [Fact]
    public async Task A_timeout_surfacing_through_the_real_HttpClient_also_lands_in_error()
    {
        // The same thing end to end rather than by hand-thrown exception, so the
        // test still holds if the exception type HttpClient uses ever changes.
        using var client = new HttpClient(new NeverRespondsHandler())
        {
            BaseAddress = new Uri("https://numberoneschools.com/api/"),
            Timeout = TimeSpan.FromMilliseconds(150),
        };

        var api = new StudentApi(client);
        var section = new SectionState<List<Models.Course>>(
            ct => api.GetMyCoursesAsync(null, ct),
            list => list.Count == 0);

        await section.LoadAsync(CancellationToken.None);

        Assert.True(section.HasError);
        Assert.False(string.IsNullOrWhiteSpace(section.ErrorMessage));
    }

    [Fact]
    public async Task A_cancellation_the_caller_asked_for_leaves_the_state_alone()
    {
        // Navigating away mid-flight must not paint an error on a screen the
        // student has already left.
        using var cts = new CancellationTokenSource();

        var section = new SectionState<List<int>>(
            async ct =>
            {
                await cts.CancelAsync();
                ct.ThrowIfCancellationRequested();
                return new List<int>();
            },
            list => list.Count == 0);

        await section.LoadAsync(cts.Token);

        Assert.True(section.IsLoading);
        Assert.False(section.HasError);
    }

    [Fact]
    public async Task A_server_error_shows_the_servers_own_message()
    {
        using var client = new HttpClient(new StatusHandler(HttpStatusCode.Forbidden,
            """{"detail":"ليس لديك صلاحية الوصول لهذا الكورس."}"""))
        {
            BaseAddress = new Uri("https://numberoneschools.com/api/"),
        };

        var api = new StudentApi(client);
        var section = new SectionState<List<Models.Course>>(
            ct => api.GetMyCoursesAsync(null, ct),
            list => list.Count == 0);

        await section.LoadAsync();

        Assert.True(section.HasError);
        Assert.Equal("ليس لديك صلاحية الوصول لهذا الكورس.", section.ErrorMessage);
    }

    [Fact]
    public async Task An_unexpected_exception_fails_the_section_without_taking_the_app_down()
    {
        // This test used to assert the opposite — that a defect propagated, so
        // it would surface as a crash in development rather than a section that
        // loads forever.
        //
        // The first half of that was right and still holds: it must never leave
        // a spinner. The second half was wrong in production. Several loads are
        // started fire-and-forget, so nothing observes the exception and it ends
        // the process: the student gets a window that closes and no way to say
        // what happened, which is exactly how this arrived as a bug report.
        //
        // The defect now fails its own section and is handed to the diagnostics
        // sink, which the app points at its crash log. Visible to a developer,
        // survivable for a student.
        Exception? reported = null;
        SectionDiagnostics.Unexpected = ex => reported = ex;

        try
        {
            var section = new SectionState<List<int>>(
                _ => throw new InvalidOperationException("boom"),
                list => list.Count == 0);

            var boom = await Record.ExceptionAsync(() => section.LoadAsync());

            Assert.Null(boom);
            Assert.False(section.IsLoading);
            Assert.True(section.HasError);

            // Never the offline message: a student who retries a connection
            // problem is doing the right thing, and one who retries a defect is
            // not.
            Assert.Equal(DesktopMessages.SectionFailed, section.ErrorMessage);
            Assert.NotEqual(DesktopMessages.NoConnection, section.ErrorMessage);

            Assert.IsType<InvalidOperationException>(reported);
        }
        finally
        {
            SectionDiagnostics.Unexpected = null;
        }
    }

    [Fact]
    public async Task Reloading_after_a_failure_clears_the_previous_error()
    {
        var shouldFail = true;

        var section = new SectionState<List<int>>(
            _ => shouldFail
                ? throw new TaskCanceledException()
                : Task.FromResult(new List<int> { 1 }),
            list => list.Count == 0);

        await section.LoadAsync();
        Assert.True(section.HasError);

        shouldFail = false;
        await section.LoadAsync();

        Assert.True(section.HasData);
        Assert.Null(section.ErrorMessage);
    }

    private sealed class NeverRespondsHandler : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            await Task.Delay(Timeout.Infinite, ct);
            throw new UnreachableException();
        }
    }

    private sealed class StatusHandler : HttpMessageHandler
    {
        private readonly HttpStatusCode _status;
        private readonly string _body;

        public StatusHandler(HttpStatusCode status, string body)
        {
            _status = status;
            _body = body;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => Task.FromResult(new HttpResponseMessage(_status)
            {
                Content = new StringContent(_body, Encoding.UTF8, "application/json"),
            });
    }
}
