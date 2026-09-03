using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NumberOne.Core.Models;
using NumberOne.Core.Services;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// الإشعارات — date-grouped, with "تعليم الكل كمقروء".
///
/// The mobile app receives these by Expo push. There is no desktop equivalent
/// and /notifications/register-token/ stores Expo tokens only, so this client
/// polls the unread count instead. No backend change is needed for that.
/// </summary>
public sealed partial class NotificationsViewModel : ObservableObject
{
    private readonly StudentApi _api;

    public NotificationsViewModel(StudentApi api)
    {
        _api = api;

        Notifications = new SectionState<List<Notification>>(
            async ct => (await _api.GetNotificationsAsync(1, ct).ConfigureAwait(true)).Results,
            list => list.Count == 0);
    }

    public SectionState<List<Notification>> Notifications { get; }

    /// <summary>The label the top bar prints beside the title.</summary>
    public event EventHandler<string>? CountChanged;

    /// <summary>
    /// Raised after a read or a mark-all. The chrome owns the badge and has no
    /// other way to know the count just changed under it.
    /// </summary>
    public event EventHandler? ReadStateChanged;

    /// <summary>Drives the sidebar and top-bar badges.</summary>
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(BadgeLabel), nameof(HasUnread))]
    private int _unreadCount;

    public bool HasUnread => UnreadCount > 0;

    /// <summary>Zero hides the badge; over 99 renders "٩٩+".</summary>
    public string BadgeLabel => UnreadCount switch
    {
        <= 0 => "",
        > 99 => "٩٩+",
        _ => UiText.ToArabicIndicDigits(UnreadCount.ToString()),
    };

    /// <summary>
    /// Grouped اليوم / أمس / then by date. Grouping is on local dates, so a
    /// notification at 23:50 does not fall into "yesterday" for a student in a
    /// different offset than the server.
    /// </summary>
    public IReadOnlyList<NotificationGroup> Groups
    {
        get
        {
            if (Notifications.Value is null) return Array.Empty<NotificationGroup>();

            var today = DateTimeOffset.Now.ToLocalTime().Date;

            return Notifications.Value
                .GroupBy(n => n.CreatedAt.ToLocalTime().Date)
                .OrderByDescending(g => g.Key)
                .Select(g => new NotificationGroup(
                    Label: g.Key == today ? "اليوم"
                         : g.Key == today.AddDays(-1) ? "أمس"
                         : UiText.FormatDate(new DateTimeOffset(g.Key, DateTimeOffset.Now.Offset)),
                    Items: g.OrderByDescending(n => n.CreatedAt).ToList()))
                .ToList();
        }
    }

    [RelayCommand]
    private async Task MarkReadAsync(Notification? notification, CancellationToken ct = default)
    {
        if (notification is null || notification.IsRead) return;

        // Never throws. Reading a notification is not worth an error panel, but
        // it was worth a crash before this: the call was bare inside a command.
        var attempt = await ApiAttempt
            .TryAsync(token => _api.MarkNotificationReadAsync(notification.Id, token), ct)
            .ConfigureAwait(true);

        if (!attempt.Ok || !attempt.Value) return;

        // Refetch rather than mutating in place: Notification is an immutable
        // DTO, and the badge has to come from the server anyway.
        await LoadAsync(ct).ConfigureAwait(true);
        ReadStateChanged?.Invoke(this, EventArgs.Empty);
    }

    [RelayCommand]
    private async Task MarkAllReadAsync(CancellationToken ct = default)
    {
        var attempt = await ApiAttempt
            .TryAsync(_api.MarkAllNotificationsReadAsync, ct)
            .ConfigureAwait(true);

        if (!attempt.Ok || !attempt.Value) return;

        await LoadAsync(ct).ConfigureAwait(true);
        ReadStateChanged?.Invoke(this, EventArgs.Empty);
    }

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        await Notifications.LoadAsync(ct).ConfigureAwait(true);
        OnPropertyChanged(nameof(Groups));

        CountChanged?.Invoke(
            this, UiText.Count(Notifications.Value?.Count ?? 0, "إشعار", "إشعاران", "إشعارات", "واحد"));

        await RefreshBadgeAsync(ct).ConfigureAwait(true);
    }

    /// <summary>
    /// Polled to keep the badge current. Swallows failures: a badge that cannot
    /// refresh is not worth an error row on a screen the student may not even
    /// be looking at.
    /// </summary>
    public async Task RefreshBadgeAsync(CancellationToken ct = default)
    {
        try
        {
            UnreadCount = await _api.GetUnreadCountAsync(ct).ConfigureAwait(true);
        }
        catch (Exception ex) when (ex is ApiRequestException or HttpRequestException or OperationCanceledException)
        {
            // Leave the previous count showing rather than flashing to zero.
        }
    }
}

public sealed record NotificationGroup(string Label, IReadOnlyList<Notification> Items);
