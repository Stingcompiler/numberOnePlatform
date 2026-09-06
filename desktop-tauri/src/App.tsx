import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { auth, DeviceIdentity, LoginOutcome, PendingBind, SessionRestore } from "./auth/authService";
import { onSessionExpired } from "./api/client";

/**
 * BATCH 2 HARNESS — not a screen.
 *
 * The real sign-in screen is batch 4. This exists so batch 2 can be verified
 * against the live server rather than described: it exercises the device
 * identity, the two-phase bind, session restore and sign-out, and shows what
 * each one actually returned.
 *
 * It goes away when the real screens arrive.
 */

type Protection = { requested: boolean; verified: boolean; detail: string };

export default function App() {
  const [protection, setProtection] = useState<Protection | null>(null);
  const [device, setDevice] = useState<DeviceIdentity | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [restore, setRestore] = useState<SessionRestore | "…">("…");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<LoginOutcome | null>(null);
  const [pending, setPending] = useState<PendingBind | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    invoke<Protection>("protection_status").then(setProtection).catch(() => undefined);
    invoke<DeviceIdentity>("device_identity").then(setDevice).catch((e) => setDeviceError(String(e)));
    const unsubscribe = onSessionExpired(() => setExpired(true));

    void (async () => {
      const restored = await auth.restoreSession().catch(() => "rejected" as SessionRestore);
      setRestore(restored);
      await selfTest(restored);
    })();

    return unsubscribe;
  }, []);

  /**
   * Runs the batch end to end when credentials are in the environment.
   *
   * WebView2 hides its DOM from UI Automation, so the harness cannot be
   * clicked from outside. Without this the flow could only be described, and a
   * described flow is one nobody has run.
   */
  async function selfTest(restored: SessionRestore) {
    const creds = await invoke<{ username: string; password: string } | null>(
      "harness_credentials",
    ).catch(() => null);

    if (!creds) return;

    const say = (line: string) => invoke("harness_log", { line }).catch(() => undefined);

    await say(`restore=${restored}`);
    await say(`user_after_restore=${auth.currentUser?.username ?? "-"}`);

    if (restored !== "restored") {
      const result = await auth.signIn(creds.username, creds.password);
      await say(`signIn=${result.kind}` + ("reason" in result ? ` reason=${result.reason}` : ""));
      if (result.kind === "failed") await say(`message=${result.message}`);
      if (result.kind === "success") await say(`user=${result.user.username}`);
      setOutcome(result);
    }

    const stored = await auth.currentUser;
    await say(`signedIn=${stored ? "yes" : "no"}`);
    await say("done");
  }

  async function run(action: () => Promise<LoginOutcome | void>) {
    setBusy(true);
    try {
      const result = await action();
      if (result) {
        setOutcome(result);
        setPending(result.kind === "needs-device-binding" ? result.pending : null);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <header>
        <h1 className="font-ui text-title font-extrabold">مدارس ومعاهد نمبر ون</h1>
        <p className="text-secondary text-ink-muted">أداة فحص الدفعة ٢ — ليست الشاشة النهائية</p>
      </header>

      <Panel title="حماية المحتوى">
        {protection ? (
          <Line label="مؤكَّدة من النظام" ok={protection.verified} note={protection.detail} />
        ) : (
          <p className="text-ink-muted">…</p>
        )}
      </Panel>

      <Panel title="هوية الجهاز">
        {deviceError && <p className="text-warning">{deviceError}</p>}
        {device && (
          <dl className="flex flex-col gap-1">
            <Field label="المعرّف" value={device.id} mono />
            <Field label="النوع" value={device.device_type} />
            <Field label="اسم الجهاز" value={device.machine_name} mono />
          </dl>
        )}
      </Panel>

      <Panel title="الجلسة">
        <Field label="الاستعادة عند الإقلاع" value={restore} />
        {expired && <p className="text-warning">انتهت الجلسة أثناء التشغيل</p>}
        {auth.currentUser && <Field label="المستخدم" value={String(auth.currentUser.username)} mono />}
      </Panel>

      <Panel title="تسجيل الدخول">
        <div className="flex flex-col gap-2">
          <input
            className="rounded-control border border-border bg-surface px-3 py-2 text-body"
            placeholder="اسم المستخدم"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            dir="ltr"
          />
          <input
            className="rounded-control border border-border bg-surface px-3 py-2 text-body"
            placeholder="كلمة المرور"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
          />
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => run(() => auth.signIn(username, password))}>
              دخول
            </Button>
            {pending && (
              <Button disabled={busy} onClick={() => run(() => auth.confirmBind(pending))}>
                تأكيد ربط الجهاز
              </Button>
            )}
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await auth.signOut();
                  setOutcome(null);
                })
              }
            >
              خروج
            </Button>
          </div>
        </div>

        {outcome && (
          <pre className="ltr mt-3 overflow-x-auto rounded-control bg-hover p-3 text-secondary">
            {JSON.stringify(outcome, (k, v) => (k === "password" ? "***" : v), 2)}
          </pre>
        )}
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-panel border border-border bg-surface p-card">
      <h2 className="mb-2 font-ui text-heading font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-secondary text-ink-muted">{label}</dt>
      <dd className={mono ? "ltr font-mono text-body" : "text-body"}>{value}</dd>
    </div>
  );
}

function Line({ label, ok, note }: { label: string; ok: boolean; note: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-ink-secondary">{label}</span>
        <span className={ok ? "font-bold text-success" : "font-bold text-warning"}>
          {ok ? "نعم" : "لا"}
        </span>
      </div>
      <p className="ltr text-secondary text-ink-muted">{note}</p>
    </div>
  );
}

function Button({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="rounded-control bg-accent px-4 py-2 text-body font-bold text-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}
