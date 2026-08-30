using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NumberOne.Core.Models;
using NumberOne.Core.Services;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// النتائج — a performance summary and a sortable, filterable results table.
///
/// The table is READ-ONLY history, deliberately. There is no delete action and
/// no export, and neither should be added: a student able to delete their own
/// exam record makes the academic record falsifiable by the very person it
/// grades — a failed exam could disappear before a parent saw it. The backend
/// has no endpoint for either operation.
/// </summary>
public sealed partial class ResultsViewModel : ObservableObject
{
    private readonly StudentApi _api;

    public ResultsViewModel(StudentApi api)
    {
        _api = api;
        Results = new SectionState<List<ResultRow>>(LoadRowsAsync, list => list.Count == 0);
    }

    public SectionState<List<ResultRow>> Results { get; }

    /// <summary>Raised by the only row action there is: "عرض التفاصيل".</summary>
    public event EventHandler<int>? AttemptOpened;

    // ── Filters ──────────────────────────────────────────────────────────────

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(Visible))]
    private string _query = "";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(Visible))]
    private VerdictFilter _verdict = VerdictFilter.All;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(Visible))]
    private ResultSort _sort = ResultSort.DateDescending;

    /// <summary>The rows after search, filter and sort.</summary>
    public IReadOnlyList<ResultRow> Visible
    {
        get
        {
            var rows = (IEnumerable<ResultRow>)(Results.Value ?? new List<ResultRow>());

            if (!string.IsNullOrWhiteSpace(Query))
            {
                var needle = Query.Trim();
                rows = rows.Where(r =>
                    r.ExamTitle.Contains(needle, StringComparison.OrdinalIgnoreCase) ||
                    r.CourseName.Contains(needle, StringComparison.OrdinalIgnoreCase));
            }

            rows = Verdict switch
            {
                VerdictFilter.Passed => rows.Where(r => r.IsPassed),
                VerdictFilter.Failed => rows.Where(r => !r.IsPassed),
                _ => rows,
            };

            return Sort switch
            {
                ResultSort.DateAscending => rows.OrderBy(r => r.SubmittedAt).ToList(),
                ResultSort.ScoreDescending => rows.OrderByDescending(r => r.Percentage).ToList(),
                ResultSort.ScoreAscending => rows.OrderBy(r => r.Percentage).ToList(),
                _ => rows.OrderByDescending(r => r.SubmittedAt).ToList(),
            };
        }
    }

    // ── Summary ──────────────────────────────────────────────────────────────

    public int TotalCount => Results.Value?.Count ?? 0;
    public int PassedCount => Results.Value?.Count(r => r.IsPassed) ?? 0;
    public int FailedCount => TotalCount - PassedCount;

    /// <summary>Mean percentage across every attempt, whole percent.</summary>
    public int AveragePercent => Results.Value is { Count: > 0 } rows
        ? (int)Math.Round(rows.Average(r => r.Percentage))
        : 0;

    [RelayCommand]
    private void OpenAttempt(ResultRow? row)
    {
        if (row is not null) AttemptOpened?.Invoke(this, row.AttemptId);
    }

    [RelayCommand]
    private void FilterAll() => Verdict = VerdictFilter.All;

    [RelayCommand]
    private void FilterPassed() => Verdict = VerdictFilter.Passed;

    [RelayCommand]
    private void FilterFailed() => Verdict = VerdictFilter.Failed;

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        await Results.LoadAsync(ct).ConfigureAwait(true);

        OnPropertyChanged(nameof(Visible));
        OnPropertyChanged(nameof(TotalCount));
        OnPropertyChanged(nameof(PassedCount));
        OnPropertyChanged(nameof(FailedCount));
        OnPropertyChanged(nameof(AveragePercent));
    }

    /// <summary>
    /// Results are derived from the exams list rather than a results endpoint:
    /// every attempt already rides along on /exams/student/list/, so there is
    /// nothing further to fetch.
    /// </summary>
    private async Task<List<ResultRow>> LoadRowsAsync(CancellationToken ct)
    {
        var exams = await _api.GetExamsAsync(ct).ConfigureAwait(true);

        return exams
            .SelectMany(exam => exam.Attempts.Select(attempt => new ResultRow
            {
                AttemptId = attempt.Id,
                ExamTitle = exam.Title,
                CourseName = exam.CourseName,
                Score = attempt.Score,
                TotalMarks = exam.TotalMarks,
                Percentage = attempt.Percentage,
                IsPassed = attempt.IsPassed,
                SubmittedAt = attempt.SubmittedAt,
            }))
            .OrderByDescending(r => r.SubmittedAt)
            .ToList();
    }
}

public sealed record ResultRow
{
    public required int AttemptId { get; init; }
    public required string ExamTitle { get; init; }
    public required string CourseName { get; init; }
    public required double Score { get; init; }
    public required double TotalMarks { get; init; }
    public required double Percentage { get; init; }
    public required bool IsPassed { get; init; }
    public required DateTimeOffset? SubmittedAt { get; init; }

    /// <summary>"٤٢ / ٥٠", right-aligned tabular.</summary>
    public string ScoreLabel =>
        $"{UiText.ToArabicIndicDigits(Format(Score))} / {UiText.ToArabicIndicDigits(Format(TotalMarks))}";

    public string VerdictLabel => IsPassed ? "ناجح" : "راسب";

    /// <summary>Year/month/day, matching every other date in the app.</summary>
    public string DateLabel => SubmittedAt is { } at ? UiText.FormatDate(at) : "";

    private static string Format(double value) =>
        value == Math.Floor(value) ? ((int)value).ToString() : value.ToString("0.##");
}

public enum VerdictFilter
{
    All,
    Passed,
    Failed,
}

public enum ResultSort
{
    DateDescending,
    DateAscending,
    ScoreDescending,
    ScoreAscending,
}
