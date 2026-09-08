import { useCallback, useEffect, useState } from "react";

import { ApiError, Messages, NetworkError } from "../api/client";

/**
 * One region of a screen, with its own loading, empty and error state.
 *
 * Screens are built from independent sections rather than loaded as a whole:
 * the dashboard alone pulls courses, progress, exams and notifications, and one
 * slow or broken endpoint must not blank the other three. Each renders as it
 * lands, and each carries its own retry.
 *
 * The state a section must NEVER end in is "still loading with no way out".
 * That is why every failure path below sets an error rather than returning
 * silently — a spinner that never resolves gives a student nothing to do.
 */

export type SectionStatus = "loading" | "data" | "empty" | "error";

export interface Section<T> {
  status: SectionStatus;
  data: T | null;
  error: string | null;
  reload: () => void;
}

export function useSection<T>(
  load: (signal: AbortSignal) => Promise<T>,
  isEmpty: (value: T) => boolean,
  deps: unknown[] = [],
): Section<T> {
  const [status, setStatus] = useState<SectionStatus>("loading");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;

    setStatus("loading");
    setError(null);

    load(controller.signal)
      .then((value) => {
        if (!live) return;
        setData(value);
        setStatus(isEmpty(value) ? "empty" : "data");
      })
      .catch((cause: unknown) => {
        // Navigating away mid-flight must not paint an error on a screen the
        // student has already left.
        if (!live || controller.signal.aborted) return;

        setError(describe(cause));
        setStatus("error");
      });

    return () => {
      live = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, ...deps]);

  return { status, data, error, reload };
}

/**
 * The message a student sees.
 *
 * A connection problem and a defect get different words on purpose: retrying
 * the first is the right thing to do, and retrying the second is not.
 */
function describe(cause: unknown): string {
  if (cause instanceof NetworkError) return Messages.noConnection;
  if (cause instanceof ApiError) return cause.message;
  return Messages.sectionFailed;
}
