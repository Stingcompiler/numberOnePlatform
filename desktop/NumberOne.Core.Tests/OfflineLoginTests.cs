using NumberOne.Core.Abstractions;
using NumberOne.Core.Api;
using NumberOne.Core.Models;
using NumberOne.Core.Services;
using NumberOne.Core.ViewModels;

namespace NumberOne.Core.Tests;

/// <summary>
/// Signing in with no network.
///
/// Reported from a debugger as an unhandled-looking HttpRequestException —
/// "No such host is known. (numberoneschools.com:443)" — which is what a DNS
/// failure looks like on a machine with no internet, a captive portal, or a
/// school filter in the way. That is the first thing a student does, so it is
/// worth knowing for certain rather than by reading the catch blocks.
///
/// These tests fail the transport at exactly that layer and assert the app
/// reports rather than throws. LoginViewModel.SignInAsync has a try/finally
/// with no catch, so anything escaping AuthService lands in an
/// AsyncRelayCommand with nowhere to go.
/// </summary>
public class OfflineLoginTests
{
    [Fact]
    public async Task Signing_in_with_no_dns_reports_instead_of_throwing()
    {
        var auth = Offline();

        var boom = await Record.ExceptionAsync(() => auth.SignInAsync("wiz", "wizwizwiz"));

        Assert.Null(boom);
    }

    [Fact]
    public async Task The_student_is_told_it_is_the_connection_not_their_password()
    {
        // The distinction matters. "Wrong username or password" on a machine
        // with no internet sends a student to the school office to have a
        // working password reset.
        var outcome = await Offline().SignInAsync("wiz", "wizwizwiz");

        var failed = Assert.IsType<LoginOutcome.Failed>(outcome);

        Assert.Equal(LoginFailureReason.Network, failed.Reason);
        Assert.Equal(DesktopMessages.NoConnection, failed.Message);
    }

    [Fact]
    public async Task The_login_screen_shows_that_message_and_stops_being_busy()
    {
        var vm = new LoginViewModel(Offline(), new Device(), SiteContact())
        {
            Username = "wiz",
            Password = "wizwizwiz",
        };

        var boom = await Record.ExceptionAsync(() => vm.SignInCommand.ExecuteAsync(null));

        Assert.Null(boom);
        Assert.Equal(DesktopMessages.NoConnection, vm.ErrorMessage);

        // The finally has to run, or the button stays disabled and the student
        // cannot retry once the network comes back.
        Assert.False(vm.IsBusy);
    }

    [Fact]
    public async Task Confirming_a_device_bind_offline_reports_too()
    {
        // The bind is a second login call, so it fails the same way — and this
        // one happens after the student has already agreed to something
        // permanent.
        var auth = Offline();
        var pending = new PendingBind
        {
            Username = "wiz",
            Password = "wizwizwiz",
            DeviceId = "hw-win-4f2a91c7d0e51b6a",
            DeviceType = "Windows",
            MachineName = "DESKTOP-A2REKKA",
            User = new Models.User { Id = "1", Username = "wiz", Role = "student" },
        };

        var boom = await Record.ExceptionAsync(() => auth.ConfirmBindAsync(pending));

        Assert.Null(boom);
    }

    [Fact]
    public async Task A_dropped_connection_never_signs_the_student_out()
    {
        // The refresh path. Treating "unreachable" as "expired" would log a
        // student out of the one device they are bound to — and only an
        // administrator can re-bind them.
        var tokens = new Tokens();
        await tokens.SaveAsync("stale-access", "the-refresh-token");

        var handler = new AuthenticatingHandler(tokens, new UnreachableRefresher())
        {
            InnerHandler = new UnauthorizedThenOffline(),
        };

        using var client = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://numberoneschools.com/api/"),
        };

        var expired = false;
        handler.SessionExpired += (_, _) => expired = true;

        await Record.ExceptionAsync(() => client.GetAsync("academic/my-courses/"));

        Assert.False(expired);
        Assert.Equal("the-refresh-token", await tokens.GetRefreshTokenAsync());
    }

    // ── Plumbing ─────────────────────────────────────────────────────────────

    private static AuthService Offline()
    {
        var client = new HttpClient(new NoSuchHostHandler())
        {
            BaseAddress = new Uri("https://numberoneschools.com/api/"),
        };

        return new AuthService(client, new Tokens(), new Device());
    }

    /// <summary>Exactly what the runtime raises when DNS cannot resolve.</summary>
    private sealed class NoSuchHostHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => throw new HttpRequestException(
                "No such host is known. (numberoneschools.com:443)",
                new System.Net.Sockets.SocketException(11001));   // HOST_NOT_FOUND
    }

    /// <summary>401 first, then the network is gone for the replay.</summary>
    private sealed class UnauthorizedThenOffline : HttpMessageHandler
    {
        private int _calls;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (_calls++ == 0)
                return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.Unauthorized));

            throw new HttpRequestException("No such host is known.");
        }
    }

    private sealed class UnreachableRefresher : ITokenRefresher
    {
        public Task<TokenPair?> RefreshAsync(string refreshToken, CancellationToken ct)
            => throw new HttpRequestException("No such host is known.");
    }

    private sealed class Device : IDeviceIdentityProvider
    {
        public string GetDeviceId() => "hw-win-4f2a91c7d0e51b6a";
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

    /// <summary>Sealed, so it is constructed over the same dead transport.</summary>
    private static SiteContactService SiteContact() =>
        new(new HttpClient(new NoSuchHostHandler())
        {
            BaseAddress = new Uri("https://numberoneschools.com/api/"),
        });
}
