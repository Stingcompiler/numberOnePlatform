using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using NumberOne.Core.Api;
using NumberOne.Core.Models;

namespace NumberOne.Core.Services;

/// <summary>
/// Every student-facing read and write, over the authenticating pipeline.
///
/// One class rather than five, because the endpoints are few and share the same
/// error handling; splitting them would spread identical plumbing across files
/// without separating anything that actually varies.
/// </summary>
public sealed class StudentApi
{
    private readonly HttpClient _http;

    public StudentApi(HttpClient http) => _http = http;

    // ── Courses and lessons ──────────────────────────────────────────────────

    /// <summary>
    /// Courses the student may open, with units and lessons nested.
    ///
    /// Tries the student endpoint first and falls back only if it comes back
    /// empty for an online student who has a grade.
    ///
    /// The fallback exists because this client is installed on student machines
    /// and cannot assume which server version it is talking to. On a server with
    /// academic/access.py, my-courses/ already returns the grade's courses and
    /// the fallback never runs. On an older one it returns nothing for an online
    /// student who has not paid, because that view reads StudentCourseAccess,
    /// whose rows are created on first payment.
    ///
    /// Ordered this way on purpose: the fallback reads a view that serialises
    /// the raw youtube_url, so it must be the exception, never the default.
    /// </summary>
    public async Task<List<Course>> GetMyCoursesAsync(
        StudentProfile? profile, CancellationToken ct = default)
    {
        var courses = await GetListTolerantAsync<Course>(ApiEndpoints.MyCourses, ct)
            .ConfigureAwait(false);

        if (courses.Count > 0 || !IsOnlineWithGrade(profile, out var gradeId))
            return courses;

        return await GetListTolerantAsync<Course>(ApiEndpoints.CoursesByGrade(gradeId), ct)
            .ConfigureAwait(false);
    }

    /// <summary>
    /// Course detail, with the same fallback: a 403 from the student endpoint
    /// on an older server means the access row is missing, not that the student
    /// is barred from their own grade.
    /// </summary>
    public async Task<Course?> GetCourseAsync(
        int courseId, StudentProfile? profile, CancellationToken ct = default)
    {
        try
        {
            return await GetAsync<Course>(ApiEndpoints.MyCourse(courseId), ct)
                .ConfigureAwait(false);
        }
        catch (ApiRequestException ex) when (ex.IsForbidden && IsOnlineWithGrade(profile, out _))
        {
            return await GetAsync<Course>(ApiEndpoints.CourseDetail(courseId), ct)
                .ConfigureAwait(false);
        }
    }

    /// <summary>
    /// True for an online student who has an enrolled_grade. Without the grade
    /// there is nothing to filter by, so the fallback would return the whole
    /// catalogue rather than their courses.
    /// </summary>
    private static bool IsOnlineWithGrade(StudentProfile? profile, out int gradeId)
    {
        gradeId = profile?.EnrolledGrade ?? 0;

        return profile?.SystemType == SystemTypes.Online && gradeId > 0;
    }

    /// <summary>
    /// A lesson with its exercise. Fetching it also records a view server-side
    /// (LessonProgress is created on GET), so this is not a free read — do not
    /// call it to warm a cache.
    /// </summary>
    public Task<Lesson?> GetLessonAsync(int lessonId, CancellationToken ct = default)
        => GetAsync<Lesson>(ApiEndpoints.MyLesson(lessonId), ct);

    /// <summary>
    /// Marks a lesson complete. Fails with 400 if the lesson was never fetched:
    /// the server requires an existing LessonProgress row, which only
    /// <see cref="GetLessonAsync"/> creates.
    /// </summary>
    public Task<bool> MarkLessonCompleteAsync(int lessonId, CancellationToken ct = default)
        => PostNoContentAsync(ApiEndpoints.CompleteLesson(lessonId), ct);

    public Task<List<LessonProgress>> GetMyProgressAsync(CancellationToken ct = default)
        => GetListAsync<LessonProgress>(ApiEndpoints.MyProgress, ct);

    // ── Exercises ────────────────────────────────────────────────────────────

    /// <summary>Submits exercise answers and returns the graded result.</summary>
    public Task<Submission?> SubmitExerciseAsync(SubmissionRequest request, CancellationToken ct = default)
        => PostAsync<SubmissionRequest, Submission>(ApiEndpoints.SubmitExercise, request, ct);

    public Task<List<Submission>> GetMySubmissionsAsync(int? exerciseId = null, CancellationToken ct = default)
        => GetListAsync<Submission>(
            exerciseId is null
                ? ApiEndpoints.MySubmissions
                : $"{ApiEndpoints.MySubmissions}?exercise={exerciseId}",
            ct);

    // ── Exams ────────────────────────────────────────────────────────────────

    public Task<List<ExamSummary>> GetExamsAsync(CancellationToken ct = default)
        => GetListAsync<ExamSummary>(ApiEndpoints.StudentExams, ct);

    public Task<ExamDetail?> GetExamAsync(int examId, CancellationToken ct = default)
        => GetAsync<ExamDetail>(ApiEndpoints.StudentExam(examId), ct);

    /// <summary>
    /// Submits an exam. Grading is server-side and immediate; the attempt row is
    /// created here, at submit time, which is also when started_at is written.
    /// </summary>
    public Task<ExamSubmitResult?> SubmitExamAsync(
        int examId, ExamSubmission submission, CancellationToken ct = default)
        => PostAsync<ExamSubmission, ExamSubmitResult>(ApiEndpoints.SubmitExam(examId), submission, ct);

    public Task<ExamAttemptDetail?> GetAttemptAsync(int attemptId, CancellationToken ct = default)
        => GetAsync<ExamAttemptDetail>(ApiEndpoints.StudentAttempt(attemptId), ct);

    // ── Live sessions ────────────────────────────────────────────────────────

    public Task<List<LiveRoom>> GetLiveRoomsAsync(CancellationToken ct = default)
        => GetListAsync<LiveRoom>(ApiEndpoints.MyLiveSessions, ct);

    // ── Notifications ────────────────────────────────────────────────────────

    /// <summary>
    /// Unlike every other student endpoint, this one is paginated
    /// (DRF ListAPIView under StandardPagination, page size 10), so the payload
    /// is an envelope rather than a bare array.
    /// </summary>
    public async Task<Paged<Notification>> GetNotificationsAsync(int page = 1, CancellationToken ct = default)
    {
        var path = page <= 1 ? ApiEndpoints.Notifications : $"{ApiEndpoints.Notifications}?page={page}";

        return await GetAsync<Paged<Notification>>(path, ct).ConfigureAwait(false)
               ?? new Paged<Notification>();
    }

    /// <summary>Polled to drive the badge; there is no push channel on desktop.</summary>
    public async Task<int> GetUnreadCountAsync(CancellationToken ct = default)
    {
        var result = await GetAsync<UnreadCount>(ApiEndpoints.NotificationCount, ct).ConfigureAwait(false);
        return result?.Count ?? 0;
    }

    public Task<bool> MarkNotificationReadAsync(int id, CancellationToken ct = default)
        => PostNoContentAsync(ApiEndpoints.NotificationRead(id), ct);

    public Task<bool> MarkAllNotificationsReadAsync(CancellationToken ct = default)
        => PostNoContentAsync(ApiEndpoints.NotificationsReadAll, ct);

    /// <summary>
    /// Whether this server serves the lesson player page.
    ///
    /// The desktop client is installed on student machines and can be newer
    /// than the server it talks to. Without this check, a client built after
    /// academic/player/ existed but pointed at a server without it renders
    /// Django's 404 inside the video frame -- "the requested lesson was not
    /// found on the server" -- which reads as a missing lesson rather than a
    /// missing route.
    ///
    /// Asked once per session and cached: the answer cannot change while the
    /// app is open.
    /// </summary>
    private bool? _playerPageAvailable;

    public async Task<bool> PlayerPageAvailableAsync(CancellationToken ct = default)
    {
        if (_playerPageAvailable is { } known) return known;

        try
        {
            // A syntactically valid id, so a server that has the route answers
            // 200 rather than the 400 it gives for a malformed one.
            using var response = await _http
                .GetAsync(ApiEndpoints.LessonPlayer("dQw4w9WgXcQ"), ct)
                .ConfigureAwait(false);

            _playerPageAvailable = response.IsSuccessStatusCode;
        }
        catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException)
        {
            // Offline: assume it is there rather than permanently falling back.
            return true;
        }

        return _playerPageAvailable.Value;
    }

    // ── Plumbing ─────────────────────────────────────────────────────────────

    private async Task<T?> GetAsync<T>(string path, CancellationToken ct)
    {
        using var response = await _http.GetAsync(path, ct).ConfigureAwait(false);

        if (!response.IsSuccessStatusCode)
            throw await ApiRequestException.FromAsync(response, ct).ConfigureAwait(false);

        return await response.Content
            .ReadFromJsonAsync<T>(ApiClientFactory.Json, ct)
            .ConfigureAwait(false);
    }

    private async Task<List<T>> GetListAsync<T>(string path, CancellationToken ct)
        => await GetAsync<List<T>>(path, ct).ConfigureAwait(false) ?? new List<T>();

    /// <summary>
    /// Reads a list that may arrive either bare or wrapped in a pagination
    /// envelope.
    ///
    /// The student APIView endpoints return bare arrays; the generic DRF
    /// ListAPIView endpoints return {count, next, previous, results} under
    /// StandardPagination. Since the courses call now targets one or the other
    /// depending on enrollment type, it has to accept both — the mobile client
    /// does exactly this, and it is the tolerance that keeps a serializer change
    /// from emptying a screen.
    /// </summary>
    private async Task<List<T>> GetListTolerantAsync<T>(string path, CancellationToken ct)
    {
        using var response = await _http.GetAsync(path, ct).ConfigureAwait(false);

        if (!response.IsSuccessStatusCode)
            throw await ApiRequestException.FromAsync(response, ct).ConfigureAwait(false);

        var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(body)) return new List<T>();

        using var document = JsonDocument.Parse(body);

        var element = document.RootElement.ValueKind == JsonValueKind.Object
                      && document.RootElement.TryGetProperty("results", out var results)
            ? results
            : document.RootElement;

        if (element.ValueKind != JsonValueKind.Array) return new List<T>();

        return element.Deserialize<List<T>>(ApiClientFactory.Json) ?? new List<T>();
    }

    private async Task<TOut?> PostAsync<TIn, TOut>(string path, TIn body, CancellationToken ct)
    {
        // Serialised to a string so the request carries a Content-Length.
        // JsonContent would be sent chunked, which Django's development server
        // cannot parse - it reads the chunk-size line as a request line.
        using var content = new StringContent(
            JsonSerializer.Serialize(body, ApiClientFactory.Json), Encoding.UTF8, "application/json");

        using var response = await _http.PostAsync(path, content, ct).ConfigureAwait(false);

        if (!response.IsSuccessStatusCode)
            throw await ApiRequestException.FromAsync(response, ct).ConfigureAwait(false);

        return await response.Content
            .ReadFromJsonAsync<TOut>(ApiClientFactory.Json, ct)
            .ConfigureAwait(false);
    }

    private async Task<bool> PostNoContentAsync(string path, CancellationToken ct)
    {
        using var content = new StringContent("{}", Encoding.UTF8, "application/json");
        using var response = await _http.PostAsync(path, content, ct).ConfigureAwait(false);

        if (response.IsSuccessStatusCode)
            return true;

        // 400 here is a refusal the caller can act on (a lesson never viewed,
        // for instance), not a fault worth throwing over.
        if (response.StatusCode == HttpStatusCode.BadRequest)
            return false;

        throw await ApiRequestException.FromAsync(response, ct).ConfigureAwait(false);
    }
}

/// <summary>
/// A non-success response, carrying the server's own Arabic message where there
/// was one. Screens show <see cref="Exception.Message"/> directly.
/// </summary>
public sealed class ApiRequestException : Exception
{
    public HttpStatusCode StatusCode { get; }

    /// <summary>True when the student lacks access — 403, the server's own word.</summary>
    public bool IsForbidden => StatusCode == HttpStatusCode.Forbidden;

    public bool IsNotFound => StatusCode == HttpStatusCode.NotFound;

    private ApiRequestException(HttpStatusCode status, string message) : base(message)
        => StatusCode = status;

    /// <summary>
    /// Restates a refusal in terms the student can act on, keeping the status so
    /// callers can still branch on it. Used where the server's own wording is
    /// accurate but leaves the student with nothing to do about it.
    /// </summary>
    public static ApiRequestException Restated(HttpStatusCode status, string message)
        => new(status, message);

    internal static async Task<ApiRequestException> FromAsync(HttpResponseMessage response, CancellationToken ct)
    {
        string? body = null;

        try
        {
            body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        }
        catch (Exception)
        {
            // A body we cannot read is not worth failing the error path over.
        }

        var message = DrfError.ExtractMessage(body) ?? DesktopMessages.ServerFault;
        return new ApiRequestException(response.StatusCode, message);
    }
}
