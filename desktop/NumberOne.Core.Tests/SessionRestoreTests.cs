using System.Net;
using System.Text;
using NumberOne.Core.Abstractions;
using NumberOne.Core.Api;
using NumberOne.Core.Models;
using NumberOne.Core.Services;

namespace NumberOne.Core.Tests;

/// <summary>
/// Opening the app on a machine that never signed out.
///
/// This decides whether a student gets in, so every branch is covered. Two
/// mistakes are possible in opposite directions: letting a dead or moved
/// session through, and throwing away a good one because the network happened
/// to be down at launch. Both are tested.
/// </summary>
public class SessionRestoreTests
{
    private const string ThisMachine = "hw-win-4f2a91c7d0e51b6a";

    [Fact]
    public async Task A_first_launch_with_nothing_stored_shows_login()
    {
        var auth = Build(new NeverCalledHandler(), tokens: null);

        Assert.Equal(SessionRestore.None, await auth.RestoreSessionAsync());
    }

    [Fact]
    public async Task A_live_session_on_the_bound_machine_opens_the_app()
    {
        var auth = Build(new MeHandler(Student(ThisMachine)));

        Assert.Equal(SessionRestore.Restored, await auth.RestoreSessionAsync());
        Assert.NotNull(auth.CurrentUser);
    }

    [Fact]
    public async Task A_session_that_never_bound_a_device_still_opens()
    {
        // Nothing to compare against. Refusing here would lock out an account
        // an administrator had just unbound for a legitimate reason.
        var auth = Build(new MeHandler(Student(deviceId: null)));

        Assert.Equal(SessionRestore.Restored, await auth.RestoreSessionAsync());
    }

    [Fact]
    public async Task A_binding_that_moved_to_another_machine_is_refused()
    {
        // The tokens here are still perfectly valid — an administrator moved
        // the student to a new computer, and this one must stop working. That
        // is the entire point of the one-device rule, and it cannot be enforced
        // at sign-in alone, because this launch never signs in.
        var auth = Build(new MeHandler(Student("hw-win-SOMEONE-ELSE")), out var tokens);

        Assert.Equal(SessionRestore.Rejected, await auth.RestoreSessionAsync());
        Assert.Null(auth.CurrentUser);

        // And the dead pair does not stay on a shared machine.
        Assert.Null(await tokens.GetAccessTokenAsync());
    }

    [Fact]
    public async Task A_rejected_token_clears_the_store_and_shows_login()
    {
        // A 401 here has already been through the refresh, so this means the
        // refresh token is dead too — not merely that the access token aged out.
        var auth = Build(new StatusHandler(HttpStatusCode.Unauthorized), out var tokens);

        Assert.Equal(SessionRestore.Rejected, await auth.RestoreSessionAsync());
        Assert.Null(await tokens.GetRefreshTokenAsync());
    }

    [Fact]
    public async Task A_staff_account_is_refused_because_this_is_the_student_client()
    {
        var auth = Build(new MeHandler(new User
        {
            Id = "1", Username = "manager", Role = "admin",
        }));

        Assert.Equal(SessionRestore.Rejected, await auth.RestoreSessionAsync());
    }

    // ── The one that matters most ────────────────────────────────────────────

    [Fact]
    public async Task Being_offline_at_launch_never_costs_the_student_their_session()
    {
        // The trap this enum exists to avoid. Treating "cannot ask" as "no"
        // sends a student with good tokens to a login form that cannot reach
        // the server either — a dead end they can only leave by finding a
        // network.
        var auth = Build(new OfflineHandler(), out var tokens);

        Assert.Equal(SessionRestore.Unverified, await auth.RestoreSessionAsync());

        // The tokens survive, so the next launch with a network restores
        // properly.
        Assert.Equal("access", await tokens.GetAccessTokenAsync());
        Assert.Equal("refresh", await tokens.GetRefreshTokenAsync());
    }

    [Fact]
    public async Task A_machine_whose_hardware_id_cannot_be_read_is_not_locked_out()
    {
        // The comparison could not be made, so it is not held against the
        // student. Sign-in already refuses to bind without an id, so nothing is
        // weakened by being permissive at restore.
        var auth = Build(new MeHandler(Student(ThisMachine)), new BrokenDevice());

        Assert.Equal(SessionRestore.Restored, await auth.RestoreSessionAsync());
    }

    // ── Plumbing ─────────────────────────────────────────────────────────────

    private static User Student(string? deviceId) => new()
    {
        Id = "1",
        Username = "wiz",
        FullName = "طالب",
        Role = "student",
        StudentProfile = new StudentProfile { Id = 1, DeviceId = deviceId, SystemType = "online" },
    };

    private static AuthService Build(
        HttpMessageHandler handler,
        IDeviceIdentityProvider? device = null,
        string? tokens = "access")
        => Build(handler, out _, device, tokens);

    private static AuthService Build(HttpMessageHandler handler, out Tokens store)
        => Build(handler, out store, null, "access");

    private static AuthService Build(
        HttpMessageHandler handler,
        IDeviceIdentityProvider device)
        => Build(handler, out _, device, "access");

    private static AuthService Build(
        HttpMessageHandler handler,
        out Tokens store,
        IDeviceIdentityProvider? device,
        string? access)
    {
        store = new Tokens();
        if (access is not null) store.SaveAsync(access, "refresh").GetAwaiter().GetResult();

        var client = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://numberoneschools.com/api/"),
        };

        return new AuthService(client, store, device ?? new Device());
    }

    private sealed class MeHandler(User user) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    System.Text.Json.JsonSerializer.Serialize(user, ApiClientFactory.Json),
                    Encoding.UTF8, "application/json"),
            });
    }

    private sealed class StatusHandler(HttpStatusCode code) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => Task.FromResult(new HttpResponseMessage(code));
    }

    private sealed class OfflineHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => throw new HttpRequestException("No such host is known.");
    }

    /// <summary>Proves the call is never made when nothing is stored.</summary>
    private sealed class NeverCalledHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => throw new InvalidOperationException("the server must not be asked without a token");
    }

    private sealed class Device : IDeviceIdentityProvider
    {
        public string GetDeviceId() => ThisMachine;
        public string GetDeviceType() => "Windows";
        public string GetMachineName() => "DESKTOP-A2REKKA";
    }

    private sealed class BrokenDevice : IDeviceIdentityProvider
    {
        public string GetDeviceId() => throw new DeviceIdentityUnavailableException("no hardware id");
        public string GetDeviceType() => "Windows";
        public string GetMachineName() => "DESKTOP-A2REKKA";
    }

    private sealed class Tokens : ITokenStore
    {
        private string? _a, _r;
        public Task<string?> GetAccessTokenAsync() => Task.FromResult(_a);
        public Task<string?> GetRefreshTokenAsync() => Task.FromResult(_r);
        public Task SaveAsync(string a, string r) { _a = a; _r = r; return Task.CompletedTask; }
        public Task ClearAsync() { _a = null; _r = null; return Task.CompletedTask; }
    }
}
