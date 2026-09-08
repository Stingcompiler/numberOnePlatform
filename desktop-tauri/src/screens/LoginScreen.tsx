import { FormEvent, useEffect, useState } from "react";

import {
  BoundDeviceInfo,
  DeviceIdentity,
  LoginOutcome,
  PendingBind,
  SessionRestore,
  auth,
} from "../auth/authService";
import { BlockedKind } from "./BlockedScreen";
import logo from "../assets/logo.jpg";
import { Icon } from "../ui/Icon";

/**
 * تسجيل الدخول, the device-binding confirmation, and the hand-off to the two
 * blocked screens.
 *
 * ONE SCREEN because they are one flow: the design draws the bind dialog over a
 * dimmed login, and both blocked states are reachable only from a sign-in
 * attempt.
 *
 * THERE IS NO "FORGOT PASSWORD" AND NO PASSWORD FIELD BEYOND THIS ONE. Students
 * never change their own password — it is issued and reset by the
 * administration, and /auth/change-password/ refuses a student outright. A
 * control here would fail every time it was used.
 */

const Text = {
  brandShort: "نمبر ون",
  brandName: "مدارس ومعاهد نمبر ون",
  tagline:
    "منصة الطالب على سطح المكتب — محاضراتك وتمارينك واختباراتك ونتائجك في مكان واحد.",
  bullets: [
    "محاضرات بجودة عالية دون انقطاع",
    "تمارين واختبارات مع نتائج فورية",
    "متابعة تقدّمك ورصيدك المالي أولاً بأول",
  ],

  title: "تسجيل الدخول",
  subtitle: "منصة الطالب — نسخة سطح المكتب",
  username: "اسم المستخدم",
  password: "كلمة المرور",
  showPassword: "إظهار كلمة المرور",
  signIn: "دخول",
  signingIn: "جارٍ الدخول…",

  devicePrefix: "هذا الجهاز: ",
  deviceSuffix: " · سيتم ربط حسابك به عند أول دخول",

  bindTitle: "تأكيد ربط الجهاز",
  bindBody:
    "سيتم ربط حسابك بهذا الحاسوب بشكل دائم. لن تتمكن من استخدام تطبيق الهاتف أو حاسوب آخر بعد ذلك إلا بمراجعة إدارة المدرسة لفك الارتباط.",
  bindCurrentDevice: "الجهاز الحالي",
  bindConfirm: "متابعة وربط الجهاز",
  bindCancel: "إلغاء",
  bindFootnote: "إجراء نهائي · Esc للإلغاء",

  deviceUnavailable:
    "تعذّر التعرّف على هذا الجهاز، ولا يمكن تسجيل الدخول بدونه. يرجى التواصل مع إدارة المدرسة.",
} as const;

interface Props {
  device: DeviceIdentity | null;
  /** A stored session is still being checked; the card waits rather than flashing. */
  restore: SessionRestore | null;
  onSignedIn: () => void;
  onBlocked: (blocked: {
    kind: BlockedKind;
    boundDevice: BoundDeviceInfo | null;
  }) => void;
}

export function LoginScreen({ device, restore, onSignedIn, onBlocked }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Held between the probe and the confirmation. Non-null exactly while the
   * dialog is up; NOTHING IS PERSISTED until the confirming call succeeds.
   */
  const [pending, setPending] = useState<PendingBind | null>(null);

  /**
   * The form is hidden while a stored session is being checked. A student who
   * never signed out is about to land in the app, and showing them a sign-in
   * card for the half second it takes reads as having been logged out — the
   * exact impression the restore exists to remove.
   */
  const restoring = restore === null;

  // Esc cancels the bind. The verified-but-unbound session's tokens were never
  // stored, so dropping the reference is the whole undo; the unused pair simply
  // expires server-side.
  useEffect(() => {
    if (!pending) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelBind();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function cancelBind() {
    setPending(null);
    setPassword("");
  }

  function handle(outcome: LoginOutcome) {
    switch (outcome.kind) {
      case "success":
        setPassword("");
        onSignedIn();
        return;

      case "needs-device-binding":
        setPending(outcome.pending);
        return;

      case "failed":
        if (
          outcome.reason === "account-bound-elsewhere" ||
          outcome.reason === "device-bound-to-another-student"
        ) {
          setPassword("");
          onBlocked({
            kind: outcome.reason,
            boundDevice: outcome.boundDevice ?? null,
          });
          return;
        }

        // Bad credentials, a suspended account, network, or something
        // unrecognised: all stay on the form with the server's own text.
        //
        // A SUSPENDED ACCOUNT CURRENTLY ARRIVES AS BAD CREDENTIALS. Django's
        // ModelBackend rejects is_active=False inside authenticate(), so the
        // serializer never reaches its own "الحساب موقوف" branch and no client
        // can tell the two apart. Fixing that is a backend change.
        setError(outcome.message);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!device) {
      setError(Text.deviceUnavailable);
      return;
    }
    if (busy || !username.trim() || !password) return;

    setBusy(true);
    setError(null);
    try {
      handle(await auth.signIn(username.trim(), password));
    } finally {
      setBusy(false);
    }
  }

  /** The call that actually binds — the probe deliberately did not. */
  async function confirmBind() {
    if (!pending) return;

    setBusy(true);
    try {
      const outcome = await auth.confirmBind(pending);
      setPending(null); // whatever happened, the pending session is spent
      handle(outcome);
    } finally {
      setBusy(false);
    }
  }

  return (
    // The brand panel takes 42% on the RIGHT — the leading edge in an RTL
    // layout — and the form sits beside it.
    <div className="relative flex h-full">
      <aside
        className="hidden w-[42%] flex-col justify-center gap-4 border-e border-border bg-surface p-12 lg:flex"
        // The rule sits on the panel's INNER edge, between it and the
        // form. In RTL the panel is the rightmost element, so its
        // inline-START edge is the window frame — a border there is drawn
        // against the chrome and cannot be seen at all.
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-panel bg-primary font-ui text-heading font-bold text-white">
            ١
          </span>
          <span className="font-ui text-title font-bold text-ink">
            {Text.brandShort}
          </span>
        </div>

        <h1 className="font-ui text-heading font-bold text-ink">
          {Text.brandName}
        </h1>

        <p className="max-w-[360px] font-copy text-body leading-relaxed text-ink-secondary">
          {Text.tagline}
        </p>

        <ul className="mt-3 flex flex-col gap-[10px]">
          {Text.bullets.map((line) => (
            <li key={line} className="flex items-center gap-2">
              <Icon
                name="Check"
                size={15}
                strokeWidth={2}
                className="shrink-0 text-success"
              />
              <span className="text-secondary text-ink-secondary">{line}</span>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex flex-1 items-center justify-center overflow-auto p-6">
        <div className="flex w-full max-w-[420px] flex-col items-center gap-3">
          <img
            src={logo}
            alt=""
            className="h-24 w-24 shrink-0 rounded-full object-cover"
          />

          {restoring ? (
            <p className="py-6 text-body text-ink-muted">
              جارٍ التحقّق من جلستك…
            </p>
          ) : (
            <>
              <form
                onSubmit={submit}
                className="flex w-full flex-col gap-4 rounded-panel border border-border bg-surface p-6"
              >
                <div className="flex flex-col gap-1">
                  <h2 className="font-ui text-title font-bold text-ink">
                    {Text.title}
                  </h2>
                  <p className="text-secondary text-ink-muted">
                    {Text.subtitle}
                  </p>
                </div>

                <Field label={Text.username} icon="User">
                  <input
                    autoFocus
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setError(null);
                    }}
                    autoComplete="username"
                    // Usernames are Latin; typed into an RTL page they would
                    // otherwise be laid out from the right.
                    dir="ltr"
                    className="w-full bg-transparent text-body text-ink outline-none"
                  />
                </Field>

                <Field label={Text.password} icon="Lock">
                  <input
                    type={visible ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    autoComplete="current-password"
                    dir="ltr"
                    className="w-full bg-transparent text-body text-ink outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={Text.showPassword}
                    title={Text.showPassword}
                    aria-pressed={visible}
                    className="shrink-0 text-ink-muted hover:text-ink"
                  >
                    <Icon name="Eye" size={15} />
                  </button>
                </Field>

                {/* A tint fill with a 1px border and the message inside. Never
                    a filled red block. */}
                {error && (
                  <p className="flex items-start gap-2 rounded-control border border-primary/40 bg-primary-tint p-3 font-copy text-body text-primary">
                    <Icon
                      name="AlertCircle"
                      size={14}
                      className="mt-[2px] shrink-0"
                    />
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy || !username.trim() || !password}
                  className="h-10 rounded-control bg-primary text-body font-bold text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {busy ? Text.signingIn : Text.signIn}
                </button>
              </form>

              {/* Which machine this is, and what signing in here will bind.
                  Said BEFORE the binding, not after it. */}
              <p className="flex items-center gap-2 text-label text-ink-muted">
                <Icon name="Monitor" size={13} className="shrink-0" />
                {device
                  ? `${Text.devicePrefix}${device.device_type}${Text.deviceSuffix}`
                  : Text.deviceUnavailable}
              </p>
            </>
          )}
        </div>
      </div>

      {pending && (
        <BindConfirmation
          device={`${pending.deviceType} · ${pending.machineName}`}
          busy={busy}
          onConfirm={() => void confirmBind()}
          onCancel={cancelBind}
        />
      )}
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: "User" | "Lock";
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label text-ink-muted">{label}</span>
      <span className="flex h-10 items-center gap-2 rounded-control border border-border bg-surface px-3 focus-within:border-accent">
        <Icon name={icon} size={15} className="shrink-0 text-ink-muted" />
        {children}
      </span>
    </label>
  );
}

/**
 * The binding confirmation, over a dimmed login.
 *
 * The one irreversible thing a student can do in this app, so it says exactly
 * what is about to be bound before it happens rather than reporting it after.
 */
function BindConfirmation({
  device,
  busy,
  onConfirm,
  onCancel,
}: {
  device: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={Text.bindTitle}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6"
    >
      <div className="flex w-full max-w-[520px] flex-col gap-3 rounded-panel border border-border bg-surface p-card">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-warning-tint font-ui text-heading font-bold text-warning">
            !
          </span>
          <h2 className="font-ui text-heading font-bold text-ink">
            {Text.bindTitle}
          </h2>
        </div>

        <p className="font-copy text-body leading-relaxed text-ink-secondary">
          {Text.bindBody}
        </p>

        {/* What exactly is about to be bound. */}
        <div className="flex items-center justify-between gap-3 rounded-control border border-border bg-hover px-3 py-2">
          <span className="text-secondary text-ink-secondary">
            {Text.bindCurrentDevice}
          </span>
          <span className="ltr truncate font-mono text-secondary text-ink">
            {device}
          </span>
        </div>

        {/* The primary is visibly wider: confirming is the main action, and it
            is the irreversible one. */}
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="h-9 w-[200px] rounded-control bg-primary text-body font-bold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {busy ? Text.signingIn : Text.bindConfirm}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="h-9 w-24 rounded-control border border-border text-body text-ink hover:bg-hover disabled:opacity-50"
          >
            {Text.bindCancel}
          </button>
        </div>

        <p className="text-label text-ink-muted">{Text.bindFootnote}</p>
      </div>
    </div>
  );
}
