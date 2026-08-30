using System.Net;
using System.Text;
using NumberOne.Core.Abstractions;
using NumberOne.Core.Api;
using NumberOne.Core.Models;
using NumberOne.Core.Services;
using NumberOne.Core.ViewModels;

namespace NumberOne.Core.Tests;

/// <summary>
/// The login flow, driven over a stubbed server. What matters here is not the
/// HTTP - that is covered against a real Django in LiveApiTests - but which
/// screen each outcome lands on, and that nothing is persisted before the
/// student confirms the binding.
/// </summary>
public class LoginViewModelTests
{
    private const string ThisDevice = "hw-win-4f2a91c7d0e51b6a";

    [Fact]
    public async Task A_bound_student_signs_in_and_no_modal_appears()
    {
        var h = new Harness();
        h.Server.OnLogin = _ => Ok(deviceId: ThisDevice);

        User? signedIn = null;
        h.Vm.SignedIn += (_, u) => signedIn = u;

        h.Vm.Username = "fresh.student";
        h.Vm.Password = "pass1234";
        await h.Vm.SignInCommand.ExecuteAsync(null);

        Assert.NotNull(signedIn);
        Assert.False(h.Vm.IsBindConfirmationVisible);
        Assert.False(h.Vm.HasError);
        Assert.NotNull(await h.Tokens.GetAccessTokenAsync());
    }

    [Fact]
    public async Task An_unbound_student_gets_the_modal_and_nothing_is_stored_yet()
    {
        var h = new Harness();
        h.Server.OnLogin = _ => Ok(deviceId: null);

        h.Vm.Username = "sibling.student";
        h.Vm.Password = "pass1234";
        await h.Vm.SignInCommand.ExecuteAsync(null);

        Assert.True(h.Vm.IsBindConfirmationVisible);

        // The whole reason for the two-phase flow: binding is a one-way door,
        // so nothing is committed until the student says yes.
        Assert.Null(await h.Tokens.GetAccessTokenAsync());
    }

    [Fact]
    public async Task Cancelling_the_modal_leaves_no_session_behind()
    {
        var h = new Harness();
        h.Server.OnLogin = _ => Ok(deviceId: null);

        h.Vm.Username = "sibling.student";
        h.Vm.Password = "pass1234";
        await h.Vm.SignInCommand.ExecuteAsync(null);

        h.Vm.CancelBindCommand.Execute(null);

        Assert.False(h.Vm.IsBindConfirmationVisible);
        Assert.Null(await h.Tokens.GetAccessTokenAsync());
        Assert.Equal("", h.Vm.Password);
    }

    [Fact]
    public async Task Confirming_the_modal_binds_and_signs_in()
    {
        var h = new Harness();

        // Probe: unbound. Confirming call: carries the id, so it binds.
        h.Server.OnLogin = body =>
            body.Contains("device_id") ? Ok(deviceId: ThisDevice) : Ok(deviceId: null);

        User? signedIn = null;
        h.Vm.SignedIn += (_, u) => signedIn = u;

        h.Vm.Username = "sibling.student";
        h.Vm.Password = "pass1234";
        await h.Vm.SignInCommand.ExecuteAsync(null);
        await h.Vm.ConfirmBindCommand.ExecuteAsync(null);

        Assert.NotNull(signedIn);
        Assert.False(h.Vm.IsBindConfirmationVisible);
        Assert.NotNull(await h.Tokens.GetAccessTokenAsync());

        // Two calls: the probe, then the one that binds.
        Assert.Equal(2, h.Server.LoginCalls);
        Assert.DoesNotContain("device_id", h.Server.Bodies[0]);
        Assert.Contains("device_id", h.Server.Bodies[1]);
    }

    [Fact]
    public async Task An_account_bound_elsewhere_routes_to_its_own_blocked_screen()
    {
        var h = new Harness();
        h.Server.OnLogin = _ => Ok(deviceId: "hw-android-SOMETHING-ELSE", deviceType: "Android");

        BlockedState? blocked = null;
        h.Vm.Blocked += (_, b) => blocked = b;

        h.Vm.Username = "bound.student";
        h.Vm.Password = "pass1234";
        await h.Vm.SignInCommand.ExecuteAsync(null);

        Assert.NotNull(blocked);
        Assert.Equal(BlockedKind.AccountBoundElsewhere, blocked!.Kind);
        Assert.Equal(ThisDevice, blocked.DeviceId);

        // The probe told us which device, which the failed-login path never does.
        Assert.Equal("Android", blocked.BoundDevice?.DeviceType);
    }

    [Fact]
    public async Task A_machine_held_by_another_student_routes_to_the_other_blocked_screen()
    {
        var h = new Harness();
        h.Server.OnLogin = body => body.Contains("device_id")
            ? Refused(ServerMessages.DeviceBoundToAnotherStudent)
            : Ok(deviceId: null);

        BlockedState? blocked = null;
        h.Vm.Blocked += (_, b) => blocked = b;

        h.Vm.Username = "sibling.student";
        h.Vm.Password = "pass1234";
        await h.Vm.SignInCommand.ExecuteAsync(null);
        await h.Vm.ConfirmBindCommand.ExecuteAsync(null);

        // Must not be confused with the account-bound-elsewhere screen: this is
        // the shared family or lab PC, and it sends the student to the school
        // with a different question.
        Assert.NotNull(blocked);
        Assert.Equal(BlockedKind.DeviceBoundToAnotherStudent, blocked!.Kind);

        // Nothing about the other student is shown, because no student-facing
        // endpoint exposes it and the client must not go looking.
        Assert.Null(blocked.BoundDevice);
    }

    [Fact]
    public async Task Wrong_credentials_stay_on_the_form_with_the_server_text()
    {
        var h = new Harness();
        h.Server.OnLogin = _ => Refused(ServerMessages.BadCredentials);

        var blockedRaised = false;
        h.Vm.Blocked += (_, _) => blockedRaised = true;

        h.Vm.Username = "fresh.student";
        h.Vm.Password = "wrong";
        await h.Vm.SignInCommand.ExecuteAsync(null);

        Assert.True(h.Vm.HasError);
        Assert.Equal(ServerMessages.BadCredentials, h.Vm.ErrorMessage);
        Assert.False(blockedRaised);
        Assert.False(h.Vm.IsBindConfirmationVisible);
    }

    [Fact]
    public async Task Typing_clears_a_previous_error()
    {
        var h = new Harness();
        h.Server.OnLogin = _ => Refused(ServerMessages.BadCredentials);

        h.Vm.Username = "fresh.student";
        h.Vm.Password = "wrong";
        await h.Vm.SignInCommand.ExecuteAsync(null);
        Assert.True(h.Vm.HasError);

        h.Vm.Password = "w";

        Assert.False(h.Vm.HasError);
    }

    [Fact]
    public void Submit_is_disabled_until_both_fields_are_filled()
    {
        var h = new Harness();

        Assert.False(h.Vm.SignInCommand.CanExecute(null));

        h.Vm.Username = "fresh.student";
        Assert.False(h.Vm.SignInCommand.CanExecute(null));

        h.Vm.Password = "pass1234";
        Assert.True(h.Vm.SignInCommand.CanExecute(null));
    }

    [Fact]
    public async Task A_non_student_is_turned_away_rather_than_signed_in()
    {
        var h = new Harness();
        h.Server.OnLogin = _ => Ok(deviceId: ThisDevice, role: "admin");

        var signedIn = false;
        h.Vm.SignedIn += (_, _) => signedIn = true;

        h.Vm.Username = "some.manager";
        h.Vm.Password = "pass1234";
        await h.Vm.SignInCommand.ExecuteAsync(null);

        Assert.False(signedIn);
        Assert.Equal(DesktopMessages.StudentsOnly, h.Vm.ErrorMessage);
    }

    [Fact]
    public async Task Copying_the_device_id_puts_the_real_identifier_on_the_clipboard()
    {
        // The blocked screens are exactly where a student needs this string and
        // cannot reach the rest of the app.
        var h = new Harness();

        string? copied = null;
        h.Vm.ClipboardWriter = text => { copied = text; return Task.CompletedTask; };

        string? toast = null;
        h.Vm.Toast += (_, t) => toast = t;

        await h.Vm.CopyDeviceIdCommand.ExecuteAsync(null);

        Assert.Equal(ThisDevice, copied);
        Assert.Equal(UiText.DeviceIdCopied, toast);
    }

    [Fact]
    public void An_unreadable_machine_blocks_sign_in_instead_of_inventing_an_id()
    {
        // Inventing one would bind the account to a value that does not survive
        // the next launch.
        var h = new Harness(device: new BrokenDevice());

        Assert.Null(h.Vm.DeviceId);
        Assert.Equal(DesktopMessages.DeviceIdUnavailable, h.Vm.ErrorMessage);
    }

    // ── Harness ──────────────────────────────────────────────────────────────

    private sealed class Harness
    {
        public StubServer Server { get; } = new();
        public FakeTokens Tokens { get; } = new();
        public LoginViewModel Vm { get; }

        public Harness(IDeviceIdentityProvider? device = null)
        {
            var baseAddress = new Uri("https://numberoneschools.com/api/");

            var auth = new AuthenticatingHandler(Tokens, new NeverRefreshes()) { InnerHandler = Server };
            var client = new HttpClient(auth) { BaseAddress = baseAddress };

            Vm = new LoginViewModel(
                new AuthService(client, Tokens, device ?? new StubDevice()),
                device ?? new StubDevice(),
                new SiteContactService(new HttpClient(new StubServer()) { BaseAddress = baseAddress }));
        }
    }

    private static HttpResponseMessage Ok(string? deviceId, string? deviceType = "Windows", string role = "student")
    {
        var device = deviceId is null ? "null" : $"\"{deviceId}\"";
        var type = deviceId is null ? "null" : $"\"{deviceType}\"";
        var boundAt = deviceId is null ? "null" : "\"2026-06-18T10:00:00+02:00\"";

        var json = $$"""
        {
          "access": "access-token",
          "refresh": "refresh-token",
          "user": {
            "id": "209f3831-21b4-4784-a1b9-9660576ea410",
            "username": "a.student",
            "full_name": "طالب",
            "phone": "0912345678",
            "role": "{{role}}",
            "is_active": true,
            "student_profile": {
              "id": 4,
              "system_type": "online",
              "device_id": {{device}},
              "device_type": {{type}},
              "device_bound_at": {{boundAt}},
              "balance": "0.00"
            }
          }
        }
        """;

        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
        };
    }

    /// <summary>A refusal in the shape LoginSerializer.validate() actually produces.</summary>
    private static HttpResponseMessage Refused(string message) =>
        new(HttpStatusCode.BadRequest)
        {
            Content = new StringContent(
                $$"""{"non_field_errors":["{{message}}"]}""", Encoding.UTF8, "application/json"),
        };

    private sealed class StubServer : HttpMessageHandler
    {
        public Func<string, HttpResponseMessage> OnLogin { get; set; } = _ => Ok(null);
        public List<string> Bodies { get; } = new();
        public int LoginCalls => Bodies.Count;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(ct);

            if (request.RequestUri!.AbsolutePath.Contains("/auth/login"))
            {
                Bodies.Add(body);
                return OnLogin(body);
            }

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{}", Encoding.UTF8, "application/json"),
            };
        }
    }

    private sealed class NeverRefreshes : ITokenRefresher
    {
        public Task<TokenPair?> RefreshAsync(string refreshToken, CancellationToken ct)
            => Task.FromResult<TokenPair?>(null);
    }

    private sealed class StubDevice : IDeviceIdentityProvider
    {
        public string GetDeviceId() => ThisDevice;
        public string GetDeviceType() => "Windows";
        public string GetMachineName() => "DESKTOP-A2REKKA";
    }

    private sealed class BrokenDevice : IDeviceIdentityProvider
    {
        public string GetDeviceId() => throw new DeviceIdentityUnavailableException("MachineGuid missing.");
        public string GetDeviceType() => "Windows";
        public string GetMachineName() => "DESKTOP-A2REKKA";
    }

    private sealed class FakeTokens : ITokenStore
    {
        private string? _access;
        private string? _refresh;

        public Task<string?> GetAccessTokenAsync() => Task.FromResult(_access);
        public Task<string?> GetRefreshTokenAsync() => Task.FromResult(_refresh);

        public Task SaveAsync(string accessToken, string refreshToken)
        {
            _access = accessToken;
            _refresh = refreshToken;
            return Task.CompletedTask;
        }

        public Task ClearAsync()
        {
            _access = null;
            _refresh = null;
            return Task.CompletedTask;
        }
    }
}
