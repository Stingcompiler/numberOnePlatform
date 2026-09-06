import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * Batch 1 only: proof the window runs and that content protection actually
 * took, not that it was merely requested.
 *
 * This screen is scaffolding and goes away in batch 3 when the real shell and
 * navigation arrive. It exists because "the window works" is not a claim worth
 * making without something on screen that says so.
 */

type Protection = {
  requested: boolean;
  /** Read back from the OS, not assumed from the call returning Ok. */
  verified: boolean;
  detail: string;
};

export default function App() {
  const [protection, setProtection] = useState<Protection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<Protection>("protection_status")
      .then(setProtection)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-ui text-title font-extrabold text-ink">مدارس ومعاهد نمبر ون</h1>
      <p className="text-secondary text-ink-muted">نسخة Tauri — الدفعة ١</p>

      <div className="w-full max-w-md rounded-panel border border-border bg-surface p-card">
        <h2 className="mb-3 font-ui text-heading font-bold text-ink">حماية المحتوى</h2>

        {error && <p className="text-body text-warning">تعذّر الاستعلام: {error}</p>}
        {!protection && !error && <p className="text-body text-ink-muted">جارٍ الفحص…</p>}

        {protection && (
          <dl className="flex flex-col gap-2 text-body">
            <Row label="طُلبت" value={protection.requested} />
            <Row label="مؤكَّدة من النظام" value={protection.verified} />
            <p className="ltr mt-1 text-secondary text-ink-muted">{protection.detail}</p>
          </dl>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className={value ? "font-bold text-success" : "font-bold text-warning"}>
        {value ? "نعم" : "لا"}
      </dd>
    </div>
  );
}
