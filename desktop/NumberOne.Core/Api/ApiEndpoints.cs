namespace NumberOne.Core.Api;

/// <summary>
/// Every path the student client is allowed to call, relative to the API base.
/// Verified against config/urls.py and each app's urls.py.
/// </summary>
public static class ApiEndpoints
{
    public const string DefaultBaseUrl = "https://numberoneschools.com/api/";

    // ── Auth (accounts/urls.py, mounted at /api/) ────────────────────────────
    public const string Login   = "auth/login/";
    public const string Refresh = "auth/refresh/";
    public const string Logout  = "auth/logout/";
    public const string Me      = "auth/me/";

    // auth/change-password/ exists but students are refused there by policy
    // (IsStudentReadOnly). It is deliberately absent from this list.

    /// <summary>
    /// Landing-page data, AllowAny. The only endpoint the client calls without
    /// a session — the blocked screens and the login error need the school's
    /// phone number precisely when no session exists.
    /// </summary>
    public const string PublicSiteData = "public/site-data/";

    // ── Academic (mounted at /api/academic/) ─────────────────────────────────
    public const string MyCourses    = "academic/my-courses/";
    public const string MySubmissions = "academic/my-submissions/";
    public const string MyProgress   = "academic/my-progress/";
    public const string SubmitExercise = "academic/submit/";

    public static string MyCourse(int courseId)      => $"academic/my-courses/{courseId}/";

    /// <summary>
    /// The general course list, readable by any authenticated user. Used ONLY
    /// as a fallback against a server that predates the shared access rule in
    /// academic/access.py, where my-courses/ returns nothing for an online
    /// student who has not paid. See StudentApi.GetMyCoursesAsync.
    /// </summary>
    public static string CoursesByGrade(int gradeId) =>
        $"academic/courses/?grade={gradeId}&system_type=online";

    /// <summary>
    /// Course detail on the same fallback path.
    ///
    /// This view serialises with CourseSerializer, which carries the raw
    /// youtube_url. That is why it is a fallback and not the default: against a
    /// current server it is never called. The student DTOs do not model the
    /// field, so this client cannot read it either way.
    /// </summary>
    public static string CourseDetail(int courseId) => $"academic/courses/{courseId}/";

    public static string MyLesson(int lessonId)      => $"academic/my-lessons/{lessonId}/";

    /// <summary>
    /// The player page, served from the school's own domain.
    ///
    /// The WebView must NOT navigate to a YouTube /embed/ URL directly: that URL
    /// is meant to be loaded inside an iframe on a page, and a top-level
    /// navigation to it makes YouTube answer "Error 153 - video player
    /// configuration error". Reproduced in a plain browser with a known-good
    /// public video, so it is not specific to WebView2 or to any one lesson.
    ///
    /// Serving the wrapper from the API host gives the iframe a real origin and
    /// referer, which is what the web dashboard and the mobile app already do -
    /// mobile passes baseUrl 'https://numberoneschools.com' for exactly this.
    /// </summary>
    public static string LessonPlayer(string videoId) => $"academic/player/?v={videoId}";
    public static string CompleteLesson(int lessonId) => $"academic/my-lessons/{lessonId}/complete/";

    // ── Exams (mounted at /api/exams/) ───────────────────────────────────────
    public const string StudentExams = "exams/student/list/";

    public static string StudentExam(int examId)       => $"exams/student/{examId}/";
    public static string SubmitExam(int examId)        => $"exams/student/{examId}/submit/";
    public static string StudentAttempt(int attemptId) => $"exams/student/attempts/{attemptId}/";

    // ── Live (mounted at /api/live/) ─────────────────────────────────────────
    public const string MyLiveSessions = "live/my-sessions/";

    // ── Notifications (mounted at /api/notifications/) ───────────────────────
    // NOTE: the list endpoint is a DRF ListAPIView under StandardPagination,
    // so it returns {count, next, previous, results} — unlike the student
    // APIView endpoints above, which return bare arrays.
    public const string Notifications      = "notifications/";
    public const string NotificationCount  = "notifications/count/";
    public const string NotificationsReadAll = "notifications/read-all/";

    public static string NotificationRead(int id) => $"notifications/{id}/read/";

    // notifications/register-token/ stores Expo push tokens. There is no desktop
    // equivalent, so the client polls NotificationCount instead and never calls it.

    /// <summary>
    /// True for the two endpoints that must never trigger a token refresh:
    /// a 401 from either of them means the credentials or the refresh token
    /// are gone, and retrying would loop.
    /// </summary>
    public static bool IsAuthExempt(Uri? uri) =>
        uri is not null &&
        (uri.AbsolutePath.Contains("/auth/login", StringComparison.Ordinal) ||
         uri.AbsolutePath.Contains("/auth/refresh", StringComparison.Ordinal));
}
