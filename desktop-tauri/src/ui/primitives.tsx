import { ReactNode } from "react";

import { Icon } from "./Icon";
import { Section } from "./useSection";

/**
 * The pieces every screen is built from, so a table on one screen and a table
 * on another are the same object rather than two that look similar.
 */

/** A bordered card. The panel carries the edge so its contents need none. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-panel border border-border bg-surface ${className}`}>{children}</div>
  );
}

/**
 * A heading with a rule that starts where the title ends.
 *
 * The design never underlines a heading edge to edge: the rule begins after the
 * words and runs to the trailing edge, with any action after it.
 */
export function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="shrink-0 font-ui text-heading font-bold text-ink">{title}</h2>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
      {action}
    </div>
  );
}

/**
 * Renders whichever of a section's four states applies.
 *
 * Every state is reachable and none of them is blank. A section that fails
 * shows what went wrong AND a way to try again; a section with nothing in it
 * says so in words rather than leaving an empty rectangle that reads as a
 * screen still loading.
 */
export function SectionView<T>({
  section,
  empty,
  children,
  skeleton,
}: {
  section: Section<T>;
  empty: string;
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
}) {
  if (section.status === "loading") {
    return <>{skeleton ?? <Skeleton rows={3} />}</>;
  }

  if (section.status === "error") {
    return (
      <div className="flex flex-col items-start gap-3 p-card">
        <p className="flex items-center gap-2 text-body text-ink">
          <Icon name="AlertCircle" className="text-warning" />
          {section.error}
        </p>
        <button
          type="button"
          onClick={section.reload}
          className="flex items-center gap-2 rounded-control border border-border px-3 py-[6px] text-body text-ink hover:bg-hover"
        >
          <Icon name="Refresh" size={14} />
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (section.status === "empty") {
    return <p className="p-card text-body text-ink-muted">{empty}</p>;
  }

  return <>{section.data !== null && children(section.data)}</>;
}

/** Grey bars the width of the content that will replace them. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 p-card" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <span
          key={i}
          className="h-4 animate-pulse rounded bg-hover"
          style={{ width: `${[100, 82, 64][i % 3]}%` }}
        />
      ))}
    </div>
  );
}

/** A progress bar. Amber has meaning elsewhere in the app, so this is the accent. */
export function ProgressBar({ fraction }: { fraction: number }) {
  const clamped = Math.max(0, Math.min(1, fraction));

  return (
    <span className="block h-1 w-full overflow-hidden rounded-full bg-hover">
      <span
        className="block h-full rounded-full bg-accent transition-[width]"
        style={{ width: `${clamped * 100}%` }}
      />
    </span>
  );
}

/** A bordered label for a category — a thing the student did not type. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[4px] border border-border px-[6px] py-[1px] text-label text-ink-secondary">
      {children}
    </span>
  );
}

/**
 * A table that scrolls in its own container.
 *
 * Wide content never makes the page scroll sideways: the header and the rows
 * move together inside this box and the rest of the screen stays put.
 */
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr>
            {head.map((label) => (
              <th
                key={label}
                className="border-b border-border px-4 py-[10px] text-start text-label font-bold text-ink-muted"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={[
        "border-b border-border/60 last:border-b-0",
        onClick ? "cursor-pointer hover:bg-hover" : "",
      ].join(" ")}
    >
      {children}
    </tr>
  );
}

export function Cell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle text-body text-ink ${className}`}>{children}</td>;
}

/**
 * A filter tab. Selected carries the accent on all three of border, tint and
 * ink — one of the three alone reads as a hover state rather than a choice.
 */
export function Tab({
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
          ? "border-accent bg-accent-tint text-accent"
          : "border-border text-ink-secondary hover:bg-hover",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

/**
 * A failure inside a card, with the retry for that card only.
 *
 * Never a toast: a message that fades leaves a student looking at an empty
 * table with nothing to press.
 */
export function StatePanel({
  message,
  actionLabel = "إعادة المحاولة",
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 p-card">
      <p className="flex items-center gap-2 text-center text-body text-ink">
        <Icon name="AlertCircle" className="shrink-0 text-warning" />
        {message}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="flex items-center gap-2 rounded-control border border-border px-3 py-[6px] text-body text-ink hover:bg-hover"
      >
        <Icon name="Refresh" size={14} />
        {actionLabel}
      </button>
    </div>
  );
}

/** A label, a figure, and the caption that says what the figure is over. */
export function Stat({
  label,
  value,
  caption,
  captionClass = "text-ink-muted",
}: {
  label: string;
  value: string;
  caption?: string;
  captionClass?: string;
}) {
  return (
    <Panel className="flex flex-col gap-1 p-card">
      <span className="text-label text-ink-muted">{label}</span>
      <span className="truncate font-ui text-title font-extrabold text-ink">{value}</span>
      <span className={`truncate text-label ${captionClass}`}>{caption ?? " "}</span>
    </Panel>
  );
}

/**
 * ناجح / راسب, as a dot and a word.
 *
 * Both, not colour alone: a red word and a green word are the same word to a
 * student who cannot tell them apart.
 */
export function Verdict({ passed }: { passed: boolean }) {
  return (
    <span className={`flex items-center gap-[6px] ${passed ? "text-success" : "text-primary"}`}>
      <span aria-hidden="true" className="h-[6px] w-[6px] shrink-0 rounded-full bg-current" />
      <span className="text-secondary">{passed ? "ناجح" : "راسب"}</span>
    </span>
  );
}

/**
 * A modal confirm.
 *
 * MAUI routes irreversible actions through DisplayAlert, which on Windows is a
 * ContentDialog inside the window rather than an OS message box — so this is
 * the same thing, not a substitute for it. Escape and the backdrop both cancel;
 * only the explicit control confirms.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "إلغاء",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-3 rounded-panel border border-border bg-surface p-card shadow-lg"
      >
        <h2 className="font-ui text-heading font-bold text-ink">{title}</h2>
        <p className="font-copy text-body text-ink-secondary">{message}</p>

        <div className="mt-1 flex justify-start gap-2">
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className="rounded-control bg-primary px-4 py-[6px] text-body font-bold text-white hover:bg-primary-hover"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-control border border-border px-4 py-[6px] text-body text-ink hover:bg-hover"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
