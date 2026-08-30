using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NumberOne.Core.Abstractions;
using NumberOne.Core.Api;
using NumberOne.Core.Models;
using NumberOne.Core.Services;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// Login, the device-binding confirmation, and the hand-off to the two blocked
/// screens. One view model because they are one flow: the design draws the bind
/// modal over a dimmed login, and both blocked states are reached only from a
/// sign-in attempt.
/// </summary>
public sealed partial class LoginViewModel : ObservableObject
{
    private readonly AuthService _auth;
    private readonly IDeviceIdentityProvider _device;
    private readonly SiteContactService _contact;

    public LoginViewModel(AuthService auth, IDeviceIdentityProvider device, SiteContactService contact)
    {
        _auth = auth;
        _device = device;
        _contact = contact;

        // Read once at construction. A failure here is fatal to signing in, so
        // it is surfaced as a blocking error rather than thrown later, mid-post.
        try
        {
            DeviceId = _device.GetDeviceId();
            DeviceType = _device.GetDeviceType();
            MachineName = _device.GetMachineName();
        }
        catch (DeviceIdentityUnavailableException)
        {
            DeviceId = null;
            DeviceType = "";
            MachineName = "";
            ErrorMessage = DesktopMessages.DeviceIdUnavailable;
        }
    }

    /// <summary>Raised on a successful sign-in. The host navigates to the dashboard.</summary>
    public event EventHandler<User>? SignedIn;

    /// <summary>
    /// Raised when the attempt ended on a blocked state. The host shows the
    /// matching screen; both are full pages with no shell.
    /// </summary>
    public event EventHandler<BlockedState>? Blocked;

    // ── The form ─────────────────────────────────────────────────────────────

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SignInCommand))]
    private string _username = "";

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SignInCommand))]
    private string _password = "";

    [ObservableProperty]
    private bool _passwordVisible;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SignInCommand))]
    private bool _isBusy;

    /// <summary>Server text, shown verbatim in the error panel above the button.</summary>
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasError))]
    private string? _errorMessage;

    public bool HasError => !string.IsNullOrWhiteSpace(ErrorMessage);

    /// <summary>"جارٍ الدخول…" while the call is in flight, so the width does not jump.</summary>
    public string SubmitLabel => IsBusy ? UiText.SigningIn : UiText.SignIn;

    // ── This machine ─────────────────────────────────────────────────────────

    public string? DeviceId { get; }
    public string DeviceType { get; }
    public string MachineName { get; }

    /// <summary>"هذا الجهاز: Windows · سيتم ربط حسابك به عند أول دخول"</summary>
    public string DeviceFootnote => $"{UiText.ThisDevicePrefix}{DeviceType}{UiText.ThisDeviceSuffix}";

    /// <summary>"Windows · DESKTOP-A2REKKA", LTR, for the binding modal strip.</summary>
    public string DeviceDescription => $"{DeviceType} · {MachineName}";

    // ── The binding confirmation ─────────────────────────────────────────────

    /// <summary>
    /// Held between the probe and the confirmation. Non-null exactly while the
    /// modal is up; nothing is persisted until <see cref="ConfirmBindCommand"/>
    /// succeeds.
    /// </summary>
    private PendingBind? _pending;

    [ObservableProperty]
    private bool _isBindConfirmationVisible;

    // ── Commands ─────────────────────────────────────────────────────────────

    private bool CanSubmit =>
        !IsBusy && !string.IsNullOrWhiteSpace(Username) && !string.IsNullOrWhiteSpace(Password);

    [RelayCommand(CanExecute = nameof(CanSubmit))]
    private async Task SignInAsync(CancellationToken ct)
    {
        if (DeviceId is null)
        {
            ErrorMessage = DesktopMessages.DeviceIdUnavailable;
            return;
        }

        IsBusy = true;
        ErrorMessage = null;

        try
        {
            var outcome = await _auth.SignInAsync(Username.Trim(), Password, ct).ConfigureAwait(true);
            Handle(outcome);
        }
        finally
        {
            IsBusy = false;
        }
    }

    /// <summary>
    /// The student confirmed. This is the call that actually binds - the probe
    /// deliberately did not.
    /// </summary>
    [RelayCommand]
    private async Task ConfirmBindAsync(CancellationToken ct)
    {
        if (_pending is null) return;

        IsBusy = true;

        try
        {
            var outcome = await _auth.ConfirmBindAsync(_pending, ct).ConfigureAwait(true);

            // Whatever happened, the pending session is spent.
            _pending = null;
            IsBindConfirmationVisible = false;

            Handle(outcome);
        }
        finally
        {
            IsBusy = false;
        }
    }

    /// <summary>
    /// Esc, or the modal's "إلغاء". Discards the verified-but-unbound session:
    /// its tokens were never stored, so dropping the reference is the whole
    /// undo. The unused pair simply expires server-side.
    /// </summary>
    [RelayCommand]
    private void CancelBind()
    {
        _pending = null;
        IsBindConfirmationVisible = false;
        Password = "";
    }

    [RelayCommand]
    private void TogglePasswordVisibility() => PasswordVisible = !PasswordVisible;

    /// <summary>
    /// Copies the machine's identifier. The student has to convey a string like
    /// hw-win-4f2a91c7d0e51b6a over the phone to get unbound, and nobody can
    /// dictate that accurately.
    /// </summary>
    [RelayCommand]
    private async Task CopyDeviceIdAsync()
    {
        if (DeviceId is null) return;

        await ClipboardWriter(DeviceId).ConfigureAwait(true);
        Toast?.Invoke(this, UiText.DeviceIdCopied);
    }

    /// <summary>
    /// Set by the host to the platform clipboard. A delegate rather than a MAUI
    /// reference, so this view model stays testable outside a platform head.
    /// </summary>
    public Func<string, Task> ClipboardWriter { get; set; } = _ => Task.CompletedTask;

    /// <summary>Transient feedback; the host renders the toast.</summary>
    public event EventHandler<string>? Toast;

    public Task<string?> GetAdministrationPhoneAsync(CancellationToken ct = default)
        => _contact.GetAdministrationPhoneAsync(ct);

    // ── Outcome routing ──────────────────────────────────────────────────────

    private void Handle(LoginOutcome outcome)
    {
        switch (outcome)
        {
            case LoginOutcome.Success success:
                Password = "";
                SignedIn?.Invoke(this, success.User);
                break;

            case LoginOutcome.NeedsDeviceBinding needs:
                _pending = needs.Pending;
                IsBindConfirmationVisible = true;
                break;

            case LoginOutcome.Failed { Reason: LoginFailureReason.AccountBoundElsewhere } failed:
                Password = "";
                Blocked?.Invoke(this, BlockedState.AccountBoundElsewhere(
                    DeviceId ?? "", failed.BoundDevice));
                break;

            case LoginOutcome.Failed { Reason: LoginFailureReason.DeviceBoundToAnotherStudent }:
                Password = "";
                Blocked?.Invoke(this, BlockedState.DeviceBoundToAnotherStudent(DeviceId ?? ""));
                break;

            case LoginOutcome.Failed failed:
                // Bad credentials, a suspended account, network, or something
                // unrecognised: all stay on the form with the server's own text.
                //
                // Note a suspended account currently arrives here as
                // BadCredentials. Django's ModelBackend rejects is_active=False
                // inside authenticate(), so LoginSerializer never reaches its
                // own "الحساب موقوف" branch and the client cannot tell the two
                // apart. Fixing that is a backend change.
                ErrorMessage = failed.Message;
                break;
        }
    }

    partial void OnUsernameChanged(string value) => ClearErrorOnTyping();
    partial void OnPasswordChanged(string value) => ClearErrorOnTyping();
    partial void OnIsBusyChanged(bool value) => OnPropertyChanged(nameof(SubmitLabel));

    private void ClearErrorOnTyping()
    {
        if (HasError) ErrorMessage = null;
    }
}
