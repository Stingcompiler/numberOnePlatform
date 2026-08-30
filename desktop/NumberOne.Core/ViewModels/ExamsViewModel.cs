using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NumberOne.Core.Models;
using NumberOne.Core.Services;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// The exams screen: المتاحة / المكتملة tabs, plus the in-progress banner.
/// </summary>
public sealed partial class ExamsViewModel : ObservableObject
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

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(Available), nameof(Completed), nameof(ShowingAvailable))]
    private ExamTab _tab = ExamTab.Available;

    public bool ShowingAvailable => Tab == ExamTab.Available;

    /// <summary>
    /// Never attempted. There is no server-side attempt limit, so "available"
    /// means "not yet tried" rather than "may still be tried".
    /// </summary>
    public IReadOnlyList<ExamSummary> Available =>
        Exams.Value?.Where(e => !e.HasBeenAttempted).ToList() ?? new List<ExamSummary>();

    public IReadOnlyList<ExamSummary> Completed =>
        Exams.Value?.Where(e => e.HasBeenAttempted).ToList() ?? new List<ExamSummary>();

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
    }
}

public enum ExamTab
{
    Available,
    Completed,
}
