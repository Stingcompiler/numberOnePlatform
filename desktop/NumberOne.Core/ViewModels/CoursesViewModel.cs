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
public sealed partial class CoursesViewModel : ObservableObject
{
    private readonly StudentApi _api;

    public CoursesViewModel(StudentApi api)
    {
        _api = api;

        Courses = new SectionState<List<CourseRow>>(LoadRowsAsync, rows => rows.Count == 0);
    }

    public SectionState<List<CourseRow>> Courses { get; }

    /// <summary>Raised when a row is opened. The host navigates to the detail.</summary>
    public event EventHandler<int>? CourseOpened;

    [RelayCommand]
    public Task LoadAsync(CancellationToken ct = default) => Courses.LoadAsync(ct);

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
        var coursesTask = _api.GetMyCoursesAsync(ct);
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

    /// <summary>"٣ وحدات · ١٢ محاضرة" for the المحتوى column.</summary>
    public string ContentLabel =>
        $"{UiText.ToArabicIndicDigits(UnitCount.ToString())} وحدات · " +
        $"{UiText.ToArabicIndicDigits(LessonCount.ToString())} محاضرة";

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
            LessonCount = lessons.Count,
            CompletedCount = lessons.Count(l => completedLessonIds.Contains(l.Id)),
        };
    }
}
