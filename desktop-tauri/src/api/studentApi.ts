import { request } from "./client";
import { Endpoints } from "./endpoints";
import { Course, LessonProgress } from "./models";

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
