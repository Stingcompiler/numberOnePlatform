import { ReactNode } from "react";

import { systemTypeLabel } from "../api/models";
import { auth } from "../auth/authService";
import { copyToClipboard } from "../platform/external";
import { Icon } from "../ui/Icon";
import { Chip, Panel } from "../ui/primitives";
import { useToast } from "../ui/Toast";
import { arabicDigits, formatDate, orDash } from "../ui/text";

/**
 * حسابي — read-only, in two columns: the record on the leading side, the device
 * and the money on the trailing one.
 *
 * TWO THINGS ARE DELIBERATELY ABSENT AND MUST STAY ABSENT.
 *
 * There is NO password control. Students never change their own password; it is
 * issued and reset by the administration, and the server refuses the request
 * outright (IsStudentReadOnly on /auth/change-password/). A field here would
 * fail every time it was used.
 *
 * There is NO unbind control. Clearing a device binding goes through the
 * administration; this screen explains that and shows the identifier so a
 * student can quote it accurately over the phone.
 *
 * It is a RECORD, NOT A FORM. Each value used to sit in a bordered box with its
 * label above it, and the page read as something to fill in — while nothing on
 * it is editable and there is not an input on the screen. The card carries the
 * edge instead, with hairlines between rows.
 */

/** Where المشرفة has no value the profile shows this, not a dash. */
const NoSupervisor = "توزيع إداري تلقائي";

export function ProfileScreen() {
  const toast = useToast();

  const user = auth.currentUser;
  const profile = user?.student_profile ?? null;

  const deviceId = profile?.device_id ?? "";
  const balance = profile?.balance ?? "0.00";

  /**
   * True when there is something left to pay.
   *
   * The figure used to be painted amber whatever it said, so a student who owed
   * nothing was shown the same warning as one who owed a term's fees. A settled
   * account should read as settled.
   */
  const outstanding = Number.parseFloat(balance) > 0;

  /**
   * The identifier must be copyable here as well as on both blocked screens: a
   * student phoning the school to be unbound has to convey a string nobody can
   * dictate accurately.
   */
  async function copyDeviceId() {
    if (!deviceId) return;

    if (await copyToClipboard(deviceId)) toast("تم نسخ معرّف الجهاز إلى الحافظة.");
    else toast("تعذّر النسخ إلى الحافظة", "error");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* ══ البيانات الشخصية ═══════════════════════════════════════════ */}
      <section className="flex flex-col gap-3 self-start">
        <Heading title="البيانات الشخصية" />

        <Panel className="flex flex-col gap-[14px] p-card">
          <Pair>
            <Field label="اسم الطالب" value={orDash(user?.full_name)} />
            <Field label="اسم المستخدم" value={orDash(user?.username)} ltr />
          </Pair>
          <Rule />
          <Pair>
            <Field label="رقم الهاتف" value={orDash(user?.phone)} ltr />
            <Field label="هاتف ولي الأمر" value={orDash(profile?.guardian_phone)} ltr />
          </Pair>
          <Rule />
          <Pair>
            <Field label="اسم ولي الأمر" value={orDash(profile?.guardian_name)} />
            <Field label="السكن" value={orDash(profile?.address)} />
          </Pair>
          <Rule />
          <Pair>
            <Field label="المشرفة" value={profile?.supervisor_name?.trim() || NoSupervisor} />

            {/* نوع النظام is a category rather than something a student typed,
                so it takes a chip. Mapped from the raw value, never from
                system_type_display — the mobile app maps from the raw value
                too, and a student on both clients must not meet two words for
                one enrolment. */}
            <span className="flex flex-col items-start gap-1">
              <span className="text-label text-ink-muted">نوع النظام</span>
              <Chip>{systemTypeLabel(profile?.system_type)}</Chip>
            </span>
          </Pair>
        </Panel>
      </section>

      {/* ══ الجهاز والملف المالي ═══════════════════════════════════════ */}
      <div className="flex flex-col gap-6 self-start">
        <section className="flex flex-col gap-3">
          <Heading title="الجهاز المرتبط" />

          <Panel className="flex flex-col gap-3 p-card">
            <div className="grid grid-cols-3 gap-3">
              <Field label="النوع" value={orDash(profile?.device_type)} ltr />

              <span className="flex min-w-0 flex-col gap-[2px]">
                <span className="text-label text-ink-muted">المعرّف</span>
                <span className="flex items-center gap-[6px]">
                  {/* Monospace and LTR. A device id read right-to-left is one
                      the student cannot dictate over a phone. */}
                  <span className="ltr truncate font-mono text-secondary text-ink">
                    {deviceId || "—"}
                  </span>
                  {deviceId && (
                    <button
                      type="button"
                      onClick={() => void copyDeviceId()}
                      aria-label="نسخ المعرّف"
                      title="نسخ المعرّف"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-[4px] text-ink-muted hover:bg-hover"
                    >
                      <Icon name="Copy" size={13} />
                    </button>
                  )}
                </span>
              </span>

              <Field
                label="تاريخ الربط"
                value={profile?.device_bound_at ? formatDate(profile.device_bound_at) : "—"}
                ltr
              />
            </div>

            <Rule />

            <p className="font-copy text-body text-ink-secondary">
              حسابك مرتبط بهذا الجهاز فقط. لاستخدام جهاز آخر يجب مراجعة الإدارة لفك الارتباط.
            </p>
          </Panel>
        </section>

        <section className="flex flex-col gap-3">
          <Heading title="الملف المالي" />

          {/*
            One line, not the design's three.

            The design shows إجمالي المطلوب and إجمالي المدفوع above المتبقي.
            Neither is reachable by a student: finance's
            StudentFinancialFileView is IsAdminOrManager, and the only figure
            that rides along on /auth/me/ is the balance. The two rows are
            omitted rather than filled with a guess.
          */}
          <Panel className="flex flex-col gap-[2px] p-card">
            <span className="text-label text-ink-muted">المتبقي</span>
            <span
              className={`font-ui text-title font-extrabold ${
                outstanding ? "text-warning" : "text-ink"
              }`}
            >
              {/* Sudanese pounds, not the design mock's د.ع — finance/models.py
                  names the field balance_sdg. */}
              {arabicDigits(balance)} ج.س
            </span>
            <span className="text-label text-ink-muted">
              {outstanding ? "مستحق على حسابك" : "لا توجد مستحقات على حسابك"}
            </span>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function Heading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="shrink-0 font-ui text-heading font-bold text-ink">{title}</h2>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}

function Pair({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

function Rule() {
  return <span className="h-px bg-border" aria-hidden="true" />;
}

function Field({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <span className="flex min-w-0 flex-col gap-[2px]">
      <span className="text-label text-ink-muted">{label}</span>
      <span className={`truncate font-ui text-body font-bold text-ink ${ltr ? "ltr" : ""}`}>
        {value}
      </span>
    </span>
  );
}
