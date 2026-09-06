import { useEffect, useMemo, useState } from "react";

import { ExamSummary, bestAttempt, hasBeenAttempted, scoreLabel } from "../api/models";
import { studentApi } from "../api/studentApi";
import { Cell, Panel, Row, Skeleton, StatePanel, Tab, Table, Verdict } from "../ui/primitives";
import { count, formatDate } from "../ui/text";
import { useSection } from "../ui/useSection";

/**
 * الإختبارات والإمتحانات — two tabs over one payload.
 *
 * /exams/student/list/ returns every active exam with the student's own
 * attempts nested, so "المتاحة" and "المكتملة" are two views of the same list
 * rather than two fetches.
 *
 * The design's الإغلاق column is absent, and cannot be added: exams.Exam
 * carries a duration and nothing else — no opening date, no closing date. An
 * exam is active or it is not. The column would have to be invented.
 */

interface Props {
  search: string;
  onCount: (label: string) => void;
  onStartExam: (examId: number) => void;
}

type ExamTab = "available" | "completed";

export function ExamsScreen({ search, onCount, onStartExam }: Props) {
  const [tab, setTab] = useState<ExamTab>("available");

  const section = useSection<ExamSummary[]>(
    (signal) => studentApi.exams(signal),
    (list) => list.length === 0,
  );

  const rows = useMemo(() => {
    const all = section.data ?? [];
    const needle = search.trim();

    return all
      // "Available" means "not yet tried" rather than "may still be tried":
      // there is no server-side attempt limit, so a sat exam can be sat again.
      .filter((exam) => (tab === "available" ? !hasBeenAttempted(exam) : hasBeenAttempted(exam)))
      .filter((exam) => !needle || exam.title.includes(needle) || exam.course_name.includes(needle));
  }, [section.data, search, tab]);

  useEffect(() => {
    if (section.status === "data" || section.status === "empty") {
      const total = section.data?.length ?? 0;
      onCount(count(total, "اختبار", "اختباران", "اختبارات", "واحد"));
    }
  }, [section.status, section.data, onCount]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Tab label="المتاحة" active={tab === "available"} onClick={() => setTab("available")} />
        <Tab label="المكتملة" active={tab === "completed"} onClick={() => setTab("completed")} />
      </div>

      <Panel>
        {section.status === "loading" && <Skeleton rows={3} />}

        {section.status === "error" && (
          <StatePanel message={section.error ?? ""} onAction={section.reload} />
        )}

        {section.status === "empty" && (
          <p className="p-card text-body text-ink-muted">لا توجد اختبارات في كورساتك بعد.</p>
        )}

        {section.status === "data" &&
          (rows.length === 0 ? (
            <p className="p-card text-body text-ink-muted">
              {search.trim()
                ? "لا توجد اختبارات مطابقة."
                : tab === "available"
                  ? "لا توجد اختبارات متاحة."
                  : "لم تُجرِ أي اختبار بعد."}
            </p>
          ) : tab === "available" ? (
            <AvailableTable exams={rows} onStart={onStartExam} />
          ) : (
            <CompletedTable exams={rows} />
          ))}
      </Panel>
    </div>
  );
}

function AvailableTable({
  exams,
  onStart,
}: {
  exams: ExamSummary[];
  onStart: (examId: number) => void;
}) {
  return (
    <Table head={["الاختبار", "الكورس", "المدة", "الأسئلة", "إجراء"]}>
      {exams.map((exam) => (
        <Row key={exam.id}>
          <Cell className="font-medium">{exam.title}</Cell>
          <Cell className="text-ink-secondary">{exam.course_name}</Cell>
          <Cell className="text-ink-secondary">
            {count(exam.duration_minutes, "دقيقة", "دقيقتان", "دقائق")}
          </Cell>
          <Cell className="text-ink-secondary">
            {count(exam.question_count, "سؤال", "سؤالان", "أسئلة", "واحد")}
          </Cell>
          <Cell>
            <button
              type="button"
              onClick={() => onStart(exam.id)}
              className="rounded-control bg-primary px-4 py-1 text-secondary font-bold text-white hover:bg-primary-hover"
            >
              ابدأ
            </button>
          </Cell>
        </Row>
      ))}
    </Table>
  );
}

/**
 * The best attempt, not the last: there is no server-side attempt limit, so a
 * student may have several, and the record that counts is the strongest one.
 */
function CompletedTable({ exams }: { exams: ExamSummary[] }) {
  return (
    <Table head={["الاختبار", "الكورس", "التاريخ", "الدرجة", "النتيجة"]}>
      {exams.map((exam) => {
        const best = bestAttempt(exam);

        return (
          <Row key={exam.id}>
            <Cell className="font-medium">{exam.title}</Cell>
            <Cell className="text-ink-secondary">{exam.course_name}</Cell>
            <Cell className="text-ink-secondary">
              {best?.submitted_at ? formatDate(best.submitted_at) : "—"}
            </Cell>
            <Cell className="font-medium">
              {best ? scoreLabel(best.score, exam.total_marks) : "—"}
            </Cell>
            <Cell>{best ? <Verdict passed={best.is_passed} /> : "—"}</Cell>
          </Row>
        );
      })}
    </Table>
  );
}
