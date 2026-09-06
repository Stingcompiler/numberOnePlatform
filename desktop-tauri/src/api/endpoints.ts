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

  exams: "exams/student/list/",
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
