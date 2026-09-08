import { completedLessonIds, studentApi } from "../api/studentApi";
import { Course, Unit, lessonCount, unitCount } from "../api/models";
import { Icon } from "../ui/Icon";
import { Panel, ProgressBar, SectionHeading, SectionView } from "../ui/primitives";
import { arabicDigits, percentLabel } from "../ui/text";
import { useSection } from "../ui/useSection";

/**
 * الكورس — the units and their lectures.
 *
 * Units are listed open rather than collapsed. A student opens a course to find
 * the next lecture, and a screen of closed headings makes them click twice to
 * see anything; the MAUI screen behaves the same way.
 */

interface Props {
  courseId: number;
  onOpenLesson: (lessonId: number, courseId: number) => void;
}

interface DetailData {
  course: Course;
  completed: Set<number>;
}

export function CourseDetailScreen({ courseId, onOpenLesson }: Props) {
  const section = useSection<DetailData | null>(
    async (signal) => {
      const [course, progress] = await Promise.all([
        studentApi.course(courseId, signal),
        studentApi.progress(signal),
      ]);
      return course ? { course, completed: completedLessonIds(progress) } : null;
    },
    (data) => data === null,
    [courseId],
  );

  return (
    <div className="flex flex-col gap-4">
      <SectionView section={section} empty="لم يعد هذا الكورس متاحاً على حسابك.">
        {(data) =>
          data && (
            <>
              <Summary course={data.course} completed={data.completed} />

              <SectionHeading title="محتوى الكورس" />

              <div className="flex flex-col gap-3">
                {data.course.units.length === 0 ? (
                  <Panel>
                    <p className="p-card text-body text-ink-muted">
                      لا توجد وحدات في هذا الكورس بعد.
                    </p>
                  </Panel>
                ) : (
                  data.course.units.map((unit) => (
                    <UnitCard
                      key={unit.id}
                      unit={unit}
                      completed={data.completed}
                      onOpenLesson={(lessonId) => onOpenLesson(lessonId, courseId)}
                    />
                  ))
                )}
              </div>
            </>
          )
        }
      </SectionView>
    </div>
  );
}

function Summary({ course, completed }: { course: Course; completed: Set<number> }) {
  const total = lessonCount(course);
  const done = course.units.reduce(
    (n, unit) => n + unit.lessons.filter((l) => completed.has(l.id)).length,
    0,
  );
  const percent = total === 0 ? 0 : Math.round((done * 100) / total);

  return (
    <Panel className="p-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-ui text-title font-bold text-ink">{course.name}</h1>
          <p className="text-secondary text-ink-muted">
            {course.teacher_name || "—"} · {course.grade_name || "—"}
          </p>
        </div>

        <dl className="flex gap-6">
          <Stat label="الوحدات" value={arabicDigits(unitCount(course))} />
          <Stat label="المحاضرات" value={arabicDigits(total)} />
          <Stat label="التقدّم" value={percentLabel(percent)} />
        </dl>
      </div>

      <div className="mt-4">
        <ProgressBar fraction={total === 0 ? 0 : done / total} />
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-label text-ink-muted">{label}</dt>
      <dd className="font-ui text-heading font-bold text-ink">{value}</dd>
    </div>
  );
}

function UnitCard({
  unit,
  completed,
  onOpenLesson,
}: {
  unit: Unit;
  completed: Set<number>;
  onOpenLesson: (lessonId: number) => void;
}) {
  const done = unit.lessons.filter((l) => completed.has(l.id)).length;

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="font-ui text-body font-bold text-ink">{unit.name}</h3>
        <span className="text-secondary text-ink-muted">
          {arabicDigits(done)} من {arabicDigits(unit.lessons.length)}
        </span>
      </div>

      {unit.lessons.length === 0 ? (
        <p className="px-4 py-3 text-body text-ink-muted">لا توجد محاضرات في هذه الوحدة.</p>
      ) : (
        <ul>
          {unit.lessons.map((lesson, index) => (
            <li key={lesson.id}>
              <button
                type="button"
                onClick={() => onOpenLesson(lesson.id)}
                className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-start last:border-b-0 hover:bg-hover"
              >
                <span className="w-6 shrink-0 text-secondary text-ink-muted">
                  {arabicDigits(index + 1)}
                </span>

                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body text-ink">{lesson.title}</span>
                  {/* Nothing at all when the lesson carries no duration.
                      Running it through the counter printed "لا توجد دقائق"
                      under a lecture, which reads as a fact about the lecture
                      rather than a field nobody filled in. MAUI guards the same
                      way, and uses the singular with any number. */}
                  {(lesson.duration_minutes ?? 0) > 0 && (
                    <span className="text-label text-ink-muted">
                      {arabicDigits(lesson.duration_minutes!)} دقيقة
                    </span>
                  )}
                </span>

                {completed.has(lesson.id) && (
                  <Icon name="Check" size={13} strokeWidth={2} className="text-success" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
