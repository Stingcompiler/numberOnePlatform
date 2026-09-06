import { useEffect, useState } from "react";

import { harnessCredentials, harnessLog, reportRendered } from "./harness";
import {
  auth,
  DeviceIdentity,
  LoginOutcome,
  PendingBind,
  SessionRestore,
} from "./auth/authService";

/**
 * STILL A HARNESS, not the sign-in screen.
 *
 * The real one is batch 4. This stays because batch 2 is verified through it:
 * WebView2 hides its DOM from UI Automation, so the flow cannot be driven by
 * clicking from outside, and without the self-test below "authentication
 * works" would be a claim rather than a measurement.
 *
 * It is styled with the real tokens so the shell it hands over to does not
 * look like a different application, but nothing here is the design.
 */

interface Props {
  device: DeviceIdentity | null;
  restore: SessionRestore;
  onSignedIn: (route?: string) => void;
}

export function SignInHarness({ device, restore, onSignedIn }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<LoginOutcome | null>(null);
  const [pending, setPending] = useState<PendingBind | null>(null);

  useEffect(() => {
    void selfTest();
    // Runs once, on the screen that owns the flow being tested.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Runs the flow end to end when credentials are in the environment. */
  async function selfTest() {
    const creds = await harnessCredentials();
    if (!creds) return;

    await harnessLog(`restore=${restore}`);

    const result = await auth.signIn(creds.username, creds.password);
    await harnessLog(
      `signIn=${result.kind}` + ("reason" in result ? ` reason=${result.reason}` : ""),
    );

    if (result.kind === "success") {
      await harnessLog(`user=${result.user.username}`);
      onSignedIn(creds.route ?? undefined);
      reportRendered();
    } else if (result.kind === "failed") {
      await harnessLog(`message=${result.message}`);
    }

    await harnessLog("done");
  }

  async function submit() {
    setBusy(true);
    try {
      const result = await auth.signIn(username, password);
      setOutcome(result);
      setPending(result.kind === "needs-device-binding" ? result.pending : null);
      if (result.kind === "success") onSignedIn();
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      const result = await auth.confirmBind(pending);
      setOutcome(result);
      if (result.kind === "success") onSignedIn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid h-full place-items-center p-8">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-panel border border-border bg-surface p-card">
        <header className="flex flex-col gap-1">
          <h1 className="font-ui text-title font-extrabold text-ink">مدارس ومعاهد نمبر ون</h1>
          <p className="text-secondary text-ink-muted">أداة فحص — الشاشة الحقيقية في الدفعة ٤</p>
        </header>

        <input
          className="rounded-control border border-border bg-surface px-3 py-2 text-body text-ink outline-none"
          placeholder="اسم المستخدم"
          dir="ltr"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="rounded-control border border-border bg-surface px-3 py-2 text-body text-ink outline-none"
          placeholder="كلمة المرور"
          type="password"
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="flex-1 rounded-control bg-accent px-4 py-2 text-body font-bold text-white disabled:opacity-50"
          >
            دخول
          </button>
          {pending && (
            <button
              type="button"
              disabled={busy}
              onClick={confirm}
              className="flex-1 rounded-control border border-border px-4 py-2 text-body font-bold text-ink"
            >
              تأكيد ربط الجهاز
            </button>
          )}
        </div>

        {outcome?.kind === "failed" && (
          <p className="text-body text-warning">{outcome.message}</p>
        )}

        {device && (
          <p className="ltr border-t border-border pt-3 text-label text-ink-muted">
            {device.device_type} · {device.id}
          </p>
        )}
      </div>
    </div>
  );
}
