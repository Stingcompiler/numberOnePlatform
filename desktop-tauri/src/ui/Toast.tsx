import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";

import { Icon } from "./Icon";

/**
 * Brief confirmations, from anywhere.
 *
 * A toast is for something that WORKED and needs no decision — "the id is on
 * the clipboard", "opening Zoom". Anything a student has to act on gets a panel
 * that stays: the exam runner's failed submit is the case that proves it, and
 * it deliberately does not use this.
 */

export type ToastKind = "info" | "warning" | "error";

interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

const Ctx = createContext<(text: string, kind?: ToastKind) => void>(() => undefined);

/** Raises a toast. Safe to call from a screen with nowhere of its own to put one. */
export function useToast() {
  return useContext(Ctx);
}

export function ToastHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((text: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, text, kind }]);
    window.setTimeout(() => setToasts((c) => c.filter((t) => t.id !== id)), 4000);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <Ctx.Provider value={value}>
      {children}

      {/* Bottom centre, above everything, and never in the way of a control:
          the pointer passes straight through the stack. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex flex-col items-center gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={[
              "flex max-w-md items-center gap-2 rounded-panel border px-4 py-2 text-body shadow-lg",
              toast.kind === "error"
                ? "border-primary/40 bg-primary-tint text-primary"
                : toast.kind === "warning"
                  ? "border-warning/40 bg-warning-tint text-warning"
                  : "border-border bg-surface text-ink",
            ].join(" ")}
          >
            {toast.kind !== "info" && <Icon name="AlertCircle" size={14} className="shrink-0" />}
            {toast.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
