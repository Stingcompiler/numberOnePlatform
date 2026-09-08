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
    public string Phone => OrDash(User?.Phone);
    public string Email => User?.Email ?? "";

    public string GuardianName => OrDash(Profile?.GuardianName);
    public string GuardianPhone => OrDash(Profile?.GuardianPhone);
    public string Address => OrDash(Profile?.Address);

    public string Grade => Profile?.EnrolledGradeName ?? "";
    public string Level => Profile?.EnrolledLevelName ?? "";

    /// <summary>Mapped from the raw value, never from system_type_display.</summary>
    public string SystemTypeDisplay => SystemTypes.Display(Profile?.SystemType);

    /// <summary>
    /// A dash where a field was never filled in.
    ///
    /// Nearly everything on a student record is optional, and the profile
    /// screen sets each value under its own label with nothing drawn around
    /// it - so an empty string leaves a heading with a gap beneath it, which
    /// reads as the screen having failed rather than as a blank the school
    /// never filled. The dash says "we know, and there is nothing here".
    ///
    /// Only the four optional fields take it, and they are shown on the
    /// profile and nowhere else - so it cannot reach the watermark, a
    /// greeting, or anything that would look wrong carrying a dash.
    /// </summary>
    private static string OrDash(string? value) =>
        string.IsNullOrWhiteSpace(value) ? "—" : value;

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

    /// <summary>
    /// True when there is something left to pay.
    ///
    /// The figure used to be painted amber whatever it said, so a student who
    /// owed nothing was shown the same warning as one who owed a term's fees.
    /// A settled account should read as settled.
    ///
    /// Parsed invariantly: the server sends a decimal string like "0.00", and
    /// a machine set to a comma decimal separator would otherwise read 0.00 as
    /// nothing at all and call every account settled.
    /// </summary>
    public bool HasOutstandingBalance =>
        decimal.TryParse(Balance, System.Globalization.NumberStyles.Any,
                         System.Globalization.CultureInfo.InvariantCulture, out var due) && due > 0m;

    /// <summary>What the figure means, said plainly under it.</summary>
    public string BalanceCaption =>
        HasOutstandingBalance ? "مستحق على حسابك" : "لا توجد مستحقات على حسابك";

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
