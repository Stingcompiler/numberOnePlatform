/**
 * The same endpoints the MAUI client calls, unchanged. PORT-AUDIT section 1.
 */
export const API_BASE = "https://numberoneschools.com/api/";

export const Endpoints = {
  login: "auth/login/",
  logout: "auth/logout/",
  me: "auth/me/",
  refresh: "auth/refresh/",

  myCourses: "academic/my-courses/",
  myProgress: "academic/my-progress/",
  mySubmissions: "academic/my-submissions/",
  submit: "academic/submit/",

  myLesson: (id: number) => `academic/my-lessons/${id}/`,
  completeLesson: (id: number) => `academic/my-lessons/${id}/complete/`,

  /**
   * The wrapper page the school's server serves, RELATIVE TO THE API BASE —
   * /api/academic/player/, not the site root.
   *
   * MAUI needs it because its WebView navigated TOP-LEVEL to the video: a
   * /embed/ URL loaded that way makes YouTube answer "Error 153", since the URL
   * is meant to sit inside an iframe on a page. This client frames the embed
   * from its own page instead, which is the ordinary supported case — so the
   * page is kept as the fallback, not the default. See BLOCKERS.
   */
  lessonPlayer: (videoId: string) => `academic/player/?v=${encodeURIComponent(videoId)}`,

  exams: "exams/student/list/",
  exam: (id: number) => `exams/student/${id}/`,
  submitExam: (id: number) => `exams/student/${id}/submit/`,
  attempt: (id: number) => `exams/student/attempts/${id}/`,

  liveSessions: "live/my-sessions/",

  notifications: "notifications/",
  notificationCount: "notifications/count/",
  notificationsReadAll: "notifications/read-all/",
  notificationRead: (id: number) => `notifications/${id}/read/`,

  siteData: "public/site-data/",
} as const;

/**
 * Requests that never carry a bearer and are never replayed.
 *
 * Attaching a token to the refresh call would make an expired session
 * unrefreshable, and retrying a login on 401 would spend the attempt twice.
 */
export function isAuthExempt(url: string): boolean {
  return url.includes("/auth/login") || url.includes("/auth/refresh");
}
