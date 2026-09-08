import { useEffect, useMemo } from "react";

import { completedLessonIds, studentApi } from "../api/studentApi";
import { Course, lessonCount, unitCount } from "../api/models";
import { Cell, Chip, Panel, ProgressBar, Row, SectionView, Table } from "../ui/primitives";
import { count, percentLabel } from "../ui/text";
import { useSection } from "../ui/useSection";

/**
 * كورساتي — the courses table.
 *
 * Two calls, one section. Progress comes from a separate endpoint and is joined
 * here rather than being its own region: a course row without its progress
 * column is a half-drawn row, which is worse than waiting for both.
 */

interface Props {
  search: string;
  onOpen: (courseId: number) => void;
  onCount: (label: string) => void;
}

interface CoursesData {
  courses: Course[];
  completed: Set<number>;
}

export function CoursesScreen({ search, onOpen, onCount }: Props) {
  const section = useSection<CoursesData>(
    async (signal) => {
      const [courses, progress] = await Promise.all([
        studentApi.courses(signal),
        studentApi.progress(signal),
      ]);
      return { courses, completed: completedLessonIds(progress) };
    },
    (data) => data.courses.length === 0,
  );

  const rows = useMemo(() => {
    if (!section.data) return [];
    const needle = search.trim();
    if (!needle) return section.data.courses;

    return section.data.courses.filter(
      (course) =>
        course.name.includes(needle) ||
        (course.teacher_name ?? "").includes(needle) ||
        (course.grade_name ?? "").includes(needle),
    );
  }, [section.data, search]);

  // The count is the screen's to report, and only once its rows have landed —
  // a count printed while loading reads as zero.
  //
  // In an effect, not during render: calling it inline updates the shell while
  // this component is still rendering, which React refuses.
  useEffect(() => {
    if (section.status === "data" || section.status === "empty") {
      onCount(count(rows.length, "كورس", "كورسان", "كورسات", "واحد"));
    }
  }, [section.status, rows.length, onCount]);

  return (
    <Panel>
      <SectionView section={section} empty="لا توجد كورسات مسجّلة على حسابك.">
        {(data) =>
          rows.length === 0 ? (
            <p className="p-card text-body text-ink-muted">لا نتائج تطابق البحث.</p>
          ) : (
            <Table head={["الكورس", "المدرّس", "النظام", "التقدّم", "المحتوى", "إجراء"]}>
              {rows.map((course) => (
                <CourseRow
                  key={course.id}
                  course={course}
                  completed={data.completed}
                  onOpen={() => onOpen(course.id)}
                />
              ))}
            </Table>
          )
        }
      </SectionView>
    </Panel>
  );
}

function CourseRow({
  course,
  completed,
  onOpen,
}: {
  course: Course;
  completed: Set<number>;
  onOpen: () => void;
}) {
  const total = lessonCount(course);
  const done = course.units.reduce(
    (n, unit) => n + unit.lessons.filter((lesson) => completed.has(lesson.id)).length,
    0,
  );

  // Guarded: a course with no lessons is 0%, not a division by zero. The same
  // guard exists in MAUI and is the reason a new course does not render NaN.
  const percent = total === 0 ? 0 : Math.round((done * 100) / total);

  return (
    <Row onClick={onOpen}>
      <Cell className="font-medium">{course.name}</Cell>
      <Cell className="text-ink-secondary">{course.teacher_name || "—"}</Cell>
      <Cell>
        <Chip>{course.system_type || "—"}</Chip>
      </Cell>
      <Cell className="w-[140px]">
        <span className="flex flex-col gap-1">
          <span className="text-secondary text-ink-secondary">{percentLabel(percent)}</span>
          <ProgressBar fraction={percent / 100} />
        </span>
      </Cell>
      <Cell className="text-secondary text-ink-muted">
        {count(unitCount(course), "وحدة", "وحدتان", "وحدات")} ·{" "}
        {count(total, "محاضرة", "محاضرتان", "محاضرات")}
      </Cell>
      <Cell>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="rounded-control border border-border px-3 py-1 text-secondary text-ink hover:bg-hover"
        >
          فتح
        </button>
      </Cell>
    </Row>
  );
}
