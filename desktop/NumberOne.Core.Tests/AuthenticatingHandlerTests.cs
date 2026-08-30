using System.Net;
using System.Text;
using NumberOne.Core.Abstractions;
using NumberOne.Core.Api;
using NumberOne.Core.Models;

namespace NumberOne.Core.Tests;

public class AuthenticatingHandlerTests
{
    private static readonly Uri Base = new("https://numberoneschools.com/api/");

    [Fact]
    public async Task Attaches_the_access_token()
    {
        var tokens = new FakeTokenStore("access-1", "refresh-1");
        var inner = new StubHandler(_ => Ok());
        using var client = Build(tokens, new FakeRefresher(), inner);

        await client.GetAsync("academic/my-courses/");

        Assert.Equal("Bearer access-1", inner.Requests[0].Authorization);
    }

    [Fact]
    public async Task Refreshes_once_and_replays_the_request_on_401()
    {
        var tokens = new FakeTokenStore("stale", "refresh-1");
        var refresher = new FakeRefresher(new TokenPair { Access = "fresh", Refresh = "refresh-2" });

        var inner = new StubHandler(req =>
            req.Authorization == "Bearer stale" ? Unauthorized() : Ok());

        using var client = Build(tokens, refresher, inner);

        var response = await client.GetAsync("academic/my-courses/");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, inner.Requests.Count);
        Assert.Equal("Bearer fresh", inner.Requests[1].Authorization);
        Assert.Equal(1, refresher.Calls);

        // The rotated refresh token must be stored: ROTATE_REFRESH_TOKENS is on
        // and BLACKLIST_AFTER_ROTATION kills the old one immediately.
        Assert.Equal("refresh-2", await tokens.GetRefreshTokenAsync());
    }

    [Fact]
    public async Task The_replayed_request_still_carries_its_body()
    {
        var tokens = new FakeTokenStore("stale", "refresh-1");
        var refresher = new FakeRefresher(new TokenPair { Access = "fresh", Refresh = "refresh-2" });

        var inner = new StubHandler(req =>
            req.Authorization == "Bearer stale" ? Unauthorized() : Ok());

        using var client = Build(tokens, refresher, inner);

        // An exam submission is the case that matters: losing the body on replay
        // would silently submit an empty attempt.
        var content = new StringContent("""{"answers":[{"question_id":1}]}""", Encoding.UTF8, "application/json");
        await client.PostAsync("exams/student/1/submit/", content);

        Assert.Equal(2, inner.Requests.Count);
        Assert.Equal(inner.Requests[0].Body, inner.Requests[1].Body);
        Assert.Contains("question_id", inner.Requests[1].Body);
    }

    [Fact]
    public async Task Concurrent_401s_share_a_single_refresh()
    {
        // The reason this matters: refresh tokens rotate and blacklist on use.
        // Two refreshes racing would leave the loser holding a dead token, and
        // the student signed out mid-lesson.
        var tokens = new FakeTokenStore("stale", "refresh-1");
        var refresher = new FakeRefresher(new TokenPair { Access = "fresh", Refresh = "refresh-2" })
        {
            Delay = TimeSpan.FromMilliseconds(150),
        };

        var inner = new StubHandler(req =>
            req.Authorization == "Bearer stale" ? Unauthorized() : Ok());

        using var client = Build(tokens, refresher, inner);

        var responses = await Task.WhenAll(
            Enumerable.Range(0, 8).Select(_ => client.GetAsync("academic/my-courses/")));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        Assert.Equal(1, refresher.Calls);
    }

    [Fact]
    public async Task A_rejected_refresh_clears_the_tokens_and_raises_SessionExpired()
    {
        var tokens = new FakeTokenStore("stale", "refresh-1");
        var refresher = new FakeRefresher(null); // server rejected the refresh token
        var inner = new StubHandler(_ => Unauthorized());

        var (client, auth) = ApiClientFactory.Create(Base, tokens, refresher);
        using var _client = client;

        var expired = 0;
        auth.SessionExpired += (_, _) => Interlocked.Increment(ref expired);

        // Swap in the stub under the authenticating handler.
        auth.InnerHandler = inner;

        var response = await client.GetAsync("academic/my-courses/");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(1, expired);
        Assert.Null(await tokens.GetAccessTokenAsync());
        Assert.Null(await tokens.GetRefreshTokenAsync());
    }

    [Fact]
    public async Task A_network_failure_during_refresh_does_not_sign_the_student_out()
    {
        // A dropped connection must not log a student off a device only an
        // administrator can re-bind.
        var tokens = new FakeTokenStore("stale", "refresh-1");
        var refresher = new FakeRefresher(new TokenPair { Access = "fresh", Refresh = "refresh-2" })
        {
            Throw = () => new HttpRequestException("offline"),
        };
        var inner = new StubHandler(_ => Unauthorized());

        var (client, auth) = ApiClientFactory.Create(Base, tokens, refresher);
        using var _client = client;

        var expired = 0;
        auth.SessionExpired += (_, _) => Interlocked.Increment(ref expired);
        auth.InnerHandler = inner;

        var response = await client.GetAsync("academic/my-courses/");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(0, expired);
        Assert.Equal("stale", await tokens.GetAccessTokenAsync());
        Assert.Equal("refresh-1", await tokens.GetRefreshTokenAsync());
    }

    [Theory]
    [InlineData("auth/login/")]
    [InlineData("auth/refresh/")]
    public async Task Login_and_refresh_never_trigger_a_refresh(string path)
    {
        // Retrying either would loop.
        var tokens = new FakeTokenStore("stale", "refresh-1");
        var refresher = new FakeRefresher(new TokenPair { Access = "fresh", Refresh = "refresh-2" });
        var inner = new StubHandler(_ => Unauthorized());

        using var client = Build(tokens, refresher, inner);

        var response = await client.PostAsync(path, new StringContent("{}"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(0, refresher.Calls);
        Assert.Single(inner.Requests);
        Assert.Null(inner.Requests[0].Authorization);
    }

    [Fact]
    public async Task A_non_401_response_passes_through_untouched()
    {
        var tokens = new FakeTokenStore("access-1", "refresh-1");
        var refresher = new FakeRefresher();
        var inner = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.Forbidden));

        using var client = Build(tokens, refresher, inner);

        var response = await client.GetAsync("academic/my-courses/");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(0, refresher.Calls);
        Assert.Single(inner.Requests);
    }

    private static HttpClient Build(ITokenStore tokens, ITokenRefresher refresher, HttpMessageHandler inner)
    {
        var auth = new AuthenticatingHandler(tokens, refresher) { InnerHandler = inner };
        return new HttpClient(auth) { BaseAddress = Base };
    }

    private static HttpResponseMessage Ok() => new(HttpStatusCode.OK)
    {
        Content = new StringContent("[]", Encoding.UTF8, "application/json"),
    };

    private static HttpResponseMessage Unauthorized() => new(HttpStatusCode.Unauthorized)
    {
        Content = new StringContent("""{"detail":"..."}""", Encoding.UTF8, "application/json"),
    };

    private sealed record CapturedRequest(string? Authorization, string Body);

    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly Func<CapturedRequest, HttpResponseMessage> _respond;
        private readonly Lock _lock = new();

        public List<CapturedRequest> Requests { get; } = new();

        public StubHandler(Func<CapturedRequest, HttpResponseMessage> respond) => _respond = respond;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var body = request.Content is null
                ? string.Empty
                : await request.Content.ReadAsStringAsync(ct);

            var captured = new CapturedRequest(request.Headers.Authorization?.ToString(), body);

            lock (_lock) Requests.Add(captured);

            return _respond(captured);
        }
    }

    private sealed class FakeTokenStore : ITokenStore
    {
        private string? _access;
        private string? _refresh;

        public FakeTokenStore(string? access, string? refresh)
        {
            _access = access;
            _refresh = refresh;
        }

        public Task<string?> GetAccessTokenAsync() => Task.FromResult(Volatile.Read(ref _access));
        public Task<string?> GetRefreshTokenAsync() => Task.FromResult(Volatile.Read(ref _refresh));

        public Task SaveAsync(string accessToken, string refreshToken)
        {
            Volatile.Write(ref _access, accessToken);
            Volatile.Write(ref _refresh, refreshToken);
            return Task.CompletedTask;
        }

        public Task ClearAsync()
        {
            Volatile.Write(ref _access, null);
            Volatile.Write(ref _refresh, null);
            return Task.CompletedTask;
        }
    }

    private sealed class FakeRefresher : ITokenRefresher
    {
        private readonly TokenPair? _result;
        private int _calls;

        public FakeRefresher(TokenPair? result = null) => _result = result;

        public int Calls => Volatile.Read(ref _calls);

        public TimeSpan Delay { get; init; } = TimeSpan.Zero;

        public Func<Exception>? Throw { get; init; }

        public async Task<TokenPair?> RefreshAsync(string refreshToken, CancellationToken ct)
        {
            Interlocked.Increment(ref _calls);

            if (Delay > TimeSpan.Zero)
                await Task.Delay(Delay, ct);

            if (Throw is not null)
                throw Throw();

            return _result;
        }
    }
}
