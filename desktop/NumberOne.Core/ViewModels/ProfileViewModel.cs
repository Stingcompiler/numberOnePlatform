using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NumberOne.Core.Models;
using NumberOne.Core.Services;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// حسابي — read-only personal details and the bound-device panel.
///
/// Two things are deliberately absent and must stay absent:
///
/// There is no password control anywhere. Students never change their own
/// password; it is issued and reset by the administration and the server refuses
/// the request (IsStudentReadOnly on /auth/change-password/).
///
/// There is no unbind control. Clearing a device binding goes through the
/// administration; the client only explains that and shows the identifier.
/// </summary>
public sealed partial class ProfileViewModel : ObservableObject
{
    private readonly AuthService _auth;

    public ProfileViewModel(AuthService auth) => _auth = auth;

    private User? User => _auth.CurrentUser;
    private StudentProfile? Profile => User?.StudentProfile;

    // ── البيانات الشخصية ─────────────────────────────────────────────────────

    public string FullName => User?.FullName ?? "";
    public string Username => User?.Username ?? "";
    public string Phone => User?.Phone ?? "";
    public string Email => User?.Email ?? "";

    public string GuardianName => Profile?.GuardianName ?? "";
    public string GuardianPhone => Profile?.GuardianPhone ?? "";
    public string Address => Profile?.Address ?? "";

    public string Grade => Profile?.EnrolledGradeName ?? "";
    public string Level => Profile?.EnrolledLevelName ?? "";

    /// <summary>Mapped from the raw value, never from system_type_display.</summary>
    public string SystemTypeDisplay => SystemTypes.Display(Profile?.SystemType);

    /// <summary>
    /// Where المشرفة has no value the profile shows "توزيع إداري تلقائي" rather
    /// than a dash, matching the mobile app.
    /// </summary>
    public string SupervisorName => string.IsNullOrWhiteSpace(Profile?.SupervisorName)
        ? SystemTypes.NoSupervisor
        : Profile!.SupervisorName!;

    public string RegisteredAt => Profile?.RegisteredAt is { } at ? UiText.FormatDate(at) : "";

    // ── الملف المالي ─────────────────────────────────────────────────────────

    /// <summary>
    /// المتبقي, emphasised in warning. The payments table the design shows has
    /// no student-reachable endpoint — finance's StudentFinancialFileView is
    /// IsAdminOrManager — so only this figure is rendered.
    /// </summary>
    public string Balance => Profile?.Balance ?? "0.00";

    /// <summary>
    /// The figure with its unit. Sudanese pounds, not the design mock's د.ع —
    /// finance/models.py names the field balance_sdg.
    /// </summary>
    public string BalanceLabel => UiText.ToArabicIndicDigits(Balance) + " ج.س";

    // ── الجهاز المرتبط ───────────────────────────────────────────────────────

    public string DeviceType => Profile?.DeviceType ?? "";
    public string DeviceId => Profile?.DeviceId ?? "";
    public bool IsDeviceBound => Profile?.IsDeviceBound == true;

    public string DeviceBoundAt => Profile?.DeviceBoundAt is { } at ? UiText.FormatDate(at) : "";

    public const string UnbindExplanation =
        "لفك ارتباط الجهاز يرجى التواصل مع إدارة المدرسة.";

    /// <summary>The chrome renders it; this screen has nowhere of its own.</summary>
    public event EventHandler<ToastMessage>? Toasted;

    /// <summary>Set by the host to the platform clipboard.</summary>
    public Func<string, Task> ClipboardWriter { get; set; } = _ => Task.CompletedTask;

    /// <summary>
    /// The identifier must be copyable here as well as on both blocked screens:
    /// a student phoning the school to be unbound has to convey a string nobody
    /// can dictate accurately.
    /// </summary>
    [RelayCommand]
    private async Task CopyDeviceIdAsync()
    {
        if (string.IsNullOrWhiteSpace(DeviceId)) return;

        await ClipboardWriter(DeviceId).ConfigureAwait(true);
        Toasted?.Invoke(this, new ToastMessage(UiText.DeviceIdCopied));
    }
}
