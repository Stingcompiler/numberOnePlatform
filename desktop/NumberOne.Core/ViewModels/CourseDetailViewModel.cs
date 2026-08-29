using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NumberOne.Core.Models;
using NumberOne.Core.Services;

namespace NumberOne.Core.ViewModels;

/// <summary>
/// Course detail: a header region, three stat columns, and a units accordion.
///
/// The design is specific that loading here replaces the description and the
/// lesson rows with skeletons while the unit headers, mode pill and stat columns
/// stay — they arrive with the course record. This client gets the whole tree in
/// one call, so that distinction collapses; what remains is that the header
/// stays readable when the lessons fail.
/// </summary>
public sealed partial class CourseDetailViewModel : ObservableObject
{
    private readonly StudentApi _api;
    private readonly AuthService _auth;
    private readonly int _courseId;

    public CourseDetailViewModel(StudentApi api, AuthService auth, int courseId)
    {
        _api = api;
        _auth = auth;
        _courseId = courseId;

        Course = new SectionState<CourseDetail>(LoadDetailAsync, d => d.Units.Count == 0);
    }

    public SectionState<CourseDetail> Course { get; }

    /// <summary>Raised when a lesson row is opened.</summary>
    public event EventHandler<int>? LessonOpened;

    [RelayCommand]
    public Task LoadAsync(CancellationToken ct = default) => Course.LoadAsync(ct);

    [RelayCommand]
    private void OpenLesson(LessonRow? row)
    {
        if (row is not null) LessonOpened?.Invoke(this, row.Id);
    }

    private async Task<CourseDetail> LoadDetailAsync(CancellationToken ct)
    {
        var courseTask = _api.GetCourseAsync(_courseId, ct);
        var progressTask = _api.GetMyProgressAsync(ct);

        await Task.WhenAll(courseTask, progressTask).ConfigureAwait(true);

        var course = courseTask.Result
            ?? throw new InvalidOperationException($"Course {_courseId} returned no body.");

        var completed = progressTask.Result
            .Where(p => p.IsCompleted)
            .Select(p => p.Lesson)
            .ToHashSet();

        return CourseDetail.From(course, completed);
    }
}

/// <summary>A course with its units expanded for display.</summary>
public sealed record CourseDetail
{
    public required int Id { get; init; }
    public required string Name { get; init; }
    public required string? Description { get; init; }
    public required string TeacherName { get; init; }
    public required string SystemTypeDisplay { get; init; }
    public required bool IsOnline { get; init; }
    public required IReadOnlyList<UnitRow> Units { get; init; }

    public int UnitCount => Units.Count;
    public int LessonCount => Units.Sum(u => u.Lessons.Count);
    public int CompletedCount => Units.Sum(u => u.Lessons.Count(l => l.IsCompleted));

    public int Percent => LessonCount == 0 ? 0 : (int)Math.Round(CompletedCount * 100.0 / LessonCount);

    public string UnitCountLabel => UiText.ToArabicIndicDigits(UnitCount.ToString());
    public string LessonCountLabel => UiText.ToArabicIndicDigits(LessonCount.ToString());
    public string PercentLabel => UiText.ToArabicIndicDigits(Percent.ToString()) + "٪";

    /// <summary>
    /// The lesson to resume: the first unfinished one in order. Carries the
    /// leading bar and tint in the accordion. Null once everything is done.
    /// </summary>
    public LessonRow? CurrentLesson =>
        Units.SelectMany(u => u.Lessons).FirstOrDefault(l => !l.IsCompleted);

    public static CourseDetail From(Course course, IReadOnlySet<int> completedLessonIds)
    {
        var units = course.Units
            .OrderBy(u => u.DisplayOrder)
            .Select(u => new UnitRow
            {
                Id = u.Id,
                Name = u.Name,
                Lessons = u.Lessons
                    .OrderBy(l => l.DisplayOrder)
                    .Select((l, index) => new LessonRow
                    {
                        Id = l.Id,
                        Index = index + 1,
                        Title = l.Title,
                        DurationMinutes = l.DurationMinutes,
                        HasAttachment = l.HasAttachment,

                        // The list serializer does not carry the exercise, so a
                        // تمرين chip cannot be shown from here without a per-lesson
                        // fetch. Deliberately not attempted: N calls to decorate a
                        // list is the wrong trade.
                        IsCompleted = completedLessonIds.Contains(l.Id),
                    })
                    .ToList(),
            })
            .ToList();

        return new CourseDetail
        {
            Id = course.Id,
            Name = course.Name,
            Description = course.Description,
            TeacherName = string.IsNullOrWhiteSpace(course.TeacherName) ? "—" : course.TeacherName!,
            SystemTypeDisplay = SystemTypes.Display(course.SystemType),
            IsOnline = course.SystemType == SystemTypes.Online,
            Units = units,
        };
    }
}

public sealed record UnitRow
{
    public required int Id { get; init; }
    public required string Name { get; init; }
    public required IReadOnlyList<LessonRow> Lessons { get; init; }

    public int CompletedCount => Lessons.Count(l => l.IsCompleted);

    /// <summary>"٢ من ٥" for the unit footer.</summary>
    public string ProgressLabel =>
        $"{UiText.ToArabicIndicDigits(CompletedCount.ToString())} من " +
        $"{UiText.ToArabicIndicDigits(Lessons.Count.ToString())}";
}

public sealed record LessonRow
{
    public required int Id { get; init; }

    /// <summary>Position within its unit, 1-based.</summary>
    public required int Index { get; init; }

    public required string Title { get; init; }
    public required int? DurationMinutes { get; init; }
    public required bool HasAttachment { get; init; }
    public required bool IsCompleted { get; init; }

    public string IndexLabel => UiText.ToArabicIndicDigits(Index.ToString());

    /// <summary>"٢٤ دقيقة", or empty when the lesson carries no duration.</summary>
    public string DurationLabel => DurationMinutes is > 0
        ? $"{UiText.ToArabicIndicDigits(DurationMinutes.Value.ToString())} دقيقة"
        : "";

    public string StatusLabel => IsCompleted ? "مكتملة" : "";
}
