using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NumberOne.Core.Models;
using NumberOne.Core.Services;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// The courses screen: a dense table, not a card grid — الكورس / المدرّس /
/// النظام / التقدّم / المحتوى.
///
/// Courses and progress are two endpoints but one region here, unlike the
/// dashboard: a progress bar with no progress is worse than a moment's wait,
/// and the two are meaningless apart.
/// </summary>
public sealed partial class CoursesViewModel : ObservableObject, ISearchable
{
    private readonly StudentApi _api;
    private readonly AuthService _auth;

    public CoursesViewModel(StudentApi api, AuthService auth)
    {
        _api = api;
        _auth = auth;

        Courses = new SectionState<List<CourseRow>>(LoadRowsAsync, rows => rows.Count == 0);
    }

    public SectionState<List<CourseRow>> Courses { get; }

    /// <summary>Raised when a row is opened. The host navigates to the detail.</summary>
    public event EventHandler<int>? CourseOpened;

    /// <summary>The label the top bar prints beside the title.</summary>
    public event EventHandler<string>? CountChanged;

    // ── Search ───────────────────────────────────────────────────────────────

    public string SearchPlaceholder => "ابحث في الكورسات";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(Visible), nameof(HasRows), nameof(IsFilteredEmpty))]
    private string _query = "";

    public void ApplySearch(string query) => Query = query;

    /// <summary>Rows after the search. Matches the course name or the teacher.</summary>
    public IReadOnlyList<CourseRow> Visible
    {
        get
        {
            var rows = (IEnumerable<CourseRow>)(Courses.Value ?? new List<CourseRow>());

            if (!string.IsNullOrWhiteSpace(Query))
            {
                var needle = Query.Trim();
                rows = rows.Where(r =>
                    r.Name.Contains(needle, StringComparison.OrdinalIgnoreCase) ||
                    r.TeacherName.Contains(needle, StringComparison.OrdinalIgnoreCase));
            }

            return rows.ToList();
        }
    }

    public bool HasRows => Visible.Count > 0;

    /// <summary>
    /// The student has courses, but none match what they typed. A different
    /// message from "you have no courses", and a different remedy: clear the
    /// search rather than call the school.
    /// </summary>
    public bool IsFilteredEmpty => Courses.HasData && Visible.Count == 0;

    [RelayCommand]
    private void ClearSearch() => Query = "";

    [RelayCommand]
    public async Task LoadAsync(CancellationToken ct = default)
    {
        await Courses.LoadAsync(ct).ConfigureAwait(true);

        OnPropertyChanged(nameof(Visible));
        OnPropertyChanged(nameof(HasRows));
        OnPropertyChanged(nameof(IsFilteredEmpty));

        CountChanged?.Invoke(this, CountLabel());
    }

    /// <summary>"٦ كورسات" — plural forms, because Arabic has four of them.</summary>
    private string CountLabel() => UiText.Count(Courses.Value?.Count ?? 0, "كورس", "كورسان", "كورسات", "واحد");

    [RelayCommand]
    private void OpenCourse(CourseRow? row)
    {
        if (row is not null) CourseOpened?.Invoke(this, row.Id);
    }

    private async Task<List<CourseRow>> LoadRowsAsync(CancellationToken ct)
    {
        // Both are needed before a single row can render honestly, so they are
        // fetched together rather than letting the table paint with every bar
        // at zero and then jump.
        var coursesTask = _api.GetMyCoursesAsync(_auth.CurrentUser?.StudentProfile, ct);
        var progressTask = _api.GetMyProgressAsync(ct);

        await Task.WhenAll(coursesTask, progressTask).ConfigureAwait(true);

        var completed = progressTask.Result
            .Where(p => p.IsCompleted)
            .Select(p => p.Lesson)
            .ToHashSet();

        return coursesTask.Result
            .Select(c => CourseRow.From(c, completed))
            .ToList();
    }
}

/// <summary>One row of the courses table.</summary>
public sealed record CourseRow
{
    public required int Id { get; init; }
    public required string Name { get; init; }

    /// <summary>Falls back to a dash: an unassigned course is not an error.</summary>
    public required string TeacherName { get; init; }

    /// <summary>
    /// عبر الإنترنت / بدون إنترنت (فلاش), mapped from the raw system_type.
    ///
    /// Never bound to the server's system_type_display, whose values are
    /// "أونلاين"/"فلاش" — binding to it is exactly what makes a student see two
    /// different words for one enrollment type across the two clients.
    /// </summary>
    public required string SystemTypeDisplay { get; init; }

    /// <summary>True for online, which tints the pill blue rather than red.</summary>
    public required bool IsOnline { get; init; }

    public required int LessonCount { get; init; }
    public required int UnitCount { get; init; }
    public required int CompletedCount { get; init; }

    public int Percent => LessonCount == 0 ? 0 : (int)Math.Round(CompletedCount * 100.0 / LessonCount);

    /// <summary>"٧٥٪" — content digits are Arabic-Indic.</summary>
    public string PercentLabel => UiText.ToArabicIndicDigits(Percent.ToString()) + "٪";

    /// <summary>The fill fraction the progress bar binds to.</summary>
    public double Fraction => Percent / 100.0;

    /// <summary>"٣ وحدات · ١٢ محاضرة" for the المحتوى column.</summary>
    public string ContentLabel =>
        $"{UiText.Count(UnitCount, "وحدة", "وحدتان", "وحدات")} · " +
        $"{UiText.Count(LessonCount, "محاضرة", "محاضرتان", "محاضرات")}";

    public static CourseRow From(Course course, IReadOnlySet<int> completedLessonIds)
    {
        var lessons = course.AllLessons.ToList();

        return new CourseRow
        {
            Id = course.Id,
            Name = course.Name,
            TeacherName = string.IsNullOrWhiteSpace(course.TeacherName) ? "—" : course.TeacherName!,
            SystemTypeDisplay = SystemTypes.Display(course.SystemType),
            IsOnline = course.SystemType == SystemTypes.Online,
            UnitCount = course.Units.Count,

            // Course.LessonCount, not lessons.Count: the online list endpoint
            // omits units entirely and carries only lesson_count, so counting
            // the nested collection would render every row as zero.
            LessonCount = course.LessonCount,
            CompletedCount = lessons.Count(l => completedLessonIds.Contains(l.Id)),
        };
    }
}
