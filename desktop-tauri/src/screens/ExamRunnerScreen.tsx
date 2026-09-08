import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ExamAnswer,
  ExamAttemptDetail,
  ExamDetail,
  ExamQuestion,
  QuestionTypes,
  examAnswers,
  mark,
} from "../api/models";
import { studentApi } from "../api/studentApi";
import { Messages } from "../api/client";
import { Icon } from "../ui/Icon";
import {
  ConfirmDialog,
  Panel,
  ProgressBar,
  Skeleton,
  StatePanel,
} from "../ui/primitives";
import { arabicDigits, percentLabel } from "../ui/text";
import { useSection } from "../ui/useSection";

/**
 * Sitting an exam. One question at a time, in a 720px column centred in the
 * window — the only screen in the app that is not full width, because it is the
 * only one where everything else is a distraction.
 *
 * THE CLOCK IS CLIENT-SIDE AND ADVISORY. Nothing on the server enforces the
 * duration: exams.Exam carries duration_minutes, ExamAttempt.started_at is
 * written at submit time alongside submitted_at, and the submit endpoint never
 * checks elapsed time. Running out does not void the attempt, and this screen
 * must never imply that it does.
 */

interface Props {
  examId: number;
  /** "العودة إلى الاختبارات" after a result, and "حفظ والخروج" before one. */
  onFinish: () => void;
}

export function ExamRunnerScreen({ examId, onFinish }: Props) {
  const section = useSection<ExamDetail>(
    (signal) => studentApi.exam(examId, signal),
    (exam) => exam.questions.length === 0,
    [examId],
  );

  const exam = section.data;

  const questions = useMemo(
    () => [...(exam?.questions ?? [])].sort((a, b) => a.display_order - b.display_order),
    [exam],
  );

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, ExamAnswer>>(new Map());
  const [warning, setWarning] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ExamAttemptDetail | null>(null);

  const question = questions[index] ?? null;
  const isLast = questions.length > 0 && index === questions.length - 1;

  /**
   * Blocks a second submit. The countdown and the student's own button can both
   * fire, and two submits are two attempts on the record. A ref, not state: the
   * guard has to hold within one tick, before a render.
   */
  const submittedRef = useRef(false);

  /**
   * Submits every question — including the ones left blank, explicitly. The
   * server treats a missing question as blank anyway, so sending them keeps the
   * submitted count matching what the student actually saw.
   *
   * Never throws. It is reached from the countdown as well as from the button,
   * and an exception on the tick has nowhere to go at the exact moment a
   * student's time expires and their answers are still unsent.
   */
  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    setSubmitting(true);
    setSubmitError(null);

    const paper = questions.map((q) => answers.get(q.id) ?? examAnswers.blank(q.id));

    try {
      const outcome = await studentApi.submitExam(examId, { answers: paper });
      setResult(outcome.attempt ?? null);
      if (!outcome.attempt) {
        // A 200 with no attempt is not a result. Keep the paper.
        submittedRef.current = false;
        setSubmitError(Messages.sectionFailed);
      }
    } catch (cause) {
      // The answers are still in state, so retrying sends the same paper
      // rather than a blank one.
      submittedRef.current = false;
      setSubmitError(cause instanceof Error ? cause.message : Messages.sectionFailed);
    } finally {
      setSubmitting(false);
    }
  }, [answers, examId, questions]);

  // ── The countdown ──────────────────────────────────────────────────────
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    // Started only after the exam has loaded, so it does not count down from a
    // duration that is still zero.
    if (!exam) return;
    setRemaining(exam.duration_minutes * 60);
  }, [exam]);

  // `submit` changes with every answer, and the interval must call the CURRENT
  // one — re-registering the interval instead would restart the second it is in
  // the middle of, and capturing it once would submit a paper missing every
  // answer given after the clock started.
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    if (remaining === null || result) return;

    const id = window.setInterval(() => {
      setRemaining((seconds) => {
        if (seconds === null) return null;
        if (seconds <= 1) {
          // Out of time: send what they have rather than lose the attempt.
          void submitRef.current();
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [remaining === null, result]);

  function answer(built: ExamAnswer) {
    setAnswers((current) => new Map(current).set(built.question_id, built));
    setWarning("");
  }

  function next() {
    if (!question) return;

    // Advancing with nothing selected warns rather than silently recording a
    // blank — a blank scores zero, and the student should know.
    if (!answers.has(question.id)) {
      setWarning("اختر إجابة للمتابعة");
      return;
    }

    if (isLast) {
      setConfirming(true);
      return;
    }

    setIndex((i) => i + 1);
    setWarning("");
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      {section.status === "loading" && (
        <Panel>
          <Skeleton rows={2} />
        </Panel>
      )}

      {section.status === "error" && (
        <Panel>
          <StatePanel message={section.error ?? ""} onAction={section.reload} />
        </Panel>
      )}

      {section.status === "empty" && (
        <Panel>
          <p className="p-card text-body text-ink-muted">لا توجد أسئلة في هذا الاختبار.</p>
        </Panel>
      )}

      {exam && !result && section.status === "data" && (
        <Panel>
          <div className="flex items-start justify-between gap-3 border-b border-border p-card">
            <span className="flex flex-col gap-[2px]">
              <span className="font-ui text-heading font-bold text-ink">{exam.title}</span>
              <span className="text-secondary text-ink-secondary">{exam.course_name}</span>
            </span>

            <span className="flex h-7 shrink-0 items-center gap-[6px] rounded-full bg-warning-tint px-3 text-warning">
              <Icon name="Clock" size={13} />
              <span className="ltr text-secondary">{clock(remaining)}</span>
            </span>
          </div>

          <div className="flex flex-col gap-4 p-card">
            <div className="flex flex-col gap-[6px]">
              <span className="text-label text-ink-muted">
                سؤال {arabicDigits(index + 1)} من {arabicDigits(questions.length)}
              </span>
              <ProgressBar fraction={questions.length === 0 ? 0 : (index + 1) / questions.length} />
            </div>

            {/* Running copy: the question is prose, not a label. */}
            <p className="font-copy text-heading font-medium text-ink">{question?.text}</p>

            {question && (
              <Answers
                question={question}
                chosen={answers.get(question.id) ?? null}
                onAnswer={answer}
              />
            )}

            <div className="flex items-center gap-2">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => setIndex((i) => i - 1)}
                  className="rounded-control border border-border px-4 py-[6px] text-body text-ink hover:bg-hover"
                >
                  السابق
                </button>
              )}

              {/* Honest wording: there is no server-side draft. Leaving keeps
                  nothing, and the exams screen says so when they return. */}
              <button
                type="button"
                onClick={onFinish}
                className="rounded-control px-3 py-[6px] text-body text-ink-secondary hover:bg-hover"
              >
                حفظ والخروج
              </button>

              <button
                type="button"
                onClick={next}
                disabled={submitting}
                className="ms-auto rounded-control bg-primary px-5 py-[6px] text-body font-bold text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {isLast ? "إنهاء وتسليم" : "السؤال التالي"}
              </button>
            </div>

            {warning && <p className="text-label text-warning">{warning}</p>}

            {/*
              The paper did not go.

              This is not a toast. The student has finished an exam, has no
              result, and their answers are still in memory — so the runner
              stays on screen with the answers intact and offers to send them
              again. A message that fades after four seconds would leave them
              with a dead clock and no idea what happened.
            */}
            {submitError && (
              <div className="flex items-center gap-3 rounded-panel border border-primary/40 bg-primary-tint p-3">
                <Icon name="AlertCircle" className="shrink-0 text-primary" />
                <p className="flex-1 font-copy text-body text-primary">{submitError}</p>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submit()}
                  className="shrink-0 rounded-control border border-border bg-surface px-3 py-1 text-secondary text-ink hover:bg-hover disabled:opacity-50"
                >
                  إعادة الإرسال
                </button>
              </div>
            )}
          </div>
        </Panel>
      )}

      {result && exam && <Result result={result} exam={exam} onFinish={onFinish} />}

      {confirming && (
        <ConfirmDialog
          title="تسليم الاختبار"
          message="لا يمكن تعديل الإجابات بعد التسليم. هل تريد المتابعة؟"
          confirmLabel="إنهاء وتسليم"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            void submit();
          }}
        />
      )}
    </div>
  );
}

/** "٢٨:١٤" — mm:ss, Arabic-Indic, and never negative. */
function clock(seconds: number | null): string {
  const total = Math.max(0, seconds ?? 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return arabicDigits(`${pad(Math.floor(total / 60))}:${pad(total % 60)}`);
}

/**
 * The answer control for one question.
 *
 * Each type takes a different answer shape and the grader reads specific keys
 * out of it, so the control and the payload are built together rather than left
 * for one generic template to guess at.
 */
function Answers({
  question,
  chosen,
  onAnswer,
}: {
  question: ExamQuestion;
  chosen: ExamAnswer | null;
  onAnswer: (answer: ExamAnswer) => void;
}) {
  switch (question.question_type) {
    case QuestionTypes.MultipleChoice:
      return (
        <div className="flex flex-col gap-2">
          {[...question.options]
            .sort((a, b) => a.display_order - b.display_order)
            .map((option) => (
              <Choice
                key={option.id}
                label={option.text}
                selected={chosen?.answer.option_id === option.id}
                onSelect={() => onAnswer(examAnswers.multipleChoice(question.id, option.id))}
              />
            ))}
        </div>
      );

    case QuestionTypes.TrueFalse:
      return (
        <div className="flex flex-col gap-2">
          <Choice
            label="صواب"
            selected={chosen?.answer.value === true}
            onSelect={() => onAnswer(examAnswers.trueFalse(question.id, true))}
          />
          <Choice
            label="خطأ"
            selected={chosen?.answer.value === false}
            onSelect={() => onAnswer(examAnswers.trueFalse(question.id, false))}
          />
        </div>
      );

    case QuestionTypes.FillBlank:
      return (
        <input
          type="text"
          placeholder="اكتب إجابتك"
          value={typeof chosen?.answer.text === "string" ? chosen.answer.text : ""}
          onChange={(event) => onAnswer(examAnswers.fillBlank(question.id, event.target.value))}
          className="h-8 rounded-control border border-border bg-surface px-3 text-body text-ink outline-none focus:border-accent"
        />
      );

    case QuestionTypes.Matching:
      // Matching needs a pairing control the design does not specify for
      // desktop. Stated plainly rather than rendered as a broken guess — see
      // BLOCKERS.md.
      return (
        <p className="text-secondary text-ink-muted">
          أسئلة المطابقة غير مدعومة في هذه النسخة بعد.
        </p>
      );

    default:
      return (
        <p className="text-secondary text-ink-muted">
          نوع سؤال غير معروف — لا يمكن الإجابة عليه في هذه النسخة.
        </p>
      );
  }
}

function Choice({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "flex h-11 items-center rounded-control border px-3 text-start text-body transition-colors",
        selected ? "border-accent bg-accent-tint text-ink" : "border-border text-ink hover:bg-hover",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function Result({
  result,
  exam,
  onFinish,
}: {
  result: ExamAttemptDetail;
  exam: ExamDetail;
  onFinish: () => void;
}) {
  const passed = result.is_passed;

  return (
    <Panel className="flex flex-col items-center gap-4 p-8">
      <span
        className={`grid h-16 w-16 place-items-center rounded-full ${
          passed ? "bg-success-tint text-success" : "bg-primary-tint text-primary"
        }`}
      >
        <Icon name="Results" size={28} />
      </span>

      <span
        className={`font-ui text-title font-extrabold ${passed ? "text-success" : "text-primary"}`}
      >
        {passed ? "ناجح" : "راسب"}
      </span>

      <span className="text-secondary text-ink-secondary">{exam.title}</span>

      <span className="font-ui text-title font-extrabold text-ink">
        {arabicDigits(mark(result.score))} / {arabicDigits(mark(result.total_marks || exam.total_marks))}
      </span>

      <span className="block h-1 w-full max-w-[360px] overflow-hidden rounded-full bg-hover">
        <span
          className={`block h-full rounded-full ${passed ? "bg-success" : "bg-primary"}`}
          style={{ width: `${Math.max(0, Math.min(100, result.percentage))}%` }}
        />
      </span>

      <span className="text-label text-ink-muted">{percentLabel(result.percentage)}</span>

      <button
        type="button"
        onClick={onFinish}
        className="rounded-control bg-primary px-5 py-[6px] text-body font-bold text-white hover:bg-primary-hover"
      >
        العودة إلى الاختبارات
      </button>
    </Panel>
  );
}
