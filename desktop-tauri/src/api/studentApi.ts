import { request } from "./client";
import { Endpoints } from "./endpoints";
import {
  Course,
  ExamAttemptDetail,
  ExamDetail,
  ExamSubmission,
  ExamSubmitResult,
  ExamSummary,
  LessonProgress,
  LiveRoom,
  Lesson,
  Notification,
  Paged,
  Submission,
  SubmissionRequest,
} from "./models";

/**
 * The student endpoints, unchanged from MAUI.
 *
 * A list endpoint may answer with a bare array or with a paginated object
 * depending on the view, so lists go through `asList` rather than being cast.
 * The tolerant read is not politeness — a screen that throws because the server
 * paginated one endpoint is a screen a student cannot use.
 */

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  if (payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown }).results)) {
    return (payload as { results: T[] }).results;
  }

  return [];
}

export const studentApi = {
  async courses(signal?: AbortSignal): Promise<Course[]> {
    return asList<Course>(await request(Endpoints.myCourses, { signal }));
  },

  async course(id: number, signal?: AbortSignal): Promise<Course | null> {
    const all = await this.courses(signal);
    return all.find((c) => c.id === id) ?? null;
  },

  async progress(signal?: AbortSignal): Promise<LessonProgress[]> {
    return asList<LessonProgress>(await request(Endpoints.myProgress, { signal }));
  },

  async exams(signal?: AbortSignal): Promise<ExamSummary[]> {
    return asList<ExamSummary>(await request(Endpoints.exams, { signal }));
  },

  /**
   * One lesson, with its exercise.
   *
   * NOT A FREE READ: this GET is what creates the LessonProgress row on the
   * server, and that row is what makes marking the lesson complete possible at
   * all. Skipping it and marking complete directly fails with a 400.
   */
  async lesson(id: number, signal?: AbortSignal): Promise<Lesson> {
    return request<Lesson>(Endpoints.myLesson(id), { signal });
  },

  /** Marks a lesson complete. Requires that `lesson()` has been called first. */
  async markLessonComplete(id: number, signal?: AbortSignal): Promise<boolean> {
    try {
      await request(Endpoints.completeLesson(id), { method: "POST", body: {}, signal });
      return true;
    } catch {
      return false;
    }
  },

  /** Submits exercise answers and returns the graded result. */
  async submitExercise(
    body: SubmissionRequest,
    signal?: AbortSignal,
  ): Promise<Submission> {
    return request<Submission>(Endpoints.submit, { body, signal });
  },

  /** One exam, ready to sit. correct_answer is omitted from every question. */
  async exam(id: number, signal?: AbortSignal): Promise<ExamDetail> {
    return request<ExamDetail>(Endpoints.exam(id), { signal });
  },

  /**
   * Sits the paper. Every submit creates a new attempt — there is no
   * server-side attempt to resume and no limit on how many a student may make.
   */
  async submitExam(
    id: number,
    submission: ExamSubmission,
    signal?: AbortSignal,
  ): Promise<ExamSubmitResult> {
    return request<ExamSubmitResult>(Endpoints.submitExam(id), { body: submission, signal });
  },

  /** A finished attempt with its answer sheet — correct answers included. */
  async attempt(id: number, signal?: AbortSignal): Promise<ExamAttemptDetail> {
    return request<ExamAttemptDetail>(Endpoints.attempt(id), { signal });
  },

  async liveRooms(signal?: AbortSignal): Promise<LiveRoom[]> {
    return asList<LiveRoom>(await request(Endpoints.liveSessions, { signal }));
  },

  /**
   * One page of the feed. Paginated on the server, so this returns the page
   * rather than flattening it — the dashboard shows the first five and the
   * notifications screen pages through the rest.
   */
  async notifications(page = 1, signal?: AbortSignal): Promise<Paged<Notification>> {
    const path = page <= 1 ? Endpoints.notifications : `${Endpoints.notifications}?page=${page}`;
    const payload = await request<Paged<Notification> | Notification[]>(path, { signal });

    if (Array.isArray(payload)) {
      return { count: payload.length, next: null, previous: null, results: payload };
    }

    return {
      count: payload?.count ?? 0,
      next: payload?.next ?? null,
      previous: payload?.previous ?? null,
      results: asList<Notification>(payload),
    };
  },

  /**
   * Marks one notification read. Returns whether it took.
   *
   * Never throws: reading a notification is not worth an error panel, and the
   * row it was raised from has nowhere to put one.
   */
  async markNotificationRead(id: number, signal?: AbortSignal): Promise<boolean> {
    try {
      await request(Endpoints.notificationRead(id), { method: "POST", body: {}, signal });
      return true;
    } catch {
      return false;
    }
  },

  async markAllNotificationsRead(signal?: AbortSignal): Promise<boolean> {
    try {
      await request(Endpoints.notificationsReadAll, { method: "POST", body: {}, signal });
      return true;
    } catch {
      return false;
    }
  },

  async unreadCount(signal?: AbortSignal): Promise<number> {
    const payload = await request<{ count?: number } | number>(Endpoints.notificationCount, { signal });
    if (typeof payload === "number") return payload;
    return payload?.count ?? 0;
  },
};

/** The set of lesson ids this student has finished. */
export function completedLessonIds(progress: LessonProgress[]): Set<number> {
  return new Set(progress.filter((p) => p.is_completed).map((p) => p.lesson));
}
