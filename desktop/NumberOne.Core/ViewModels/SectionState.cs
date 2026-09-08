using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// Which of the four states a screen region is in. Every list, table and panel
/// needs all of them — a region with no empty state shows a blank box, and one
/// with no error state shows a blank box that never resolves.
/// </summary>
public enum SectionStatus
{
    Loading,
    Data,
    Empty,
    Error,
}

/// <summary>
/// One independently-loading region.
///
/// The dashboard aggregates four unrelated endpoints, and the design is
/// explicit that each owns its own state: a slow notifications feed must never
/// hold up the stat row. So each section loads, fails and retries by itself,
/// and a retry refetches only that section.
/// </summary>
public sealed partial class SectionState<T> : ObservableObject
{
    private readonly Func<CancellationToken, Task<T>> _load;
    private readonly Func<T, bool> _isEmpty;

    /// <summary>
    /// <paramref name="isEmpty"/> decides Empty vs Data. It is required rather
    /// than defaulted because "empty" differs per section — an empty list, a
    /// zero count, a null record — and guessing produces a section that shows
    /// its empty state while holding data.
    /// </summary>
    public SectionState(Func<CancellationToken, Task<T>> load, Func<T, bool> isEmpty)
    {
        _load = load;
        _isEmpty = isEmpty;
    }

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsLoading), nameof(HasData), nameof(IsEmpty), nameof(HasError))]
    private SectionStatus _status = SectionStatus.Loading;

    [ObservableProperty]
    private T? _value;

    /// <summary>The server's own message where there was one.</summary>
    [ObservableProperty]
    private string? _errorMessage;

    public bool IsLoading => Status == SectionStatus.Loading;
    public bool HasData => Status == SectionStatus.Data;
    public bool IsEmpty => Status == SectionStatus.Empty;
    public bool HasError => Status == SectionStatus.Error;

    /// <summary>
    /// Loads, or reloads after a failure. Never throws: a section that threw
    /// would take down the sibling sections it was supposed to be independent of.
    /// </summary>
    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        Status = SectionStatus.Loading;
        ErrorMessage = null;

        try
        {
            var value = await _load(ct).ConfigureAwait(true);

            Value = value;
            Status = _isEmpty(value) ? SectionStatus.Empty : SectionStatus.Data;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // The screen genuinely went away mid-flight. Leave the state alone.
            //
            // The guard is load-bearing. HttpClient reports its own timeout as a
            // TaskCanceledException, which derives from OperationCanceledException
            // — so an unguarded catch here swallows every timeout as if the caller
            // had cancelled, and the section spins on "جارٍ التحميل…" forever with
            // no error and no retry. Only a cancellation the caller actually
            // requested lands here; a timeout falls through to the handler below.
        }
        catch (Services.ApiRequestException ex)
        {
            ErrorMessage = ex.Message;
            Status = SectionStatus.Error;
        }
        catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException)
        {
            // Offline, or the request timed out waiting for a connection.
            ErrorMessage = Services.DesktopMessages.NoConnection;
            Status = SectionStatus.Error;
        }
    }
}
