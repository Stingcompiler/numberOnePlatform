using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NumberOne.Core.Models;
using NumberOne.Core.Services;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// The exams screen: المتاحة / المكتملة tabs, plus the in-progress banner.
/// </summary>
public sealed partial class ExamsViewModel : ObservableObject, ISearchable
{
    private readonly StudentApi _api;

    public ExamsViewModel(StudentApi api)
    {
        _api = api;
        Exams = new SectionState<List<ExamSummary>>(ct => _api.GetExamsAsync(ct), list => list.Count == 0);
    }

    public SectionState<List<ExamSummary>> Exams { get; }

    /// <summary>Raised by "ابدأ" / "متابعة".</summary>
    public event EventHandler<int>? ExamStarted;

    /// <summary>The label the top bar prints beside the title.</summary>
    public event EventHandler<string>? CountChanged;

    [ObservableProperty]
    [NotifyPropertyChangedFor(
        nameof(Available), nameof(Completed), nameof(ShowingAvailable),
        nameof(ShowingCompleted), nameof(IsFilteredEmpty))]
    private ExamTab _tab = ExamTab.Available;

    public bool ShowingAvailable => Tab == ExamTab.Available;
    public bool ShowingCompleted => Tab == ExamTab.Completed;

    // ── Search ───────────────────────────────────────────────────────────────

    public string SearchPlaceholder => "ابحث في الاختبارات";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(Available), nameof(Completed), nameof(IsFilteredEmpty))]
    private string _query = "";

    public void ApplySearch(string query) => Query = query;

    private IEnumerable<ExamSummary> Matching(IEnumerable<ExamSummary> exams)
    {
        if (string.IsNullOrWhiteSpace(Query)) return exams;

        var needle = Query.Trim();
        return exams.Where(e =>
            e.Title.Contains(needle, StringComparison.OrdinalIgnoreCase) ||
            e.CourseName.Contains(needle, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Never attempted. There is no server-side attempt limit, so "available"
    /// means "not yet tried" rather than "may still be tried".
    /// </summary>
    public IReadOnlyList<ExamSummary> Available =>
        Matching(Exams.Value?.Where(e => !e.HasBeenAttempted) ?? Enumerable.Empty<ExamSummary>()).ToList();

    public IReadOnlyList<ExamSummary> Completed =>
        Matching(Exams.Value?.Where(e => e.HasBeenAttempted) ?? Enumerable.Empty<ExamSummary>()).ToList();

    /// <summary>Rows exist on this tab, but the search hid them all.</summary>
    public bool IsFilteredEmpty =>
        Exams.HasData && (ShowingAvailable ? Available.Count : Completed.Count) == 0;

    [RelayCommand]
    private void ClearSearch() => Query = "";

    [RelayCommand]
    private void ShowAvailable() => Tab = ExamTab.Available;

    [RelayCommand]
    private void ShowCompleted() => Tab = ExamTab.Completed;

    [RelayCommand]
    private void StartExam(ExamSummary? exam)
    {
        if (exam is not null) ExamStarted?.Invoke(this, exam.Id);
    }

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        await Exams.LoadAsync(ct).ConfigureAwait(true);

        OnPropertyChanged(nameof(Available));
        OnPropertyChanged(nameof(Completed));
        OnPropertyChanged(nameof(IsFilteredEmpty));

        CountChanged?.Invoke(
            this, UiText.Count(Exams.Value?.Count ?? 0, "اختبار", "اختباران", "اختبارات", "واحد"));
    }
}

public enum ExamTab
{
    Available,
    Completed,
}
