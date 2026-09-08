using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NumberOne.Core.Services;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// Backs both blocked screens. They differ in wording and in what the detail
/// card can show, not in structure, so one view model drives one page.
/// </summary>
public sealed partial class BlockedPageViewModel : ObservableObject
{
    private readonly BlockedState _state;
    private readonly SiteContactService _contact;

    public BlockedPageViewModel(BlockedState state, SiteContactService contact)
    {
        _state = state;
        _contact = contact;
    }

    /// <summary>Raised by "تسجيل الدخول بحساب آخر". The host returns to login.</summary>
    public event EventHandler? BackToLoginRequested;

    public string Title => _state.Title;
    public string Body => _state.Body;
    public string DeviceId => _state.DeviceId;

    /// <summary>
    /// A lock for the account bound elsewhere, a blocked monitor for the machine
    /// held by another student. Placeholders until the Lucide SVGs land with the
    /// icon pass.
    /// </summary>
    /// <summary>
    /// Which icon the 64px circle carries. A key rather than a glyph: the view
    /// resolves it against Icons.xaml, so the two blocked screens draw from the
    /// same stroked set as the rest of the app instead of falling back to an
    /// emoji whose shape and weight are the font's decision, not the design's.
    ///
    /// A padlock for "your account is bound elsewhere" — the account is locked.
    /// A monitor for "this machine is bound to someone else" — the machine is.
    /// </summary>
    public string IconKey =>
        _state.Kind == BlockedKind.AccountBoundElsewhere ? "IconLock" : "IconMonitor";

    // ── The other device, when we know it ────────────────────────────────────

    public bool HasBoundDevice => !string.IsNullOrWhiteSpace(_state.BoundDevice?.DeviceType);

    /// <summary>e.g. "Android · Galaxy A54". Only the type is available today —
    /// the server stores no model name.</summary>
    public string BoundDeviceDescription => _state.BoundDevice?.DeviceType ?? "";

    public bool HasBoundAt => _state.BoundDevice?.BoundAt is not null;

    /// <summary>Year/month/day in Arabic-Indic digits, matching every other date.</summary>
    public string BoundAtDisplay =>
        _state.BoundDevice?.BoundAt is { } at ? UiText.FormatDate(at) : "";

    // ── Contact ──────────────────────────────────────────────────────────────

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(ContactLabel))]
    private string? _administrationPhone;

    /// <summary>
    /// The action carries the number once we have it, and reads as a plain
    /// instruction until then. Never a placeholder: a wrong number on this
    /// screen is worse than no number.
    /// </summary>
    public string ContactLabel => string.IsNullOrWhiteSpace(AdministrationPhone)
        ? UiText.ContactAdministration
        : $"{UiText.ContactAdministration} · {AdministrationPhone}";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasToast))]
    private string? _toastMessage;

    public bool HasToast => !string.IsNullOrWhiteSpace(ToastMessage);

    /// <summary>Set by the host to the platform clipboard.</summary>
    public Func<string, Task> ClipboardWriter { get; set; } = _ => Task.CompletedTask;

    /// <summary>
    /// Fetches the school's number. Called by the host when the page appears;
    /// the endpoint is AllowAny, which is why it works here at all - there is no
    /// session on this screen.
    /// </summary>
    public async Task LoadContactAsync(CancellationToken ct = default)
        => AdministrationPhone = await _contact.GetAdministrationPhoneAsync(ct).ConfigureAwait(true);

    [RelayCommand]
    private async Task CopyDeviceIdAsync()
    {
        await ClipboardWriter(DeviceId).ConfigureAwait(true);
        ToastMessage = UiText.DeviceIdCopied;
    }

    /// <summary>
    /// Copies the number rather than dialling it. A desktop has no dialler, and
    /// a tel: link that silently does nothing is worse than a copy that works.
    /// </summary>
    [RelayCommand]
    private async Task ContactAdministrationAsync()
    {
        if (string.IsNullOrWhiteSpace(AdministrationPhone)) return;

        await ClipboardWriter(AdministrationPhone).ConfigureAwait(true);
        ToastMessage = UiText.PhoneCopied;
    }

    [RelayCommand]
    private void BackToLogin() => BackToLoginRequested?.Invoke(this, EventArgs.Empty);
}
