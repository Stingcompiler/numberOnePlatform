import { useEffect, useMemo, useState } from "react";

import { ExamSummary, scoreLabel } from "../api/models";
import { studentApi } from "../api/studentApi";
import { Icon } from "../ui/Icon";
import {
  Cell,
  Panel,
  Row,
  Skeleton,
  Stat,
  StatePanel,
  Tab,
  Verdict,
} from "../ui/primitives";
import { arabicDigits, count, formatDate, percentLabel } from "../ui/text";
import { useSection } from "../ui/useSection";

/**
 * النتائج — a performance summary over a sortable, filterable, paged table.
 *
 * The table is READ-ONLY history and must stay that way. A student able to
 * delete their own exam record makes the academic record falsifiable by the
 * very person it grades: a failed attempt could vanish before a parent saw it.
 * There is no delete and no export here, and no endpoint for either.
 */

interface Props {
  search: string;
  onCount: (label: string) => void;
  onOpenAttempt: (attemptId: number) => void;
}

interface ResultRow {
  attemptId: number;
  examTitle: string;
  courseName: string;
  score: number;
  totalMarks: number;
  percentage: number;
  isPassed: boolean;
  submittedAt: string | null;
}

type Verdicts = "all" | "passed" | "failed";

type Sort =
  | "date-desc"
  | "date-asc"
  | "score-desc"
  | "score-asc"
  | "title-asc"
  | "title-desc"
  | "course-asc"
  | "course-desc";

/**
 * Eight rows to a page. The table sits under a summary and above the pager on a
 * 900px-tall window; more than eight and the pager falls below the fold, which
 * is the one place it must not be.
 */
const PageSize = 8;

export function ResultsScreen({ search, onCount, onOpenAttempt }: Props) {
  const [verdict, setVerdict] = useState<Verdicts>("all");
  const [sort, setSort] = useState<Sort>("date-desc");
  const [page, setPage] = useState(1);

  /**
   * Results are derived from the exams list rather than a results endpoint:
   * every attempt already rides along on /exams/student/list/, so there is
   * nothing further to fetch.
   */
  const section = useSection<ResultRow[]>(
    async (signal) => flatten(await studentApi.exams(signal)),
    (rows) => rows.length === 0,
  );

  const all = section.data ?? [];

  const visible = useMemo(() => {
    const needle = search.trim();

    const filtered = all
      .filter(
        (r) =>
          !needle ||
          r.examTitle.includes(needle) ||
          r.courseName.includes(needle),
      )
      .filter((r) =>
        verdict === "all"
          ? true
          : verdict === "passed"
            ? r.isPassed
            : !r.isPassed,
      );

    return [...filtered].sort(comparer(sort));
  }, [all, search, verdict, sort]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PageSize));
  const current = Math.min(page, pageCount);
  const rows = visible.slice((current - 1) * PageSize, current * PageSize);

  useEffect(() => {
    if (section.status === "data" || section.status === "empty") {
      onCount(count(all.length, "نتيجة", "نتيجتان", "نتائج"));
    }
  }, [section.status, all.length, onCount]);

  // Page 3 of an unfiltered table is usually past the end of a filtered one,
  // and an empty page reads as "no results" rather than "wrong page".
  useEffect(() => setPage(1), [verdict, search]);

  const passed = all.filter((r) => r.isPassed).length;
  const failed = all.length - passed;
  const average =
    all.length === 0
      ? 0
      : Math.round(all.reduce((sum, r) => sum + r.percentage, 0) / all.length);
  const best = [...all].sort((a, b) => b.percentage - a.percentage)[0] ?? null;

  /**
   * Each header toggles its own column, and switching columns starts that
   * column at its natural direction: names ascending, dates and scores
   * descending.
   */
  function sortBy(column: "title" | "course" | "date" | "score") {
    setSort((s) => {
      switch (column) {
        case "title":
          return s === "title-asc" ? "title-desc" : "title-asc";
        case "course":
          return s === "course-asc" ? "course-desc" : "course-asc";
        case "date":
          return s === "date-desc" ? "date-asc" : "date-desc";
        case "score":
          return s === "score-desc" ? "score-asc" : "score-desc";
      }
    });
  }

  const shown = `عرض ${arabicDigits(visible.length)} من ${arabicDigits(all.length)}`;

  return (
    <div className="flex flex-col gap-6">
      {/* ══ ملخّص الأداء ═══════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3">
        <Heading title="ملخّص الأداء" />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="متوسط الدرجات"
            value={percentLabel(average)}
            // The design compares against "الفصل السابق". Nothing in the schema
            // models a term, so the card states the base the mean is over.
            caption={shown}
          />
          <Stat
            label="محاولات ناجحة"
            value={arabicDigits(passed)}
            caption={`من ${arabicDigits(all.length)} محاولة`}
          />
          <Stat
            label="محاولات راسبة"
            value={arabicDigits(failed)}
            caption={failed > 0 ? "تتطلب إعادة" : undefined}
            captionClass={failed > 0 ? "text-primary" : "text-ink-muted"}
          />
          <Stat
            label="أعلى درجة"
            value={best ? scoreLabel(best.score, best.totalMarks) : "—"}
            caption={best?.examTitle}
          />
        </div>
      </div>

      {/* ══ سجل الاختبارات ═════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3">
        <Heading title="سجل الاختبارات" />

        <div className="flex items-center gap-2">
          <Tab
            label="الكل"
            active={verdict === "all"}
            onClick={() => setVerdict("all")}
          />
          <Tab
            label="ناجح"
            active={verdict === "passed"}
            onClick={() => setVerdict("passed")}
          />
          <Tab
            label="راسب"
            active={verdict === "failed"}
            onClick={() => setVerdict("failed")}
          />
          <span className="ms-auto text-label text-ink-muted">{shown}</span>
        </div>

        <Panel>
          {section.status === "loading" && <Skeleton rows={3} />}

          {section.status === "error" && (
            <StatePanel
              message={section.error ?? ""}
              onAction={section.reload}
            />
          )}

          {section.status === "empty" && (
            <p className="p-card text-body text-ink-muted">
              لم تُجرِ أي اختبار بعد.
            </p>
          )}

          {section.status === "data" &&
            (rows.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-card">
                <p className="text-body text-ink-muted">
                  لا توجد نتائج مطابقة للبحث أو الفلتر الحالي.
                </p>
                <button
                  type="button"
                  onClick={() => setVerdict("all")}
                  className="rounded-control border border-border px-3 py-[6px] text-body text-ink hover:bg-hover"
                >
                  إزالة الفلاتر
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr>
                      <SortHead
                        label="الاختبار"
                        onClick={() => sortBy("title")}
                      />
                      <SortHead
                        label="الكورس"
                        onClick={() => sortBy("course")}
                      />
                      <SortHead
                        label="التاريخ"
                        onClick={() => sortBy("date")}
                      />
                      <SortHead
                        label="الدرجة"
                        onClick={() => sortBy("score")}
                      />
                      <th className="border-b border-border px-4 py-[10px] text-start text-label font-bold text-ink-muted">
                        النتيجة
                      </th>
                      <th className="border-b border-border px-4 py-[10px] text-center text-label font-bold text-ink-muted">
                        إجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <Row
                        key={row.attemptId}
                        onClick={() => onOpenAttempt(row.attemptId)}
                      >
                        <Cell className="font-medium">{row.examTitle}</Cell>
                        <Cell className="text-ink-secondary">
                          {row.courseName}
                        </Cell>
                        <Cell className="text-ink-secondary">
                          {row.submittedAt ? formatDate(row.submittedAt) : "—"}
                        </Cell>
                        <Cell className="font-medium">
                          {scoreLabel(row.score, row.totalMarks)}
                        </Cell>
                        <Cell>
                          <Verdict passed={row.isPassed} />
                        </Cell>
                        <Cell className="text-center">
                          {/* The one row action there is. */}
                          <button
                            type="button"
                            aria-label="عرض التفاصيل"
                            title="عرض التفاصيل"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenAttempt(row.attemptId);
                            }}
                            className="grid h-[26px] w-[26px] place-items-center rounded-control text-ink-muted hover:bg-hover"
                          >
                            <Icon name="Eye" size={14} />
                          </button>
                        </Cell>
                      </Row>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </Panel>

        {/* In RTL, "previous" points right and "next" points left. */}
        {section.status === "data" && visible.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-label text-ink-muted">
              صفحة {arabicDigits(current)} من {arabicDigits(pageCount)}
            </span>

            <span className="ms-auto flex gap-1">
              <PagerButton
                icon="ChevronRight"
                label="الصفحة السابقة"
                disabled={current <= 1}
                onClick={() => setPage(current - 1)}
              />
              <PagerButton
                icon="ChevronLeft"
                label="الصفحة التالية"
                disabled={current >= pageCount}
                onClick={() => setPage(current + 1)}
              />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function flatten(exams: ExamSummary[]): ResultRow[] {
  return exams
    .flatMap((exam) =>
      exam.attempts.map((attempt) => ({
        attemptId: attempt.id,
        examTitle: exam.title,
        courseName: exam.course_name,
        score: attempt.score,
        totalMarks: exam.total_marks,
        percentage: attempt.percentage,
        isPassed: attempt.is_passed,
        submittedAt: attempt.submitted_at ?? null,
      })),
    )
    .sort(comparer("date-desc"));
}

function comparer(sort: Sort): (a: ResultRow, b: ResultRow) => number {
  const when = (row: ResultRow) =>
    row.submittedAt ? Date.parse(row.submittedAt) : 0;
  // Arabic collation, so ب sorts after أ rather than by code point.
  const text = (a: string, b: string) => a.localeCompare(b, "ar");

  switch (sort) {
    case "date-asc":
      return (a, b) => when(a) - when(b);
    case "score-desc":
      return (a, b) => b.percentage - a.percentage;
    case "score-asc":
      return (a, b) => a.percentage - b.percentage;
    case "title-asc":
      return (a, b) => text(a.examTitle, b.examTitle);
    case "title-desc":
      return (a, b) => text(b.examTitle, a.examTitle);
    case "course-asc":
      return (a, b) => text(a.courseName, b.courseName);
    case "course-desc":
      return (a, b) => text(b.courseName, a.courseName);
    default:
      return (a, b) => when(b) - when(a);
  }
}

/** A heading with a rule that starts where the words end. */
function Heading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="shrink-0 font-ui text-heading font-bold text-ink">
        {title}
      </h2>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}

/** The whole cell is the target, not just a caret. */
function SortHead({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <th className="border-b border-border p-0 text-start">
      <button
        type="button"
        onClick={onClick}
        className="w-full px-4 py-[10px] text-start text-label font-bold text-ink-muted hover:text-ink"
      >
        {label}
      </button>
    </th>
  );
}

function PagerButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: "ChevronRight" | "ChevronLeft";
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-7 w-7 place-items-center rounded-control border border-border text-ink hover:bg-hover disabled:opacity-40"
    >
      <Icon name={icon} size={14} strokeWidth={2} />
    </button>
  );
}
