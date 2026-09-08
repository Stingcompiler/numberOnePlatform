import { ExamAttemptAnswer, ExamAttemptDetail, describeAnswer, mark } from "../api/models";
import { studentApi } from "../api/studentApi";
import { Panel, SectionView } from "../ui/primitives";
import { arabicDigits, formatDate } from "../ui/text";
import { useSection } from "../ui/useSection";

/**
 * «عرض التفاصيل» — the answer sheet for a finished attempt, and the only row
 * action the results table has.
 *
 * This is where correct answers finally arrive. The exam endpoint omits them
 * while the exam can still be sat; the attempt endpoint includes them, which is
 * safe because the attempt is over.
 */

interface Props {
  attemptId: number;
}

export function AttemptDetailScreen({ attemptId }: Props) {
  const section = useSection<ExamAttemptDetail>(
    (signal) => studentApi.attempt(attemptId, signal),
    (attempt) => attempt.answers.length === 0,
    [attemptId],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Back lives in the top bar, not here. */}
      <SectionView section={section} empty="لا توجد إجابات مسجّلة في هذه المحاولة.">
        {(attempt) => (
          <>
            <Summary attempt={attempt} />

            <div className="h-px bg-border" aria-hidden="true" />

            <div className="flex flex-col gap-3">
              {attempt.answers.map((answer, i) => (
                <AnswerCard key={answer.id} answer={answer} index={i + 1} />
              ))}
            </div>
          </>
        )}
      </SectionView>
    </div>
  );
}

function Summary({ attempt }: { attempt: ExamAttemptDetail }) {
  const passed = attempt.is_passed;
  const correct = attempt.answers.filter((a) => a.is_correct).length;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="font-ui text-title font-bold text-ink">{attempt.exam_title ?? "—"}</span>
        <span className="text-label text-ink-muted">
          {attempt.submitted_at ? formatDate(attempt.submitted_at) : "—"} ·{" "}
          {arabicDigits(correct)} من {arabicDigits(attempt.answers.length)} صحيحة
        </span>
      </span>

      <span className="flex flex-col items-end gap-[2px]">
        <span className="text-label text-ink-muted">الدرجة</span>
        <span className="font-ui text-heading font-bold text-ink">
          {arabicDigits(mark(attempt.score))} / {arabicDigits(mark(attempt.total_marks))}
        </span>
      </span>

      <span
        className={`rounded-full px-[10px] py-1 text-secondary ${
          passed ? "bg-success-tint text-success" : "bg-primary-tint text-primary"
        }`}
      >
        {passed ? "ناجح" : "راسب"}
      </span>
    </div>
  );
}

function AnswerCard({ answer, index }: { answer: ExamAttemptAnswer; index: number }) {
  const student = describeAnswer(answer.question_type, answer.student_answer, answer.options);
  const correct = describeAnswer(answer.question_type, answer.correct_answer, answer.options);

  return (
    <Panel className="flex flex-col gap-2 p-card">
      <div className="flex items-start gap-2">
        <span className="shrink-0 text-label text-ink-muted">{arabicDigits(index)}</span>

        <p className="flex-1 font-copy text-body text-ink">{answer.question_text}</p>

        <span className="shrink-0 text-label text-ink-muted">
          {arabicDigits(mark(answer.earned_marks))} / {arabicDigits(mark(answer.question_marks))}
        </span>

        <span
          className={`shrink-0 text-label ${answer.is_correct ? "text-success" : "text-primary"}`}
        >
          {answer.is_correct ? "صحيحة" : "خاطئة"}
        </span>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
        <dt className="text-label text-ink-muted">إجابتك</dt>
        <dd className="text-body text-ink">{student}</dd>

        <dt className="text-label text-ink-muted">الصحيحة</dt>
        <dd className="text-body text-success">{correct}</dd>
      </dl>
    </Panel>
  );
}
