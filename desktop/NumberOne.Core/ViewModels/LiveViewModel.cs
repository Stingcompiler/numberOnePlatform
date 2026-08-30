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
    public event EventHandler<string>? Toast;

    public const string HeaderNote = "تُفتح الجلسات في المتصفح خارج التطبيق";

    [RelayCommand]
    private async Task JoinAsync(LiveSession? session)
    {
        if (session is null) return;

        // Ended and archived sessions render their action disabled, but guard
        // here too: the list can go stale while the screen is open.
        if (session.Status is LiveStatuses.Ended or LiveStatuses.Archived)
        {
            Toast?.Invoke(this, "انتهت هذه الجلسة ولم يبقَ رابط للدخول");
            return;
        }

        if (string.IsNullOrWhiteSpace(session.StreamUrl) ||
            !Uri.TryCreate(session.StreamUrl, UriKind.Absolute, out var uri) ||
            uri.Scheme is not ("http" or "https"))
        {
            // A relative or non-http link is a data problem, not a student one.
            Toast?.Invoke(this, "رابط الجلسة غير صالح — راجع الإدارة");
            return;
        }

        if (!await BrowserLauncher(session.StreamUrl!).ConfigureAwait(true))
            Toast?.Invoke(this, "تعذّر فتح المتصفح على هذا الجهاز");
    }

    [RelayCommand]
    public Task LoadAsync(CancellationToken ct = default) => Rooms.LoadAsync(ct);
}
