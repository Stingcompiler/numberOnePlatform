import {
  Course,
  ExamSummary,
  LessonProgress,
  LiveRoom,
  LiveSession,
  LiveStatuses,
  Notification,
  canJoin,
  lessonCount,
  liveStatusLabel,
  notificationTimeLabel,
  providerLabel,
  sessionTimeLabel,
} from "../api/models";
import { studentApi } from "../api/studentApi";
import { auth, watermarkName } from "../auth/authService";
import { RouteId } from "../shell/routes";
import { Icon } from "../ui/Icon";
import { IconName } from "../ui/icons";
import { Panel, SectionHeading, Skeleton } from "../ui/primitives";
import { arabicDigits, count, formatDate, percentLabel } from "../ui/text";
import { Section, useSection } from "../ui/useSection";

/**
 * الرئيسية — five unrelated endpoints, five independently-resolving sections.
 *
 * The layout is the design's: a stat row across the top, the live banner under
 * it, the quick-access tiles, then a 1.35 / 1 split with the work on the
 * leading side and the feed on the trailing one. Nothing here waits on anything
 * else; a slow notifications feed must never hold up the stat row.
 *
 * On the stat captions: the design mocks up four and only three have anything
 * behind them. "نشطة هذا الأسبوع" and "+٥ هذا الأسبوع" come from LessonProgress,
 * which carries last_viewed and completed_at. "أقربها بعد يومين" does not —
 * exams.Exam has no opening or closing date at all, only a duration — so that
 * caption states what is true instead, and "+٦٪ عن الفصل السابق" is replaced by
 * the attempt count, because there are no terms in the schema to compare
 * across. Inventing either would put a number on the dashboard that no query
 * could reproduce.
 */

interface Props {
  onNavigate: (route: RouteId) => void;
  onOpenCourse: (courseId: number) => void;
  onStartExam: (examId: number) => void;
}

export function HomeScreen({ onNavigate, onOpenCourse, onStartExam }: Props) {
  const courses = useSection<Course[]>(
    (signal) => studentApi.courses(signal),
    (list) => list.length === 0,
  );

  // Every exam, not just the unattempted ones: the table shows what is still
  // open, but the average needs the attempts that ride along on the same
  // payload, and fetching the list twice for that would be waste.
  const exams = useSection<ExamSummary[]>(
    (signal) => studentApi.exams(signal),
    (list) => list.length === 0,
  );

  const notifications = useSection<Notification[]>(
    async (signal) => (await studentApi.notifications(1, signal)).results,
    (list) => list.length === 0,
  );

  const liveRooms = useSection<LiveRoom[]>(
    (signal) => studentApi.liveRooms(signal),
    (rooms) => rooms.flatMap((r) => r.sessions).length === 0,
  );

  // The stat row renders zeroes rather than an empty state.
  const progress = useSection<LessonProgress[]>(
    (signal) => studentApi.progress(signal),
    () => false,
  );

  const user = auth.currentUser;
  const profile = user?.student_profile ?? null;
  const name = watermarkName(user);
  const grade = profile?.enrolled_grade_name?.trim();
  const balance = profile?.balance ?? null;
  const hasBalance = !!balance?.trim() && balance !== "0.00";

  function reloadAll() {
    courses.reload();
    exams.reload();
    notifications.reload();
    liveRooms.reload();
    progress.reload();
  }

  const banner = bannerSession(liveRooms.data ?? []);

  return (
    <div className="flex flex-col gap-6">
      {/* ══ Header and stats ══════════════════════════════════════════ */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h1 className="shrink-0 font-ui text-heading font-bold text-ink">
            {grade ? `${name} — ${grade}` : name}
          </h1>

          <span className="h-px flex-1 bg-border" aria-hidden="true" />

          {/* The only part of the financial file a student can read: the
              balance comes from the auth payload, not from finance/, whose
              views are all IsAdminOrManager. */}
          {hasBalance && (
            <>
              <span className="text-secondary text-ink-secondary">الرصيد المتبقي</span>
              <span className="font-ui text-body text-warning">
                {arabicDigits(balance!)} ج.س
              </span>
            </>
          )}

          <button
            type="button"
            onClick={reloadAll}
            title="تحديث"
            aria-label="تحديث"
            className="grid h-7 w-7 place-items-center rounded-control text-ink-muted hover:bg-hover"
          >
            <Icon name="Refresh" size={14} />
          </button>
        </div>

        <StatRow courses={courses} progress={progress} exams={exams} />
      </div>

      {/* ══ Live banner ═══════════════════════════════════════════════
          One line, not a card grid: at most one session matters at a time. It
          is absent entirely when there is nothing scheduled, rather than
          sitting there empty. */}
      {banner && (
        <LiveBanner
          session={banner}
          roomName={roomOf(liveRooms.data ?? [], banner)?.room_name}
          onAll={() => onNavigate("live")}
        />
      )}

      {/* ══ الوصول السريع ═════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3">
        <SectionHeading title="الوصول السريع" />
        <QuickAccess onNavigate={onNavigate} />
      </div>

      {/* ══ Work, and the feed ════════════════════════════════════════ */}
      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        {/* ── Leading column ──────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <SectionHeading
            title="الاختبارات المتاحة"
            action={
              <button
                type="button"
                onClick={() => onNavigate("exams")}
                className="shrink-0 text-secondary text-accent hover:underline"
              >
                عرض الكل
              </button>
            }
          />

          <UpcomingExams section={exams} onStart={onStartExam} />

          <div className="mt-1">
            <SectionHeading title="تابع من حيث توقفت" />
          </div>

          <ContinueLearning
            courses={courses}
            progress={progress}
            onOpenCourse={onOpenCourse}
          />
        </div>

        {/* ── Trailing column: the feed ───────────────────────────── */}
        <div className="flex flex-col gap-3">
          <SectionHeading
            title="آخر الإشعارات"
            action={
              <button
                type="button"
                onClick={() => onNavigate("notifications")}
                className="shrink-0 text-secondary text-accent hover:underline"
              >
                عرض الكل
              </button>
            }
          />

          <RecentNotifications section={notifications} />
        </div>
      </div>
    </div>
  );
}

/* ── the stat row ───────────────────────────────────────────────────────── */

const WeekMs = 7 * 24 * 60 * 60 * 1000;

function withinTheWeek(value: string | null | undefined): boolean {
  if (!value) return false;
  const at = Date.parse(value);
  return Number.isFinite(at) && Date.now() - at <= WeekMs;
}

/**
 * Four cards, each caption derived from something the API actually returns.
 *
 * The row draws from three sections and waits for none of them: a card whose
 * section has not landed reads zero and then updates, which is what MAUI does
 * — the alternative is three quarters of the row held back by one endpoint.
 */
function StatRow({
  courses,
  progress,
  exams,
}: {
  courses: Section<Course[]>;
  progress: Section<LessonProgress[]>;
  exams: Section<ExamSummary[]>;
}) {
  const courseList = courses.data ?? [];
  const progressList = progress.data ?? [];
  const examList = exams.data ?? [];

  // Courses touched in the last seven days, by last_viewed on any of their
  // lessons. "Active" is genuinely about attention, not enrolment.
  const recent = new Set(
    progressList.filter((p) => withinTheWeek(p.last_viewed)).map((p) => p.lesson),
  );
  const activeThisWeek = courseList.filter((course) =>
    course.units.some((unit) => unit.lessons.some((lesson) => recent.has(lesson.id))),
  ).length;

  const completed = progressList.filter((p) => p.is_completed).length;
  const completedThisWeek = progressList.filter(
    (p) => p.is_completed && withinTheWeek(p.completed_at),
  ).length;

  const pending = upcoming(examList).length;

  const attempts = examList.flatMap((e) => e.attempts);
  const average =
    attempts.length === 0
      ? 0
      : Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        label="الكورسات"
        value={arabicDigits(courseList.length)}
        caption={
          activeThisWeek === 0
            ? "لم تُفتح كورسات هذا الأسبوع"
            : `${arabicDigits(activeThisWeek)} نشطة هذا الأسبوع`
        }
      />

      <Stat
        label="المحاضرات المكتملة"
        value={arabicDigits(completed)}
        caption={
          completedThisWeek === 0 ? "لا جديد هذا الأسبوع" : `+${arabicDigits(completedThisWeek)} هذا الأسبوع`
        }
        // Success only when there is a gain to report.
        captionClass={completedThisWeek > 0 ? "text-success" : undefined}
      />

      <Stat
        label="الاختبارات المتاحة"
        value={arabicDigits(pending)}
        // An active exam has no schedule in the schema — no opens_at, no
        // closes_at — so it is simply open. Saying so is the only caption the
        // data supports.
        caption={pending === 0 ? "لا شيء في انتظارك" : "متاحة الآن"}
      />

      <Stat
        label="متوسط الدرجات"
        value={percentLabel(average)}
        // The base the average is over, not a trend.
        caption={
          attempts.length === 0
            ? "لم تُجرِ اختباراً بعد"
            : `من ${arabicDigits(attempts.length)} محاولة`
        }
      />
    </div>
  );
}

function Stat({
  label,
  value,
  caption,
  captionClass = "text-ink-muted",
}: {
  label: string;
  value: string;
  caption: string;
  captionClass?: string;
}) {
  return (
    <Panel className="flex flex-col gap-1 p-card">
      <span className="text-label text-ink-muted">{label}</span>
      <span className="font-ui text-title font-extrabold text-ink">{value}</span>
      <span className={`text-label ${captionClass}`}>{caption}</span>
    </Panel>
  );
}

/* ── the live banner ────────────────────────────────────────────────────── */

/**
 * The session the banner shows: one that is live now, else the soonest
 * upcoming one. Ended sessions never lead the banner.
 */
function bannerSession(rooms: LiveRoom[]): LiveSession | null {
  const sessions = rooms.flatMap((r) => r.sessions);
  if (sessions.length === 0) return null;

  const now = sessions.find((s) => s.status === LiveStatuses.Live);
  if (now) return now;

  return (
    sessions
      .filter((s) => s.status === LiveStatuses.Upcoming && s.scheduled_start)
      .sort((a, b) => Date.parse(a.scheduled_start!) - Date.parse(b.scheduled_start!))[0] ?? null
  );
}

function roomOf(rooms: LiveRoom[], session: LiveSession): LiveRoom | undefined {
  return rooms.find((r) => r.sessions.some((s) => s.id === session.id));
}

/**
 * "جارٍ الآن" or "يبدأ بعد ١٢ دقيقة", from scheduled_start. The design also
 * shows a connected-student count beside it; nothing in live/ reports one, so
 * it is left out rather than guessed at.
 */
function bannerStatus(session: LiveSession): string {
  if (session.status === LiveStatuses.Live) return "جارٍ الآن";
  if (!session.scheduled_start) return liveStatusLabel(session.status);

  const until = Date.parse(session.scheduled_start) - Date.now();
  if (!Number.isFinite(until)) return liveStatusLabel(session.status);
  if (until <= 0) return "على وشك البدء";

  const minutes = until / 60000;
  if (minutes < 60) {
    return `يبدأ بعد ${count(Math.ceil(minutes), "دقيقة", "دقيقتان", "دقائق")}`;
  }

  const hours = minutes / 60;
  if (hours < 24) {
    return `يبدأ بعد ${count(Math.floor(hours), "ساعة", "ساعتان", "ساعات")}`;
  }

  return `يبدأ ${formatDate(session.scheduled_start)}`;
}

function LiveBanner({
  session,
  roomName,
  onAll,
}: {
  session: LiveSession;
  roomName?: string;
  onAll: () => void;
}) {
  const isLive = session.status === LiveStatuses.Live;

  // "قاعة الرياضيات ٢ · Zoom · ١٦:٠٠".
  const meta = [roomName, providerLabel(session), sessionTimeLabel(session)]
    .filter((part) => !!part)
    .join(" · ");

  return (
    <Panel className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span
        aria-hidden="true"
        className={`h-[6px] w-[6px] shrink-0 rounded-full ${isLive ? "bg-primary" : "bg-ink-muted"}`}
      />

      <span className="font-ui text-body font-bold text-ink">
        بث مباشر — {session.session_name}
      </span>

      <span className="text-secondary text-ink-secondary">{meta}</span>

      <button type="button" onClick={onAll} className="text-secondary text-accent hover:underline">
        كل الجلسات
      </button>

      <span className={`flex-1 text-secondary ${isLive ? "text-primary" : "text-ink-secondary"}`}>
        {bannerStatus(session)}
      </span>

      {/* The join control is live only while the session is. The stream opens
          in the system browser — there is no in-app player for live. */}
      {canJoin(session) && (
        <a
          href={session.stream_url!}
          target="_blank"
          rel="noreferrer"
          className="rounded-control bg-primary px-4 py-[6px] text-body font-bold text-white hover:bg-primary-hover"
        >
          انضم الآن
        </a>
      )}
    </Panel>
  );
}

/* ── quick access ───────────────────────────────────────────────────────── */

/**
 * The seven routes the sidebar carries, as tiles.
 *
 * Redundant with the sidebar by design. The sidebar is for someone who knows
 * where they are going; this is for someone looking — and it is the one part of
 * the dashboard that still works when every section behind it has failed.
 */
const Tiles: { route: RouteId; icon: IconName; label: string; plate: string; ink: string }[] = [
  { route: "courses", icon: "Courses", label: "الكورسات", plate: "bg-accent-tint", ink: "text-accent" },
  { route: "lectures", icon: "Lecture", label: "المحاضرات", plate: "bg-accent-tint", ink: "text-accent" },
  { route: "live", icon: "Live", label: "البث المباشر", plate: "bg-primary-tint", ink: "text-primary" },
  { route: "exams", icon: "Exams", label: "الاختبارات", plate: "bg-warning-tint", ink: "text-warning" },
  { route: "results", icon: "Results", label: "النتائج", plate: "bg-success-tint", ink: "text-success" },
  { route: "notifications", icon: "Bell", label: "الإشعارات", plate: "bg-accent-tint", ink: "text-accent" },
  { route: "profile", icon: "User", label: "حسابي", plate: "bg-warning-tint", ink: "text-warning" },
];

function QuickAccess({ onNavigate }: { onNavigate: (route: RouteId) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {Tiles.map((tile) => (
        <button
          key={tile.route}
          type="button"
          onClick={() => onNavigate(tile.route)}
          className="flex flex-col items-center gap-[10px] rounded-panel border border-border bg-surface px-3 py-4 transition-colors hover:bg-hover"
        >
          <span className={`grid h-9 w-9 place-items-center rounded-panel ${tile.plate} ${tile.ink}`}>
            <Icon name={tile.icon} size={20} />
          </span>
          <span className="text-secondary text-ink">{tile.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ── الاختبارات المتاحة ─────────────────────────────────────────────────── */

/** Exams never attempted. What the design calls "القادمة". */
function upcoming(exams: ExamSummary[]): ExamSummary[] {
  return exams.filter((exam) => exam.attempts.length === 0);
}

/**
 * The card carries its own loading and error states, as in MAUI: a retry here
 * refetches the exams and nothing else on the dashboard.
 */
function UpcomingExams({
  section,
  onStart,
}: {
  section: Section<ExamSummary[]>;
  onStart: (examId: number) => void;
}) {
  const rows = upcoming(section.data ?? []);

  return (
    <Panel>
      {section.status === "loading" && <Skeleton rows={3} />}

      {section.status === "error" && (
        <StatePanel message="تعذّر تحميل الاختبارات المتاحة." onRetry={section.reload} />
      )}

      {(section.status === "data" || section.status === "empty") &&
        (rows.length === 0 ? (
          <p className="p-card text-body text-ink-muted">لا توجد اختبارات متاحة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse">
              <thead>
                <tr>
                  {/* The design's third column is a closing date; exams.Exam has
                      no date field of any kind, so it carries the duration. */}
                  {["الاختبار", "الكورس", "المدة", "إجراء"].map((label) => (
                    <th
                      key={label}
                      className="border-b border-border px-4 py-[10px] text-start text-label font-bold text-ink-muted last:text-center"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((exam) => (
                  <tr key={exam.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2 align-middle">
                      <span className="flex flex-col gap-[2px]">
                        <span className="text-body text-ink">{exam.title}</span>
                        <span className="text-label text-ink-muted">
                          {count(exam.question_count, "سؤال", "سؤالان", "أسئلة", "واحد")}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2 align-middle text-body text-ink-secondary">
                      {exam.course_name}
                    </td>
                    <td className="px-4 py-2 align-middle text-body text-ink-secondary">
                      {count(exam.duration_minutes, "دقيقة", "دقيقتان", "دقائق")}
                    </td>
                    <td className="px-4 py-2 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => onStart(exam.id)}
                        className="rounded-control border border-border px-3 py-1 text-secondary text-ink hover:bg-hover"
                      >
                        ابدأ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </Panel>
  );
}

/* ── تابع من حيث توقفت ──────────────────────────────────────────────────── */

/**
 * Courses with unfinished lessons, most-progressed first.
 *
 * A course drops out of this grid the moment it is finished rather than sitting
 * at 100% — there is nothing left to continue.
 */
function ContinueLearning({
  courses,
  progress,
  onOpenCourse,
}: {
  courses: Section<Course[]>;
  progress: Section<LessonProgress[]>;
  onOpenCourse: (courseId: number) => void;
}) {
  if (courses.status === "error") {
    return (
      <Panel>
        <StatePanel message="تعذّر تحميل كورساتك." onRetry={courses.reload} />
      </Panel>
    );
  }

  if (courses.status === "loading") {
    return (
      <Panel>
        <Skeleton rows={2} />
      </Panel>
    );
  }

  const done = new Set(
    (progress.data ?? []).filter((p) => p.is_completed).map((p) => p.lesson),
  );

  const rows = (courses.data ?? [])
    .map((course) => {
      const lessons = course.units.flatMap((unit) => unit.lessons);
      const completed = lessons.filter((lesson) => done.has(lesson.id)).length;
      const total = lessons.length || lessonCount(course);
      const percent = total === 0 ? 0 : Math.round((completed * 100) / total);
      return { course, completed, total, percent };
    })
    .filter((row) => row.total > 0 && row.completed < row.total)
    .sort((a, b) => b.percent - a.percent);

  if (rows.length === 0) {
    return (
      <Panel>
        <p className="p-card text-body text-ink-muted">لا توجد كورسات لمتابعتها.</p>
      </Panel>
    );
  }

  // Two to a row at the width the leading column gets.
  return (
    <div className="flex flex-wrap gap-3">
      {rows.map(({ course, percent }) => (
        <button
          key={course.id}
          type="button"
          onClick={() => onOpenCourse(course.id)}
          className="flex w-[300px] flex-col gap-2 rounded-panel border border-border bg-surface px-4 py-3 text-start hover:bg-hover"
        >
          <span className="flex items-end gap-2">
            <span className="font-ui text-body font-bold text-ink">{course.name}</span>
            {/* Falls back to a dash: an unassigned course is not an error. */}
            <span className="flex-1 truncate text-label text-ink-muted">
              {course.teacher_name?.trim() || "—"}
            </span>
            <span className="font-ui text-body text-ink">{percentLabel(percent)}</span>
          </span>

          {/* 4px track, radius 2 — the same bar the course screen uses. */}
          <span className="block h-1 w-full overflow-hidden rounded-full bg-hover">
            <span
              className="block h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── آخر الإشعارات ──────────────────────────────────────────────────────── */

/** The five most recent; the notifications screen has the rest. */
function RecentNotifications({ section }: { section: Section<Notification[]> }) {
  const rows = [...(section.data ?? [])]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 5);

  return (
    <Panel>
      {section.status === "loading" && <Skeleton rows={2} />}

      {section.status === "error" && (
        <StatePanel message="تعذّر تحميل الإشعارات." onRetry={section.reload} />
      )}

      {section.status === "empty" && (
        <p className="p-card text-body text-ink-muted">لا توجد إشعارات.</p>
      )}

      {section.status === "data" && (
        <ul>
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-start gap-[10px] border-b border-border px-4 py-[10px] last:border-b-0"
            >
              {/* Unread carries the dot and the weight; read carries neither. */}
              <span
                aria-hidden="true"
                className={`mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full ${
                  row.is_read ? "bg-transparent" : "bg-primary"
                }`}
              />

              <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <span className={`text-body text-ink ${row.is_read ? "" : "font-bold"}`}>
                  {row.title}
                </span>
                <span className="font-copy text-body text-ink-secondary">{row.message}</span>
              </span>

              <span className="shrink-0 text-label text-ink-muted">
                {notificationTimeLabel(row)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** A failure inside a card, with the retry for that card only. */
function StatePanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 p-card">
      <p className="flex items-center gap-2 text-body text-ink">
        <Icon name="AlertCircle" className="text-warning" />
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-2 rounded-control border border-border px-3 py-[6px] text-body text-ink hover:bg-hover"
      >
        <Icon name="Refresh" size={14} />
        إعادة المحاولة
      </button>
    </div>
  );
}
