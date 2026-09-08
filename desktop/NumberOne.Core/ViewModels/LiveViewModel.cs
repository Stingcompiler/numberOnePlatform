using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NumberOne.Core.Models;
using NumberOne.Core.Services;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// البث المباشر — rooms holding links that open Zoom / Meet / Teams / YouTube
/// OUTSIDE the app. Deliberately simple: no player, no embedded content.
///
/// The server filters rooms by the student's system_type. There is no
/// client-side filter and none is designed — adding one would silently hide
/// rooms the server meant to show, and mask a misconfiguration rather than
/// surfacing it.
/// </summary>
public sealed partial class LiveViewModel : ObservableObject
{
    private readonly StudentApi _api;

    public LiveViewModel(StudentApi api)
    {
        _api = api;
        Rooms = new SectionState<List<LiveRoom>>(ct => _api.GetLiveRoomsAsync(ct), list => list.Count == 0);
    }

    public SectionState<List<LiveRoom>> Rooms { get; }

    /// <summary>
    /// Opens a URL in the system browser. Supplied by the host so this view
    /// model stays free of platform types. Returns false when no browser could
    /// be launched.
    /// </summary>
    public Func<string, Task<bool>> BrowserLauncher { get; set; } = _ => Task.FromResult(false);

    /// <summary>Error and warning toasts; the host renders them.</summary>
    public event EventHandler<ToastMessage>? Toasted;

    /// <summary>The label the top bar prints beside the title.</summary>
    public event EventHandler<string>? CountChanged;

    public const string HeaderNote = "تُفتح الجلسات في المتصفح خارج التطبيق";

    [RelayCommand]
    private async Task JoinAsync(LiveSession? session)
    {
        if (session is null) return;

        // Ended and archived sessions render their action disabled, but guard
        // here too: the list can go stale while the screen is open.
        if (session.Status is LiveStatuses.Ended or LiveStatuses.Archived)
        {
            Toasted?.Invoke(this, new ToastMessage(
                "انتهت هذه الجلسة ولم يبقَ رابط للدخول", ToastKind.Warning));
            return;
        }

        if (string.IsNullOrWhiteSpace(session.StreamUrl) ||
            !Uri.TryCreate(session.StreamUrl, UriKind.Absolute, out var uri) ||
            uri.Scheme is not ("http" or "https"))
        {
            // A relative or non-http link is a data problem, not a student one.
            Toasted?.Invoke(this, new ToastMessage(
                "رابط الجلسة غير صالح — راجع الإدارة", ToastKind.Error));
            return;
        }

        if (await BrowserLauncher(session.StreamUrl!).ConfigureAwait(true))
        {
            Toasted?.Invoke(this, new ToastMessage(
                $"جارٍ فتح {session.ProviderLabel} في المتصفح…"));
        }
        else
        {
            Toasted?.Invoke(this, new ToastMessage(
                "تعذّر فتح المتصفح على هذا الجهاز", ToastKind.Error));
        }
    }

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        await Rooms.LoadAsync(ct).ConfigureAwait(true);

        // Sessions, not rooms: a student with three rooms and no sessions has
        // nothing to attend, and the count should say so.
        var sessions = Rooms.Value?.Sum(r => r.Sessions.Count) ?? 0;
        CountChanged?.Invoke(this, UiText.Count(sessions, "جلسة", "جلستان", "جلسات"));
    }
}
