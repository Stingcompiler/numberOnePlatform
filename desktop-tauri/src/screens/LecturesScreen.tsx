import { useEffect, useMemo, useState } from "react";

import { LectureRow, flattenLectures } from "../api/models";
import { completedLessonIds, studentApi } from "../api/studentApi";
import { Icon } from "../ui/Icon";
import { Cell, Panel, Row, SectionView, Table } from "../ui/primitives";
import { arabicDigits, count } from "../ui/text";
import { useSection } from "../ui/useSection";

/**
 * المحاضرات — every lecture the student can open, across every course, in one
 * flat table.
 *
 * The courses screen answers "how far am I through each subject". This answers
 * a different question — "what have I not watched yet" — which a student with
 * six courses cannot read off six separate trees.
 *
 * It costs nothing extra: /academic/my-courses/ already nests units and their
 * lessons, so the whole tree arrives in the payload the courses screen fetches.
 * No per-course call, and no new endpoint.
 */

interface Props {
  search: string;
  onOpen: (lessonId: number, courseId: number) => void;
  onCount: (label: string) => void;
}

type Filter = "all" | "unwatched";

export function LecturesScreen({ search, onOpen, onCount }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const section = useSection<LectureRow[]>(
    async (signal) => {
      const [courses, progress] = await Promise.all([
        studentApi.courses(signal),
        studentApi.progress(signal),
      ]);
      return flattenLectures(courses, completedLessonIds(progress));
    },
    (rows) => rows.length === 0,
  );

  const rows = useMemo(() => {
    const all = section.data ?? [];
    const needle = search.trim();

    return all.filter((row) => {
      if (filter === "unwatched" && row.isCompleted) return false;
      if (!needle) return true;
      return row.title.includes(needle) || row.courseName.includes(needle) || row.unitName.includes(needle);
    });
  }, [section.data, search, filter]);

  useEffect(() => {
    if (section.status === "data" || section.status === "empty") {
      onCount(count(rows.length, "محاضرة", "محاضرتان", "محاضرات"));
    }
  }, [section.status, rows.length, onCount]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="me-auto font-ui text-heading font-bold text-ink">كل المحاضرات</h2>
        <FilterTab label="الكل" active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterTab
          label="لم تُشاهَد بعد"
          active={filter === "unwatched"}
          onClick={() => setFilter("unwatched")}
        />
      </div>

      <Panel>
        <SectionView section={section} empty="لا توجد محاضرات في كورساتك بعد.">
          {() =>
            rows.length === 0 ? (
              <p className="p-card text-body text-ink-muted">
                {filter === "unwatched"
                  ? "شاهدت كل المحاضرات المتاحة."
                  : "لا نتائج تطابق البحث."}
              </p>
            ) : (
              <Table head={["المحاضرة", "الكورس", "الوحدة", "المدة", "الحالة"]}>
                {rows.map((row) => (
                  <Row key={row.lessonId} onClick={() => onOpen(row.lessonId, row.courseId)}>
                    <Cell className="font-medium">{row.title}</Cell>
                    <Cell className="text-ink-secondary">{row.courseName}</Cell>
                    <Cell className="text-ink-muted">{row.unitName}</Cell>
                    <Cell className="text-ink-muted">
                      {/* Nothing when the lecture carries no duration: a "لا
                          توجد دقائق" here reads as a fact about the lecture. */}
                      {(row.durationMinutes ?? 0) > 0 ? `${arabicDigits(row.durationMinutes!)} دقيقة` : "—"}
                    </Cell>
                    <Cell>
                      {row.isCompleted ? (
                        <span className="flex items-center gap-1 text-success">
                          <Icon name="Check" size={13} strokeWidth={2} />
                          مكتملة
                        </span>
                      ) : (
                        <span className="text-ink-muted">لم تُشاهَد</span>
                      )}
                    </Cell>
                  </Row>
                ))}
              </Table>
            )
          }
        </SectionView>
      </Panel>
    </div>
  );
}

function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-control border px-3 py-1 text-secondary transition-colors",
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-border text-ink-secondary hover:bg-hover",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
