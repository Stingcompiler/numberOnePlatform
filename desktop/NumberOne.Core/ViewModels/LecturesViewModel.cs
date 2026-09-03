using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NumberOne.Core.Models;
using NumberOne.Core.Services;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// المحاضرات — every lecture the student can open, across every course, in one
/// flat table.
///
/// The courses screen answers "how far am I through each subject". This answers
/// a different question: "what have I not watched yet". A student who has six
/// courses open cannot see that from six separate trees, and the mobile app's
/// quick-access grid offers this as its own destination.
///
/// It costs one extra request beyond what the courses screen already makes:
/// /academic/my-courses/ serialises with StudentCourseSerializer, which nests
/// units and their lessons, so the whole tree arrives in the same payload. No
/// per-course fetch, and no new endpoint.
/// </summary>
public sealed partial class LecturesViewModel : ObservableObject, ISearchable
{
    private readonly StudentApi _api;
    private readonly AuthService _auth;

    public LecturesViewModel(StudentApi api, AuthService auth)
    {
        _api = api;
        _auth = auth;

        Lectures = new SectionState<List<LectureRow>>(LoadRowsAsync, rows => rows.Count == 0);
    }

    public SectionState<List<LectureRow>> Lectures { get; }

    /// <summary>Raised when a row is opened; carries the lecture and its course.</summary>
    public event EventHandler<(int LessonId, int CourseId)>? LectureOpened;

    /// <summary>The label the top bar prints beside the title.</summary>
    public event EventHandler<string>? CountChanged;

    // ── Search and filter ────────────────────────────────────────────────────

    public string SearchPlaceholder => "ابحث في المحاضرات";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(Visible), nameof(HasRows), nameof(IsFilteredEmpty))]
    private string _query = "";

    public void ApplySearch(string query) => Query = query;

    /// <summary>
    /// Hides what is already watched. The point of a flat list of every lecture
    /// is finding the next one, and by mid-term most of the rows are done.
    /// </summary>
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(Visible), nameof(HasRows), nameof(IsFilteredEmpty))]
    private bool _unwatchedOnly;

    [RelayCommand]
    private void ShowAll() => UnwatchedOnly = false;

    [RelayCommand]
    private void ShowUnwatched() => UnwatchedOnly = true;

    public bool ShowingAll => !UnwatchedOnly;

    /// <summary>Rows after the search and the filter, in course then unit order.</summary>
    public IReadOnlyList<LectureRow> Visible
    {
        get
        {
            var rows = (IEnumerable<LectureRow>)(Lectures.Value ?? new List<LectureRow>());

            if (UnwatchedOnly)
                rows = rows.Where(r => !r.IsCompleted);

            if (!string.IsNullOrWhiteSpace(Query))
            {
                var needle = Query.Trim();
                rows = rows.Where(r =>
                    r.Title.Contains(needle, StringComparison.OrdinalIgnoreCase) ||
                    r.CourseName.Contains(needle, StringComparison.OrdinalIgnoreCase) ||
                    r.UnitName.Contains(needle, StringComparison.OrdinalIgnoreCase));
            }

            return rows.ToList();
        }
    }

    public bool HasRows => Visible.Count > 0;

    /// <summary>
    /// Rows exist, but the search or the filter hid them all. A different state
    /// from "no lectures", with a different remedy.
    /// </summary>
    public bool IsFilteredEmpty => Lectures.HasData && Visible.Count == 0;

    [RelayCommand]
    private void ClearFilters()
    {
        Query = "";
        UnwatchedOnly = false;
    }

    [RelayCommand]
    private void OpenLecture(LectureRow? row)
    {
        if (row is not null) LectureOpened?.Invoke(this, (row.Id, row.CourseId));
    }

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        await Lectures.LoadAsync(ct).ConfigureAwait(true);

        OnPropertyChanged(nameof(Visible));
        OnPropertyChanged(nameof(HasRows));
        OnPropertyChanged(nameof(IsFilteredEmpty));
        OnPropertyChanged(nameof(WatchedLabel));

        CountChanged?.Invoke(
            this, UiText.Count(Lectures.Value?.Count ?? 0, "محاضرة", "محاضرتان", "محاضرات"));
    }

    /// <summary>"٤٨ من ٦٠ مكتملة" — the whole point of the screen, in one line.</summary>
    public string WatchedLabel
    {
        get
        {
            var all = Lectures.Value;
            if (all is null || all.Count == 0) return "";

            var done = all.Count(r => r.IsCompleted);

            return $"{UiText.ToArabicIndicDigits(done.ToString())} من " +
                   $"{UiText.ToArabicIndicDigits(all.Count.ToString())} مكتملة";
        }
    }

    private async Task<List<LectureRow>> LoadRowsAsync(CancellationToken ct)
    {
        // The same pair the courses screen fetches. Both are needed before a
        // row can say whether it has been watched, and a table that painted
        // every lecture as unwatched and then corrected itself would be worse
        // than a moment's wait.
        var coursesTask = _api.GetMyCoursesAsync(_auth.CurrentUser?.StudentProfile, ct);
        var progressTask = _api.GetMyProgressAsync(ct);

        await Task.WhenAll(coursesTask, progressTask).ConfigureAwait(true);

        var completed = progressTask.Result
            .Where(p => p.IsCompleted)
            .Select(p => p.Lesson)
            .ToHashSet();

        return coursesTask.Result
            .SelectMany(course => course.Units
                .OrderBy(unit => unit.DisplayOrder)
                .SelectMany(unit => unit.Lessons
                    .OrderBy(lesson => lesson.DisplayOrder)
                    .Select(lesson => new LectureRow
                    {
                        Id = lesson.Id,
                        Title = lesson.Title,
                        CourseId = course.Id,
                        CourseName = course.Name,
                        UnitName = unit.Name,
                        DurationMinutes = lesson.DurationMinutes,
                        HasAttachment = lesson.HasAttachment,
                        IsCompleted = completed.Contains(lesson.Id),
                    })))
            .ToList();
    }
}

/// <summary>One row of the lectures table.</summary>
public sealed record LectureRow
{
    public required int Id { get; init; }
    public required string Title { get; init; }

    /// <summary>Needed to open the lecture: the player builds its unit rail from the course.</summary>
    public required int CourseId { get; init; }

    public required string CourseName { get; init; }
    public required string UnitName { get; init; }
    public required int? DurationMinutes { get; init; }
    public required bool HasAttachment { get; init; }
    public required bool IsCompleted { get; init; }

    /// <summary>"٢٤ دقيقة", or empty — duration_minutes is optional on Lesson.</summary>
    public string DurationLabel => DurationMinutes is > 0
        ? UiText.Count(DurationMinutes.Value, "دقيقة", "دقيقتان", "دقائق")
        : "";

    public string StatusLabel => IsCompleted ? "مكتملة" : "";
}
