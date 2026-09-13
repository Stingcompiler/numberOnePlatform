import { arabicDigits, formatDate } from "../ui/text";

/**
 * The shapes the API returns, named as the server names them.
 *
 * Snake case is kept deliberately: renaming at the boundary means a field the
 * server adds or moves shows up as a TypeScript error here rather than as an
 * undefined two screens away.
 */

/**
 * A lesson. Note what is ABSENT: youtube_url.
 *
 * The student serializers expose only youtube_embed_url, so the raw watch URL
 * never reaches this client and there is no field here to hold it. Do not add
 * one — the point is that a single API response cannot be scraped for a
 * course's video links.
 */
export interface Lesson {
  id: number;
  unit?: number | null;
  title: string;
  description?: string | null;
  /** An https://www.youtube.com/embed/... URL. */
  youtube_embed_url?: string | null;
  pdf_file?: string | null;
  display_order: number;
  duration_minutes?: number | null;
  is_active: boolean;
  /** Present on the detail endpoint only, and without is_correct. */
  exercise?: Exercise | null;
}

/**
 * The YouTube id, read out of the embed URL the server built.
 *
 * The server falls back to returning the raw URL when it cannot parse one (it
 * only handles "youtu.be/" and "v="), so a lesson saved with a /live/ or
 * /shorts/ link arrives here as something that is not an embed URL at all.
 * Those forms are handled rather than assumed away.
 *
 * Null when nothing that looks like an id can be found — better no video than
 * a frame pointed at a guess.
 */
export function videoId(embedUrl: string | null | undefined): string | null {
  if (!embedUrl?.trim()) return null;

  for (const marker of ["/embed/", "youtu.be/", "/live/", "/shorts/", "v="]) {
    const at = embedUrl.toLowerCase().indexOf(marker);
    if (at < 0) continue;

    const id = embedUrl.slice(at + marker.length).split(/[?&/]/)[0].trim();
    if (isVideoId(id)) return id;
  }

  return null;
}

function isVideoId(value: string): boolean {
  return value.length >= 6 && value.length <= 20 && /^[A-Za-z0-9_-]+$/.test(value);
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

/**
 * A lesson exercise. The student variant omits is_correct on every choice — the
 * answers are not sent until after submission.
 */
export interface Exercise {
  id: number;
  title: string;
  instructions?: string | null;
  max_attempts?: number | null;
  pass_percentage?: number | null;
  total_marks: number;
  questions: ExerciseQuestion[];
}

export interface ExerciseQuestion {
  id: number;
  text: string;
  marks: number;
  display_order: number;
  image?: string | null;
  choices: ExerciseChoice[];
}

export interface ExerciseChoice {
  id: number;
  text: string;
  display_order: number;
  // is_correct is deliberately not modelled: the student payload omits it.
}

/**
 * Body of POST /academic/submit/.
 *
 * The wire names are exercise_id / question_id / choice_id, which do NOT match
 * the names the read serializers use (exercise, question, selected_choice).
 * Mirroring the read shape here produces "هذا الحقل مطلوب." and a lost attempt.
 */
export interface SubmissionRequest {
  exercise_id: number;
  answers: {
    question_id: number;
    /**
     * Nullable, and the server means it: a null choice records the question as
     * answered-but-blank rather than rejecting the submission.
     */
    choice_id: number | null;
  }[];
}

/**
 * A graded submission. This is where the correct answers finally arrive —
 * after the attempt, never before.
 */
export interface Submission {
  id: number;
  exercise: number;
  exercise_title?: string | null;
  score: number;
  percentage: number;
  is_passed: boolean;
  attempt_number: number;
  submitted_at?: string | null;
  answers: SubmissionAnswerResult[];
}

export interface SubmissionAnswerResult {
  question_text?: string | null;
  selected_text?: string | null;
  is_correct: boolean;
  correct_choice?: string | null;
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
  score: number;
  percentage: number;
  is_passed: boolean;
  submitted_at?: string | null;
}

/**
 * A row of /exams/student/list/. Hand-built by StudentExamListView rather than
 * a serializer, so the field set is that view's dictionary, not Exam's.
 *
 * IMPORTANT: exam access follows a different rule than course access. That view
 * gives an "online" student every active course in their enrolled_grade, while
 * MyCoursesView reads StudentCourseAccess. So `course_id` may name a course
 * that never appears in my-courses — always display `course_name` from here
 * rather than resolving the id against the courses list.
 */
export interface ExamSummary {
  id: number;
  title: string;
  duration_minutes: number;
  passing_score?: number;
  course_id?: number;
  course_name: string;
  total_marks: number;
  question_count: number;
  /** Every past attempt. Empty means the exam is still available. */
  attempts: ExamAttemptSummary[];
}

export function hasBeenAttempted(exam: ExamSummary): boolean {
  return exam.attempts.length > 0;
}

/**
 * Best result so far, which is what the completed tab shows. There is no
 * server-side attempt limit, so a student may have several.
 */
export function bestAttempt(exam: ExamSummary): ExamAttemptSummary | null {
  return [...exam.attempts].sort((a, b) => b.percentage - a.percentage)[0] ?? null;
}

/** "٤٢ / ٥٠" — tabular, Arabic-Indic. */
export function scoreLabel(score: number, outOf: number): string {
  return `${arabicDigits(mark(score))} / ${arabicDigits(mark(outOf))}`;
}

/** A mark with no trailing ".00": marks are whole far more often than not. */
export function mark(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export const QuestionTypes = {
  TrueFalse: "true_false",
  MultipleChoice: "multiple_choice",
  FillBlank: "fill_blank",
  Matching: "matching",
} as const;

export interface ExamOption {
  id: number;
  text: string;
  display_order: number;
}

export interface ExamQuestion {
  id: number;
  /** See QuestionTypes. */
  question_type: string;
  title?: string | null;
  text: string;
  marks: number;
  display_order: number;
  options: ExamOption[];
  image_url?: string | null;
  /** Matching only: the left column, in order. */
  matching_left?: string[] | null;
  /** Matching only: the right column, shuffled server-side. */
  matching_right?: string[] | null;
}

/**
 * An exam ready to sit — StudentExamDetailSerializer. correct_answer is omitted
 * from every question.
 *
 * `duration_minutes` is ADVISORY. There is no server-side attempt:
 * ExamAttempt.started_at is written at submit time alongside submitted_at, so
 * nothing enforces the clock, limits attempts, or survives the app closing. The
 * countdown is the client's own.
 */
export interface ExamDetail {
  id: number;
  course: number;
  course_name: string;
  title: string;
  duration_minutes: number;
  passing_score: number;
  total_marks: number;
  question_count: number;
  questions: ExamQuestion[];
}

/**
 * One answer. The shape of `answer` depends on the question type, and the
 * server grades by reading specific keys out of it
 * (exams/serializers.py StudentExamAttemptCreateSerializer):
 *
 *   true_false      {"value": true}
 *   multiple_choice {"option_id": 12}
 *   fill_blank      {"text": "..."}     compared case-insensitively, trimmed
 *   matching        {"pairs": [{"a": "...", "b": "..."}]}
 *
 * A key the grader does not recognise scores zero SILENTLY, so `examAnswers`
 * builds these rather than callers hand-rolling them.
 */
export interface ExamAnswer {
  question_id: number;
  answer: Record<string, unknown>;
}

export interface ExamSubmission {
  answers: ExamAnswer[];
}

/** Builds the per-type answer payloads the grader actually reads. */
export const examAnswers = {
  trueFalse: (questionId: number, value: boolean): ExamAnswer => ({
    question_id: questionId,
    answer: { value },
  }),

  multipleChoice: (questionId: number, optionId: number): ExamAnswer => ({
    question_id: questionId,
    answer: { option_id: optionId },
  }),

  fillBlank: (questionId: number, text: string): ExamAnswer => ({
    question_id: questionId,
    answer: { text },
  }),

  matching: (questionId: number, pairs: { left: string; right: string }[]): ExamAnswer => ({
    question_id: questionId,
    answer: { pairs: pairs.map((p) => ({ a: p.left, b: p.right })) },
  }),

  /**
   * An unanswered question. The server treats a missing question as an empty
   * answer and scores it zero, so sending this is equivalent — but explicit,
   * which keeps the submitted count matching what the student saw.
   */
  blank: (questionId: number): ExamAnswer => ({ question_id: questionId, answer: {} }),
};

/** Response of a submit, and of /exams/student/attempts/<id>/. */
export interface ExamSubmitResult {
  detail?: string | null;
  attempt?: ExamAttemptDetail | null;
}

/**
 * A finished attempt with its answer sheet. correct_answer is included here —
 * after the fact, which is the only time it is safe.
 */
export interface ExamAttemptDetail {
  id: number;
  score: number;
  percentage: number;
  is_passed: boolean;
  started_at?: string | null;
  submitted_at?: string | null;
  exam_title?: string | null;
  total_marks: number;
  answers: ExamAttemptAnswer[];
}

export interface ExamAttemptAnswer {
  id: number;
  question_title?: string | null;
  question_text?: string | null;
  question_type?: string | null;
  question_marks: number;
  correct_answer?: Record<string, unknown> | null;
  student_answer?: Record<string, unknown> | null;
  is_correct: boolean;
  earned_marks: number;
  options: ExamOption[];
}

/**
 * Renders a stored answer as something a student can read.
 *
 * The payload shape differs per question type and the server stores it in a
 * JSONField, so this reads defensively and falls back to a dash rather than
 * showing raw JSON on a results screen.
 */
export function describeAnswer(
  questionType: string | null | undefined,
  payload: Record<string, unknown> | null | undefined,
  options: ExamOption[],
): string {
  if (!payload || Object.keys(payload).length === 0) return "—";

  switch (questionType) {
    case QuestionTypes.TrueFalse: {
      const value = payload.value;
      if (typeof value !== "boolean") return "—";
      return value ? "صواب" : "خطأ";
    }

    case QuestionTypes.MultipleChoice: {
      const id = typeof payload.option_id === "number" ? payload.option_id : null;
      return options.find((o) => o.id === id)?.text ?? "—";
    }

    case QuestionTypes.FillBlank: {
      const text = payload.text;
      return typeof text === "string" && text.trim() ? text : "—";
    }

    case QuestionTypes.Matching:
      // Rendering every pair would overflow the row; the verdict already says
      // whether the whole set matched.
      return "مطابقة";

    default:
      return "—";
  }
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
  /**
   * There is no schedule. The server dropped scheduled_start/scheduled_end;
   * status (upcoming / live / ended) is the whole timeline a student sees.
   */
  /** Raw value; see LiveStatuses. */
  status?: string | null;
  status_display?: string | null;
}

export interface LiveRoom {
  id: number;
  room_name: string;
  room_type?: string | null;
  /** The grade the room is scoped to; null is a system-wide room. */
  grade_name?: string | null;
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
