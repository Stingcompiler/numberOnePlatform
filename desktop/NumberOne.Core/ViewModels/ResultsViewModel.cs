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
public sealed partial class ResultsViewModel : ObservableObject, ISearchable
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

    /// <summary>The label the top bar prints beside the title.</summary>
    public event EventHandler<string>? CountChanged;

    // ── Search and filters ───────────────────────────────────────────────────

    public string SearchPlaceholder => "ابحث في النتائج";

    public void ApplySearch(string query) => Query = query;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(Visible), nameof(PageRows), nameof(PageLabel),
                              nameof(ShownLabel), nameof(IsFilteredEmpty))]
    private string _query = "";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(Visible), nameof(PageRows), nameof(PageLabel),
                              nameof(ShownLabel), nameof(IsFilteredEmpty),
                              nameof(IsAllSelected), nameof(IsPassedSelected), nameof(IsFailedSelected))]
    private VerdictFilter _verdict = VerdictFilter.All;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(Visible), nameof(PageRows))]
    private ResultSort _sort = ResultSort.DateDescending;

    public bool IsAllSelected => Verdict == VerdictFilter.All;
    public bool IsPassedSelected => Verdict == VerdictFilter.Passed;
    public bool IsFailedSelected => Verdict == VerdictFilter.Failed;

    /// <summary>The rows after search, filter and sort — before paging.</summary>
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
                ResultSort.TitleAscending => rows.OrderBy(r => r.ExamTitle, StringComparer.CurrentCulture).ToList(),
                ResultSort.TitleDescending => rows.OrderByDescending(r => r.ExamTitle, StringComparer.CurrentCulture).ToList(),
                ResultSort.CourseAscending => rows.OrderBy(r => r.CourseName, StringComparer.CurrentCulture).ToList(),
                ResultSort.CourseDescending => rows.OrderByDescending(r => r.CourseName, StringComparer.CurrentCulture).ToList(),
                _ => rows.OrderByDescending(r => r.SubmittedAt).ToList(),
            };
        }
    }

    public bool IsFilteredEmpty => Results.HasData && Visible.Count == 0;

    // ── Paging ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Eight rows to a page. The table sits under a summary and above the
    /// pager on a 900px-tall window; more than eight and the pager falls below
    /// the fold, which is the one place it must not be.
    /// </summary>
    public const int PageSize = 8;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(PageRows), nameof(PageLabel), nameof(CanGoBack), nameof(CanGoForward))]
    private int _page = 1;

    public int PageCount => Math.Max(1, (int)Math.Ceiling(Visible.Count / (double)PageSize));

    /// <summary>The rows actually rendered: the current page of the filtered set.</summary>
    public IReadOnlyList<ResultRow> PageRows =>
        Visible.Skip((Math.Clamp(Page, 1, PageCount) - 1) * PageSize).Take(PageSize).ToList();

    public bool CanGoBack => Page > 1;
    public bool CanGoForward => Page < PageCount;

    public string PageLabel =>
        $"صفحة {UiText.ToArabicIndicDigits(Math.Clamp(Page, 1, PageCount).ToString())} " +
        $"من {UiText.ToArabicIndicDigits(PageCount.ToString())}";

    /// <summary>"عرض ٨ من ١٣" — what the filter left, against the whole record.</summary>
    public string ShownLabel =>
        $"عرض {UiText.ToArabicIndicDigits(Visible.Count.ToString())} " +
        $"من {UiText.ToArabicIndicDigits(TotalCount.ToString())}";

    [RelayCommand]
    private void NextPage() { if (CanGoForward) Page++; }

    [RelayCommand]
    private void PreviousPage() { if (CanGoBack) Page--; }

    // ── Summary ──────────────────────────────────────────────────────────────

    public int TotalCount => Results.Value?.Count ?? 0;
    public int PassedCount => Results.Value?.Count(r => r.IsPassed) ?? 0;
    public int FailedCount => TotalCount - PassedCount;

    /// <summary>Mean percentage across every attempt, whole percent.</summary>
    public int AveragePercent => Results.Value is { Count: > 0 } rows
        ? (int)Math.Round(rows.Average(r => r.Percentage))
        : 0;

    public string AverageLabel => UiText.ToArabicIndicDigits(AveragePercent.ToString()) + "٪";

    /// <summary>"١١" over the caption "من ١٣ اختباراً".</summary>
    public string PassedCaption => $"من {UiText.ToArabicIndicDigits(TotalCount.ToString())} محاولة";

    /// <summary>The single best attempt, for the أعلى درجة card.</summary>
    private ResultRow? Best => Results.Value?.OrderByDescending(r => r.Percentage).FirstOrDefault();

    public string BestScoreLabel => Best?.ScoreLabel ?? "—";
    public string BestExamName => Best?.ExamTitle ?? "";

    public bool HasFailures => FailedCount > 0;

    [RelayCommand]
    private void OpenAttempt(ResultRow? row)
    {
        if (row is not null) AttemptOpened?.Invoke(this, row.AttemptId);
    }

    [RelayCommand]
    private void FilterAll() => SetVerdict(VerdictFilter.All);

    [RelayCommand]
    private void FilterPassed() => SetVerdict(VerdictFilter.Passed);

    [RelayCommand]
    private void FilterFailed() => SetVerdict(VerdictFilter.Failed);

    private void SetVerdict(VerdictFilter verdict)
    {
        Verdict = verdict;

        // Page 3 of an unfiltered table is usually past the end of a filtered
        // one, and an empty page reads as "no results" rather than "wrong page".
        Page = 1;
    }

    // ── Sorting ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Each header toggles its own column between ascending and descending, and
    /// switching columns starts that column at its natural direction: names
    /// ascending, dates and scores descending.
    /// </summary>
    [RelayCommand]
    private void SortByTitle() => Sort =
        Sort == ResultSort.TitleAscending ? ResultSort.TitleDescending : ResultSort.TitleAscending;

    [RelayCommand]
    private void SortByCourse() => Sort =
        Sort == ResultSort.CourseAscending ? ResultSort.CourseDescending : ResultSort.CourseAscending;

    [RelayCommand]
    private void SortByDate() => Sort =
        Sort == ResultSort.DateDescending ? ResultSort.DateAscending : ResultSort.DateDescending;

    [RelayCommand]
    private void SortByScore() => Sort =
        Sort == ResultSort.ScoreDescending ? ResultSort.ScoreAscending : ResultSort.ScoreDescending;

    [RelayCommand]
    private void ClearFilters()
    {
        Query = "";
        Verdict = VerdictFilter.All;
        Page = 1;
    }

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        await Results.LoadAsync(ct).ConfigureAwait(true);

        Page = 1;

        OnPropertyChanged(nameof(Visible));
        OnPropertyChanged(nameof(PageRows));
        OnPropertyChanged(nameof(PageLabel));
        OnPropertyChanged(nameof(ShownLabel));
        OnPropertyChanged(nameof(IsFilteredEmpty));
        OnPropertyChanged(nameof(TotalCount));
        OnPropertyChanged(nameof(PassedCount));
        OnPropertyChanged(nameof(FailedCount));
        OnPropertyChanged(nameof(HasFailures));
        OnPropertyChanged(nameof(AveragePercent));
        OnPropertyChanged(nameof(AverageLabel));
        OnPropertyChanged(nameof(PassedCaption));
        OnPropertyChanged(nameof(BestScoreLabel));
        OnPropertyChanged(nameof(BestExamName));

        CountChanged?.Invoke(this, UiText.Count(TotalCount, "نتيجة", "نتيجتان", "نتائج"));
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
    TitleAscending,
    TitleDescending,
    CourseAscending,
    CourseDescending,
}
