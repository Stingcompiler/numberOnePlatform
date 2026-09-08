import { useEffect, useMemo, useState } from "react";

import { ApiError } from "../api/client";
import {
  Course,
  Exercise,
  ExerciseChoice,
  ExerciseQuestion,
  Lesson,
  Submission,
  videoId,
} from "../api/models";
import { completedLessonIds, studentApi } from "../api/studentApi";
import { auth, watermarkName } from "../auth/authService";
import { LessonPlayer, VideoHeight, VideoWidth } from "../player/LessonPlayer";
import { openExternal } from "../platform/external";
import { Icon } from "../ui/Icon";
import { Panel, Skeleton, StatePanel } from "../ui/primitives";
import { useToast } from "../ui/Toast";
import { arabicDigits, count, percentLabel } from "../ui/text";
import { useSection } from "../ui/useSection";

/**
 * The lecture: video, watermark, completion, exercise, and the unit rail.
 *
 * WHY THE VIDEO IS FRAMED RATHER THAN NAVIGATED TO. MAUI points its WebView at
 * the school's own /api/academic/player/ page, because a TOP-LEVEL navigation
 * to a YouTube /embed/ URL makes YouTube answer "Error 153 — video player
 * configuration error": that URL is meant to sit inside an iframe on a page.
 * This client is a page already, so it frames the embed directly, which is the
 * ordinary supported case and the reason that wrapper page existed does not
 * apply here. The wrapper is kept in Endpoints as the fallback — see BLOCKERS.
 */

interface Props {
  lessonId: number;
  courseId: number;
  /** Another lecture picked out of the rail. */
  onOpenLesson: (lessonId: number, courseId: number) => void;
  /**
   * Fullscreen hides the shell's own chrome. The lecture cannot reach the
   * sidebar or the top bar itself — they belong to the frame hosting it.
   */
  onFullscreen: (on: boolean) => void;
}

interface PlaylistRow {
  id: number;
  index: number;
  title: string;
  durationMinutes: number | null;
  isCompleted: boolean;
  isCurrent: boolean;
}

interface Playlist {
  courseName: string;
  unitName: string;
  rows: PlaylistRow[];
}

/**
 * Shown when the server refuses the lecture.
 *
 * Names the cause, because "you are not authorised" on a course the app just
 * listed reads as a broken app rather than an unactivated subscription. The
 * courses list is keyed on enrolled_grade while the lesson requires a
 * StudentCourseAccess row that an online student only receives on first payment
 * — so the two genuinely disagree, and the student can do something about it.
 */
const LessonLocked =
  "لم يُفعَّل اشتراكك في هذا الكورس بعد، لذلك لا يمكن فتح المحاضرة. يرجى التواصل مع إدارة المدرسة لتفعيل الاشتراك.";

export function LessonScreen({ lessonId, courseId, onOpenLesson, onFullscreen }: Props) {
  const toast = useToast();
  const [fullscreen, setFullscreen] = useState(false);
  const [completed, setCompleted] = useState(false);

  // The video first, the rail after: the student came here to watch, and the
  // playlist arriving a moment later costs them nothing.
  const lesson = useSection<Lesson>(
    async (signal) => {
      try {
        return await studentApi.lesson(lessonId, signal);
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 403) {
          // Restated with the reason and the remedy: the server's own
          // wording is accurate but leaves the student with nothing to do.
          throw new ApiError(LessonLocked, 403, cause.body);
        }
        throw cause;
      }
    },
    (value) => !value.title?.trim(),
    [lessonId],
  );

  // Its own section: the rail is a convenience, and a course fetch that fails
  // must not take the video down with it.
  const playlist = useSection<Playlist>(
    async (signal) => {
      const [course, progress] = await Promise.all([
        studentApi.course(courseId, signal),
        studentApi.progress(signal),
      ]);
      return build(course, progress ? completedLessonIds(progress) : new Set(), lessonId);
    },
    (value) => value.rows.length === 0,
    [lessonId, courseId],
  );

  useEffect(() => {
    let live = true;
    studentApi
      .progress()
      .then((rows) => live && setCompleted(rows.some((p) => p.lesson === lessonId && p.is_completed)))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [lessonId]);

  function toggleFullscreen(on: boolean) {
    setFullscreen(on);
    onFullscreen(on);
  }

  // Leaving the lecture must never leave the shell without its chrome.
  useEffect(() => () => onFullscreen(false), [onFullscreen]);

  const user = auth.currentUser;
  const video = videoId(lesson.data?.youtube_embed_url);

  const meta = useMemo(() => {
    const parts: string[] = [];
    if (playlist.data?.courseName) parts.push(playlist.data.courseName);
    if (playlist.data?.unitName) parts.push(playlist.data.unitName);

    const minutes = lesson.data?.duration_minutes ?? 0;
    if (minutes > 0) parts.push(count(minutes, "دقيقة", "دقيقتان", "دقائق"));

    return parts.join(" · ");
  }, [playlist.data, lesson.data]);

  async function markComplete() {
    if (completed) return;

    if (await studentApi.markLessonComplete(lessonId)) {
      setCompleted(true);
      playlist.reload();
    } else {
      toast("تعذّر تسجيل المحاضرة كمكتملة", "error");
    }
  }

  async function openAttachment() {
    // Outside the app, deliberately. A second frame showing the same material
    // would not carry the window's capture protection, and would quietly become
    // the way around it.
    const failure = await openExternal(lesson.data?.pdf_file);
    if (failure) toast("الملف المرفق غير متاح — راجع الإدارة", "error");
  }

  if (lesson.status === "loading") {
    return (
      <Panel>
        <Skeleton rows={3} />
      </Panel>
    );
  }

  if (lesson.status === "error") {
    return (
      <Panel>
        <StatePanel message={lesson.error ?? ""} onAction={lesson.reload} />
      </Panel>
    );
  }

  return (
    <div className="flex gap-6">
      <div className={`flex min-w-0 flex-1 flex-col gap-4 ${fullscreen ? "justify-center" : ""}`}>
        <div className="flex flex-col items-center gap-2">
          {video ? (
            <LessonPlayer
              videoId={video}
              watermarkName={watermarkName(user)}
              watermarkPhone={String(user?.phone ?? "")}
              fullscreen={fullscreen}
              onFullscreen={toggleFullscreen}
            />
          ) : (
            <NoVideo />
          )}

          <SecurityNotice />
        </div>

        {/* What fullscreen actually removes is everything AROUND the picture. */}
        {!fullscreen && (
          <>
            <header className="flex flex-wrap items-start gap-3">
              <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <h1 className="font-ui text-title font-bold text-ink">{lesson.data?.title}</h1>
                {meta && <span className="text-secondary text-ink-muted">{meta}</span>}
              </span>

              {lesson.data?.pdf_file && (
                <button
                  type="button"
                  onClick={() => void openAttachment()}
                  className="flex items-center gap-2 rounded-control border border-border px-3 py-[6px] text-body text-ink hover:bg-hover"
                >
                  <Icon name="Download" size={14} />
                  الملف المرفق
                </button>
              )}

              <button
                type="button"
                disabled={completed}
                onClick={() => void markComplete()}
                className={[
                  "flex items-center gap-2 rounded-control px-4 py-[6px] text-body font-bold",
                  completed
                    ? "border border-border text-success"
                    : "bg-primary text-white hover:bg-primary-hover",
                ].join(" ")}
              >
                {completed && <Icon name="Check" size={14} strokeWidth={2} />}
                {completed ? "مكتملة" : "تعليم كمكتملة"}
              </button>
            </header>

            {lesson.data?.description && (
              <p className="font-copy text-body leading-relaxed text-ink-secondary">
                {lesson.data.description}
              </p>
            )}

            {lesson.data?.exercise && lesson.data.exercise.questions.length > 0 && (
              <ExerciseCard exercise={lesson.data.exercise} onToast={toast} />
            )}
          </>
        )}
      </div>

      {!fullscreen && (
        <aside className="hidden w-[200px] shrink-0 flex-col gap-3 xl:flex">
          <Rail section={playlist} onOpen={(id) => onOpenLesson(id, courseId)} />
        </aside>
      )}
    </div>
  );
}

/**
 * The notice under the picture.
 *
 * It must not claim protection the platform does not provide — on macOS, and on
 * Windows builds older than 2004, capture blocking is simply absent, and saying
 * otherwise would be a lie to the student. The verified flag comes from the OS
 * itself, read back after asking; see protection.rs.
 */
function SecurityNotice() {
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke<{ verified: boolean }>("protection_status"))
      .then((status) => live && setVerified(status.verified))
      .catch(() => live && setVerified(false));
    return () => {
      live = false;
    };
  }, []);

  const text =
    verified === null
      ? ""
      : verified
        ? "التسجيل والتقاط الشاشة معطّلان لحماية المحتوى"
        : "هذا المحتوى محمي بحقوق النشر — التسجيل أو إعادة النشر مخالفة.";

  return (
    <p className="flex items-center gap-2 text-label text-ink-muted">
      {text && <Icon name="Shield" size={13} />}
      {text}
      {text && ` · ${VideoWidth} × ${VideoHeight}`}
    </p>
  );
}

function NoVideo() {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-panel border border-dashed border-border"
      style={{ width: VideoWidth, height: VideoHeight, maxWidth: "100%" }}
    >
      <p className="text-body text-ink-muted">لا يوجد فيديو في هذه المحاضرة.</p>
    </div>
  );
}

/* ── the unit rail ──────────────────────────────────────────────────────── */

function build(
  course: Course | null,
  completed: Set<number>,
  lessonId: number,
): Playlist {
  const empty: Playlist = { courseName: "", unitName: "", rows: [] };
  if (!course) return empty;

  const unit = course.units.find((u) => u.lessons.some((l) => l.id === lessonId));
  if (!unit) return empty;

  return {
    courseName: course.name,
    unitName: unit.name,
    rows: [...unit.lessons]
      .sort((a, b) => a.display_order - b.display_order)
      .map((l, index) => ({
        id: l.id,
        index: index + 1,
        title: l.title,
        durationMinutes: l.duration_minutes ?? null,
        isCompleted: completed.has(l.id),
        isCurrent: l.id === lessonId,
      })),
  };
}

function Rail({
  section,
  onOpen,
}: {
  section: ReturnType<typeof useSection<Playlist>>;
  onOpen: (lessonId: number) => void;
}) {
  const data = section.data;
  const done = data?.rows.filter((r) => r.isCompleted).length ?? 0;
  const total = data?.rows.length ?? 0;

  return (
    <Panel className="flex flex-col">
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <span className="font-ui text-body font-bold text-ink">محتويات الوحدة</span>

        {total > 0 && (
          <>
            <span className="text-label text-ink-muted">
              {arabicDigits(done)} من {arabicDigits(total)} · {percentLabel((done * 100) / total)}
            </span>
            <span className="block h-1 w-full overflow-hidden rounded-full bg-hover">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${(done * 100) / total}%` }}
              />
            </span>
          </>
        )}
      </div>

      {section.status === "loading" && <Skeleton rows={3} />}

      {/* A rail that fails is a missing convenience, never a reason for the
          lecture to go down — so it says so quietly and offers a retry. */}
      {section.status === "error" && (
        <p className="flex flex-col items-start gap-2 p-3 text-label text-ink-muted">
          تعذّر تحميل محتويات الوحدة.
          <button type="button" onClick={section.reload} className="text-accent hover:underline">
            إعادة المحاولة
          </button>
        </p>
      )}

      {section.status === "empty" && (
        <p className="p-3 text-label text-ink-muted">لا توجد محاضرات أخرى في هذه الوحدة.</p>
      )}

      {section.status === "data" && (
        <ul className="max-h-[420px] overflow-y-auto">
          {data?.rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                disabled={row.isCurrent}
                onClick={() => onOpen(row.id)}
                className={[
                  "flex w-full items-start gap-2 border-b border-border/60 p-3 text-start last:border-b-0",
                  row.isCurrent
                    ? "border-e-2 border-e-accent bg-accent-tint"
                    : "hover:bg-hover",
                ].join(" ")}
              >
                <span className="w-4 shrink-0 text-label text-ink-muted">
                  {arabicDigits(row.index)}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                  <span className={`text-secondary ${row.isCurrent ? "font-bold text-ink" : "text-ink"}`}>
                    {row.title}
                  </span>
                  {(row.durationMinutes ?? 0) > 0 && (
                    <span className="text-label text-ink-muted">
                      {count(row.durationMinutes!, "دقيقة", "دقيقتان", "دقائق")}
                    </span>
                  )}
                </span>

                {row.isCompleted && (
                  <Icon name="Check" size={13} strokeWidth={2} className="mt-[2px] text-success" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ── the exercise ───────────────────────────────────────────────────────── */

type Outcome = "unanswered" | "correct" | "wrong";

function ExerciseCard({
  exercise,
  onToast,
}: {
  exercise: Exercise;
  onToast: (text: string, kind?: "info" | "warning" | "error") => void;
}) {
  const [answers, setAnswers] = useState<Map<number, number>>(new Map());
  const [result, setResult] = useState<Submission | null>(null);
  const [busy, setBusy] = useState(false);

  const questions = useMemo(
    () => [...exercise.questions].sort((a, b) => a.display_order - b.display_order),
    [exercise],
  );

  const answeredAll = questions.every((q) => answers.has(q.id));

  /**
   * After grading: whether a choice was the student's, and whether it was
   * right. The correct row turns success and a wrong pick turns danger.
   *
   * Matched on TEXT because that is all the graded payload carries — it names
   * the question and the correct choice by their words, not their ids.
   */
  function outcome(question: ExerciseQuestion, choice: ExerciseChoice): Outcome {
    if (!result) return "unanswered";

    const answer = result.answers.find((a) => a.question_text === question.text);
    if (!answer) return "unanswered";

    if (choice.text === answer.correct_choice) return "correct";
    return answers.get(question.id) === choice.id ? "wrong" : "unanswered";
  }

  async function submit() {
    if (result) {
      // "إعادة المحاولة" clears the grading and lets the student answer again.
      // The server keeps every attempt; attempt_number increments on its side.
      setResult(null);
      setAnswers(new Map());
      return;
    }

    setBusy(true);
    try {
      const graded = await studentApi.submitExercise({
        exercise_id: exercise.id,
        answers: questions.map((q) => ({
          question_id: q.id,
          choice_id: answers.get(q.id) ?? null,
        })),
      });
      setResult(graded);
    } catch (cause) {
      // The answers stay in state on failure, so "تسليم" resends the same paper
      // rather than clearing it.
      onToast(cause instanceof Error ? cause.message : "تعذّر تسليم الإجابات", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="shrink-0 font-ui text-heading font-bold text-ink">
          {exercise.title || "تمرين المحاضرة"}
        </h2>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span className="shrink-0 text-label text-ink-muted">
          {count(questions.length, "سؤال", "سؤالان", "أسئلة", "واحد")}
        </span>
      </div>

      <Panel className="flex flex-col gap-4 p-card">
        {exercise.instructions && (
          <p className="font-copy text-body text-ink-secondary">{exercise.instructions}</p>
        )}

        {questions.map((question) => (
          <div key={question.id} className="flex flex-col gap-2">
            <p className="font-copy text-body text-ink">{question.text}</p>

            <div className="flex flex-col gap-[6px]">
              {[...question.choices]
                .sort((a, b) => a.display_order - b.display_order)
                .map((choice) => (
                  <ChoiceRow
                    key={choice.id}
                    text={choice.text}
                    selected={answers.get(question.id) === choice.id}
                    outcome={outcome(question, choice)}
                    onSelect={() =>
                      !result && setAnswers((m) => new Map(m).set(question.id, choice.id))
                    }
                  />
                ))}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={busy || (!result && !answeredAll)}
            onClick={() => void submit()}
            className="rounded-control bg-primary px-4 py-[6px] text-body font-bold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {result ? "إعادة المحاولة" : "تسليم"}
          </button>

          {result && (
            <span className={`text-body ${result.is_passed ? "text-success" : "text-primary"}`}>
              {percentLabel(result.percentage)} · {result.is_passed ? "ناجح" : "راسب"}
            </span>
          )}
        </div>
      </Panel>
    </section>
  );
}

function ChoiceRow({
  text,
  selected,
  outcome,
  onSelect,
}: {
  text: string;
  selected: boolean;
  outcome: Outcome;
  onSelect: () => void;
}) {
  const paint =
    outcome === "correct"
      ? "border-success bg-success-tint text-success"
      : outcome === "wrong"
        ? "border-primary bg-primary-tint text-primary"
        : selected
          ? "border-accent bg-accent-tint text-ink"
          : "border-border text-ink hover:bg-hover";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex h-8 items-center rounded-control border px-[10px] text-start text-body ${paint}`}
    >
      {text}
    </button>
  );
}
