/**
 * انتهت صلاحية الجلسة.
 *
 * A refused REFRESH, not a dropped connection — the two are different states
 * and must stay so: an offline student still has a valid session, and the
 * offline bar is what says so. This fires only when the server has actually
 * rejected the refresh token, which means the tokens are already gone.
 *
 * It replaces a silent drop to the login form. A student mid-lecture whose
 * screen simply became a login page has no idea whether they were signed out,
 * whether the app broke, or whether their work was lost.
 */

/**
 * BOTH BUTTONS END THE SAME WAY, and the wording of the first is inherited from
 * MAUI rather than chosen here. The design has the primary control return the
 * student to the page they were on, but by the time this appears the tokens
 * have been cleared, so there is no session to resume with — signing in again
 * is the only thing either button can actually do.
 *
 * The body text still promises the return. It is carried over verbatim so the
 * two clients say the same thing to the same student; it is a promise neither
 * of them keeps, and closing that gap needs a re-auth flow that resumes the
 * route, which is a decision rather than a port.
 */
const Title = "انتهت صلاحية الجلسة";
const Body =
  "انتهت مدة جلستك لأسباب أمنية. سجّل الدخول مرة أخرى للمتابعة — سيعيدك التطبيق إلى نفس الصفحة التي كنت فيها.";
const Continue = "تسجيل الدخول والمتابعة";
const BackToLogin = "العودة لشاشة الدخول";

export function SessionExpired({ onDismiss }: { onDismiss: () => void }) {
  return (
    // No dismiss on the backdrop and none on Escape: there is nothing behind
    // this the student can still use, and a scrim they could click away would
    // leave them on a screen whose every request now fails.
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={Title}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6"
    >
      <div className="w-full max-w-[480px] overflow-hidden rounded-panel border border-border bg-surface">
        <div className="flex flex-col gap-2 p-card">
          <h2 className="font-ui text-heading font-bold text-ink">{Title}</h2>
          <p className="font-copy text-body leading-relaxed text-ink-secondary">{Body}</p>
        </div>

        <div className="h-px bg-border" aria-hidden="true" />

        <div className="flex gap-2 px-card py-3">
          <button
            type="button"
            autoFocus
            onClick={onDismiss}
            className="rounded-control bg-primary px-4 py-[6px] text-body font-bold text-white hover:bg-primary-hover"
          >
            {Continue}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-control border border-border px-4 py-[6px] text-body text-ink hover:bg-hover"
          >
            {BackToLogin}
          </button>
        </div>
      </div>
    </div>
  );
}
