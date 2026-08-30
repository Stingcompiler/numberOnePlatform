using System.Net;
using NumberOne.Core.Abstractions;
using NumberOne.Core.Api;
using NumberOne.Core.Services;

namespace NumberOne.Core.Tests;

/// <summary>
/// Exercises the auth layer against a real Django server rather than a stub.
/// Mocks agree with whatever you believed when you wrote them; these do not.
///
/// Skipped unless NUMBERONE_TEST_API is set, so an ordinary `dotnet test` stays
/// hermetic. To run them:
///
///   DB_NAME=&lt;scratch.sqlite3&gt; DEBUG=True python manage.py runserver 8077 --noreload
///   NUMBERONE_TEST_API=http://127.0.0.1:8077/api/ dotnet test
///
/// The server needs the fixtures in <see cref="Fixtures"/>: see the seeding
/// snippet in desktop/README.md.
///
/// Never point this at production. It binds devices, and only an administrator
/// can unbind them.
/// </summary>
public class LiveApiTests
{
    private static class Fixtures
    {
        public const string Password = "pass1234";

        /// <summary>Bound to <see cref="ThisDevice"/>.</summary>
        public const string BoundHere = "fresh.student";

        /// <summary>Unbound. Used for the binding-confirmation path.</summary>
        public const string Unbound = "sibling.student";

        /// <summary>Bound to an Android device, i.e. somewhere else.</summary>
        public const string BoundElsewhere = "bound.student";

        public const string ThisDevice = "hw-win-4f2a91c7d0e51b6a";
    }

    private const string SkipReason =
        "NUMBERONE_TEST_API is not set - see the class summary for how to run these.";

    private static Uri? BaseAddress
    {
        get
        {
            var url = Environment.GetEnvironmentVariable("NUMBERONE_TEST_API");
            return string.IsNullOrWhiteSpace(url) ? null : new Uri(url);
        }
    }

    private static (AuthService Auth, HttpClient Client, InMemoryTokenStore Tokens) Build(Uri baseAddress)
    {
        var tokens = new InMemoryTokenStore();
        var refresher = new RefreshEndpoint(baseAddress);
        var (client, _) = ApiClientFactory.Create(baseAddress, tokens, refresher);

        return (new AuthService(client, tokens, new StubDevice()), client, tokens);
    }

    [SkippableFact]
    public async Task A_student_already_bound_to_this_machine_signs_straight_in()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var baseAddress = BaseAddress!;

        var (auth, client, tokens) = Build(baseAddress);
        using var _ = client;

        var outcome = await auth.SignInAsync(Fixtures.BoundHere, Fixtures.Password);

        var success = Assert.IsType<LoginOutcome.Success>(outcome);
        Assert.True(success.User.IsStudent);
        Assert.Equal(Fixtures.ThisDevice, success.User.StudentProfile?.DeviceId);
        Assert.False(string.IsNullOrWhiteSpace(await tokens.GetAccessTokenAsync()));
    }

    [SkippableFact]
    public async Task An_unbound_student_is_held_for_confirmation_and_nothing_is_persisted()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var baseAddress = BaseAddress!;

        var (auth, client, tokens) = Build(baseAddress);
        using var _ = client;

        var outcome = await auth.SignInAsync(Fixtures.Unbound, Fixtures.Password);

        var pending = Assert.IsType<LoginOutcome.NeedsDeviceBinding>(outcome).Pending;
        Assert.Equal(Fixtures.ThisDevice, pending.DeviceId);
        Assert.Equal("Windows", pending.DeviceType);

        // The whole point of the probe: credentials verified, nothing bound,
        // no session stored until the student says yes.
        Assert.Null(await tokens.GetAccessTokenAsync());
    }

    [SkippableFact]
    public async Task An_account_bound_elsewhere_reports_which_device_and_when()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var baseAddress = BaseAddress!;

        var (auth, client, _) = Build(baseAddress);
        using var _c = client;

        var outcome = await auth.SignInAsync(Fixtures.BoundElsewhere, Fixtures.Password);

        var failed = Assert.IsType<LoginOutcome.Failed>(outcome);
        Assert.Equal(LoginFailureReason.AccountBoundElsewhere, failed.Reason);

        // Detail the failed-login path never returns, and the blockedDevice
        // screen needs: "Android - Galaxy A54" plus the binding date.
        Assert.NotNull(failed.BoundDevice);
        Assert.Equal("Android", failed.BoundDevice!.DeviceType);
        Assert.NotNull(failed.BoundDevice.BoundAt);
    }

    [SkippableFact]
    public async Task Binding_a_machine_another_student_holds_is_refused_distinctly()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var baseAddress = BaseAddress!;

        var (auth, client, _) = Build(baseAddress);
        using var _c = client;

        var pending = Assert.IsType<LoginOutcome.NeedsDeviceBinding>(
            await auth.SignInAsync(Fixtures.Unbound, Fixtures.Password)).Pending;

        var outcome = await auth.ConfirmBindAsync(pending);

        // The shared family or lab PC. Must not be confused with the student's
        // own account being bound elsewhere - it is a different screen.
        var failed = Assert.IsType<LoginOutcome.Failed>(outcome);
        Assert.Equal(LoginFailureReason.DeviceBoundToAnotherStudent, failed.Reason);
    }

    [SkippableFact]
    public async Task Wrong_credentials_are_reported_as_such()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var baseAddress = BaseAddress!;

        var (auth, client, _) = Build(baseAddress);
        using var _c = client;

        var failed = Assert.IsType<LoginOutcome.Failed>(
            await auth.SignInAsync(Fixtures.BoundHere, "definitely-not-the-password"));

        Assert.Equal(LoginFailureReason.BadCredentials, failed.Reason);
    }

    [SkippableFact]
    public async Task A_dead_access_token_is_refreshed_and_the_request_replayed()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var baseAddress = BaseAddress!;

        var (auth, client, tokens) = Build(baseAddress);
        using var _c = client;

        Assert.IsType<LoginOutcome.Success>(
            await auth.SignInAsync(Fixtures.BoundHere, Fixtures.Password));

        var goodRefresh = await tokens.GetRefreshTokenAsync();

        // Poison the access token, keeping the refresh token intact - exactly
        // the state a student is in 30 minutes into a lesson.
        await tokens.SaveAsync("not.a.valid.jwt", goodRefresh!);

        var response = await client.GetAsync(ApiEndpoints.MyCourses);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // And the store now holds a rotated pair, not the poisoned one.
        Assert.NotEqual("not.a.valid.jwt", await tokens.GetAccessTokenAsync());
        Assert.NotEqual(goodRefresh, await tokens.GetRefreshTokenAsync());
    }

    [SkippableFact]
    public async Task Concurrent_requests_on_a_dead_token_all_recover()
    {
        Skip.If(BaseAddress is null, SkipReason);
        var baseAddress = BaseAddress!;

        var (auth, client, tokens) = Build(baseAddress);
        using var _c = client;

        Assert.IsType<LoginOutcome.Success>(
            await auth.SignInAsync(Fixtures.BoundHere, Fixtures.Password));

        await tokens.SaveAsync("not.a.valid.jwt", (await tokens.GetRefreshTokenAsync())!);

        // The dashboard fires four unrelated endpoints at once. Against a real
        // server with ROTATE_REFRESH_TOKENS and BLACKLIST_AFTER_ROTATION on,
        // more than one refresh would leave the losers holding blacklisted
        // tokens - this is the test that stubs cannot make honest.
        var responses = await Task.WhenAll(
            client.GetAsync(ApiEndpoints.MyCourses),
            client.GetAsync(ApiEndpoints.StudentExams),
            client.GetAsync(ApiEndpoints.NotificationCount),
            client.GetAsync(ApiEndpoints.MyProgress));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
    }

    private sealed class StubDevice : IDeviceIdentityProvider
    {
        public string GetDeviceId() => Fixtures.ThisDevice;
        public string GetDeviceType() => "Windows";
        public string GetMachineName() => "DESKTOP-A2REKKA";
    }

    private sealed class InMemoryTokenStore : ITokenStore
    {
        private string? _access;
        private string? _refresh;

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
}
