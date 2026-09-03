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
        catch (Exception ex)
        {
            // Anything else is a defect, not a network failure — a payload that
            // will not deserialise, a null nobody expected.
            //
            // It used to be left to propagate, on the reasoning that a bug
            // should not hide behind "no connection". That reasoning was right
            // about the message and wrong about the consequence: several of
            // these loads are started fire-and-forget, so nothing observes the
            // exception and it takes the process with it. The student gets a
            // window that closes and no way to say what happened.
            //
            // So it is caught and shown as its own state — distinct wording, so
            // it never reads as a connection problem — and handed to
            // Unexpected, which the app points at its crash log. The section
            // fails; the app does not.
            SectionDiagnostics.Report(ex);

            ErrorMessage = Services.DesktopMessages.SectionFailed;
            Status = SectionStatus.Error;
        }
    }

}

/// <summary>
/// Where a section sends a failure that is a defect rather than a network
/// condition.
///
/// NOT a static on SectionState&lt;T&gt;: a static field on a generic type
/// exists once per closed type, so assigning SectionState&lt;object&gt; would
/// leave SectionState&lt;List&lt;Course&gt;&gt; and every other instantiation
/// with their own null. One non-generic holder is the only way every section
/// reaches the same sink.
///
/// Core has no logger of its own, so the app assigns the platform's crash log
/// at startup. With nothing subscribed the student still sees a failed section
/// — the defect simply goes unrecorded.
/// </summary>
public static class SectionDiagnostics
{
    public static Action<Exception>? Unexpected { get; set; }

    internal static void Report(Exception ex)
    {
        try { Unexpected?.Invoke(ex); }
        catch (Exception) { /* a reporter that throws must not replace the fault */ }
    }
}
