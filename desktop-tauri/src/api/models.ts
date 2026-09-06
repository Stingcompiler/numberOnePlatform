import { arabicDigits, formatDate } from "../ui/text";

/**
 * The shapes the API returns, named as the server names them.
 *
 * Snake case is kept deliberately: renaming at the boundary means a field the
 * server adds or moves shows up as a TypeScript error here rather than as an
 * undefined two screens away.
 */

export interface Lesson {
  id: number;
  unit?: number | null;
  title: string;
  description?: string | null;
  youtube_embed_url?: string | null;
  pdf_file?: string | null;
  display_order: number;
  duration_minutes?: number | null;
  is_active: boolean;
}

export interface Unit {
  id: number;
  course: number;
  name: string;
  display_order: number;
  is_active: boolean;
  lessons: Lesson[];
}

export interface Course {
  id: number;
  name: string;
  description?: string | null;
  grade?: number | null;
  grade_name?: string | null;
  teacher?: number | null;
  teacher_name?: string | null;
  thumbnail?: string | null;
  display_order: number;
  is_active: boolean;
  system_type?: string | null;
  units: Unit[];
  lesson_count?: number | null;
}

export interface LessonProgress {
  lesson: number;
  is_completed: boolean;
  completed_at?: string | null;
  /** When the lesson was last opened. Drives "نشطة هذا الأسبوع". */
  last_viewed?: string | null;
}

/** How many lessons a course holds, counting its units when the server is quiet. */
export function lessonCount(course: Course): number {
  if (typeof course.lesson_count === "number") return course.lesson_count;
  return course.units.reduce((total, unit) => total + unit.lessons.length, 0);
}

export function unitCount(course: Course): number {
  return course.units.length;
}

export interface ExamAttemptSummary {
  id: number;
  percentage: number;
  submitted_at?: string | null;
}

export interface ExamSummary {
  id: number;
  title: string;
  course_name: string;
  duration_minutes: number;
  question_count: number;
  attempts: ExamAttemptSummary[];
}

export interface LiveSession {
  id: number;
  session_name: string;
  description?: string | null;
  /** Raw value; see LiveProviders. */
  provider?: string | null;
  provider_display?: string | null;
  /** Opened in the system browser, outside the app. There is no player. */
  stream_url?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  /** Raw value; see LiveStatuses. */
  status?: string | null;
  status_display?: string | null;
}

export interface LiveRoom {
  id: number;
  room_name: string;
  room_type?: string | null;
  description?: string | null;
  sessions: LiveSession[];
}

/**
 * One lecture, lifted out of the course tree with its course beside it.
 *
 * The courses screen answers "how far am I through each subject". The lectures
 * screen answers a different question — "what have I not watched yet" — which a
 * student with six courses cannot read off six separate trees.
 */
export interface LectureRow {
  lessonId: number;
  courseId: number;
  courseName: string;
  unitName: string;
  title: string;
  durationMinutes: number | null;
  isCompleted: boolean;
}

/** Flattens every course's units into one list, in the order they are served. */
export function flattenLectures(courses: Course[], completed: Set<number>): LectureRow[] {
  const rows: LectureRow[] = [];

  for (const course of courses) {
    for (const unit of course.units) {
      for (const lesson of unit.lessons) {
        rows.push({
          lessonId: lesson.id,
          courseId: course.id,
          courseName: course.name,
          unitName: unit.name,
          title: lesson.title,
          durationMinutes: lesson.duration_minutes ?? null,
          isCompleted: completed.has(lesson.id),
        });
      }
    }
  }

  return rows;
}

export const LiveStatuses = {
  Upcoming: "upcoming",
  Live: "live",
  Ended: "ended",
  Archived: "archived",
} as const;

export function liveStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case LiveStatuses.Upcoming:
      return "قادمة";
    case LiveStatuses.Live:
      return "مباشر الآن";
    case LiveStatuses.Ended:
      return "انتهت";
    case LiveStatuses.Archived:
      return "مؤرشفة";
    default:
      return "";
  }
}

/**
 * Zoom / Google Meet / Teams / YouTube, in Latin.
 *
 * Mapped from the raw provider rather than taken from provider_display, which
 * the server localises: "Microsoft Teams" for teams, "YouTube Live" for
 * youtube. The design names the product, not the plan. A provider added after
 * this client shipped falls back to whatever the server sent, and only then to
 * "أخرى" — a new provider should read as itself, not as unknown.
 */
export function providerLabel(session: LiveSession): string {
  switch (session.provider) {
    case "zoom":
      return "Zoom";
    case "google_meet":
      return "Google Meet";
    case "teams":
      return "Teams";
    case "youtube":
      return "YouTube";
    case "other":
      return "أخرى";
    default:
      return session.provider_display?.trim() || "أخرى";
  }
}

/** Ended and archived sessions render their action disabled. */
export function canJoin(session: LiveSession): boolean {
  return (
    !!session.stream_url?.trim() &&
    session.status !== LiveStatuses.Ended &&
    session.status !== LiveStatuses.Archived
  );
}

/** "16:00 — 17:30", or just the start where no end was set. */
export function sessionTimeLabel(session: LiveSession): string {
  const start = parseDate(session.scheduled_start);
  if (!start) return "";

  // The date is dropped for today: inside a line the student is reading now,
  // repeating today's date says nothing.
  const day = isToday(start) ? "" : formatDate(session.scheduled_start) + " ";
  const end = parseDate(session.scheduled_end);

  return end ? `${day}${clock(start)} — ${clock(end)}` : day + clock(start);
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  notification_type?: string | null;
  /** A string on the server (CharField), not an int. */
  related_object_id?: string | null;
  is_read: boolean;
  created_at: string;
}

/**
 * The trailing timestamp on a notification row. Today's show a clock time and
 * older ones a date: inside a list already ordered by day, repeating the date
 * on every row says nothing.
 */
export function notificationTimeLabel(notification: Notification): string {
  const at = parseDate(notification.created_at);
  if (!at) return "";
  return isToday(at) ? arabicDigits(clock(at)) : formatDate(notification.created_at);
}

/** One page of a paginated list endpoint. */
export interface Paged<T> {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

export function systemTypeLabel(systemType: string | null | undefined): string {
  switch (systemType) {
    case "online":
      return "عبر الإنترنت";
    case "flash":
      return "بدون إنترنت (فلاش)";
    default:
      return "—";
  }
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isToday(date: Date): boolean {
  return date.toDateString() === new Date().toDateString();
}

function clock(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
