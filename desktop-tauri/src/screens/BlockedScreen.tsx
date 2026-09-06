import { useEffect, useState } from "react";

import { administrationPhone } from "../api/siteContact";
import { BoundDeviceInfo } from "../auth/authService";
import { copyToClipboard } from "../platform/external";
import { Icon } from "../ui/Icon";
import { IconName } from "../ui/icons";
import { Panel } from "../ui/primitives";
import { formatDate } from "../ui/text";

/**
 * The two blocked screens.
 *
 * They are DELIBERATELY DIFFERENT SCREENS. One tells the student their own
 * account lives on another device; the other tells them this computer belongs
 * to somebody else — the shared family or lab PC, which is the common case.
 * Showing the wrong one sends them to the school with the wrong question.
 *
 * They differ in wording and in what the detail card can show, not in
 * structure, so one component draws both.
 */

export type BlockedKind = "account-bound-elsewhere" | "device-bound-to-another-student";

interface Props {
  kind: BlockedKind;
  /** This computer's identifier. Always shown, always copyable. */
  deviceId: string;
  /**
   * The device this account is bound to, when the probe revealed it. Absent for
   * the other kind ON PURPOSE: the server refuses before revealing anything
   * about the other student, and the client must not go looking. The design's
   * mock shows their initials and name, but no student-facing endpoint exposes
   * another student's identity, and adding one to decorate an error screen
   * would leak enrolment across families.
   */
  boundDevice?: BoundDeviceInfo | null;
  onBackToLogin: () => void;
}

const Copy = {
  "account-bound-elsewhere": {
    icon: "Lock" as IconName,
    title: "هذا الحساب مرتبط بجهاز آخر",
    body: "لا يمكن الدخول من هذا الحاسوب. لفك الارتباط بالجهاز السابق يرجى التواصل مع إدارة المدرسة.",
  },
  "device-bound-to-another-student": {
    icon: "Monitor" as IconName,
    title: "هذا الجهاز مرتبط بحساب طالب آخر",
    body: "لا يمكن تسجيل الدخول بحسابك من هذا الحاسوب لأنه مرتبط بحساب طالب آخر. لفك الارتباط يرجى التواصل مع إدارة المدرسة.",
  },
} as const;

export function BlockedScreen({ kind, deviceId, boundDevice, onBackToLogin }: Props) {
  const copy = Copy[kind];

  const [phone, setPhone] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    // /public/site-data/ is AllowAny, which is why this works at all: there is
    // no session on this screen.
    let live = true;
    administrationPhone().then((value) => live && setPhone(value));
    return () => {
      live = false;
    };
  }, []);

  const boundType = boundDevice?.deviceType?.trim();

  async function copy_(value: string, message: string) {
    setNote((await copyToClipboard(value)) ? message : "تعذّر النسخ إلى الحافظة");
  }

  return (
    <div className="grid h-full place-items-center overflow-auto p-6">
      <div className="flex w-full max-w-[520px] flex-col items-center gap-4 py-8">
        {/* A padlock for "your account is bound elsewhere" — the account is
            locked. A monitor for "this machine is bound to someone else" — the
            machine is. */}
        <span className="grid h-16 w-16 place-items-center rounded-full bg-primary-tint text-primary">
          <Icon name={copy.icon} size={28} />
        </span>

        <h1 className="text-center font-ui text-title font-extrabold text-ink">{copy.title}</h1>

        <p className="max-w-[480px] text-center font-copy text-body text-ink-secondary">
          {copy.body}
        </p>

        <Panel className="mt-2 flex w-full flex-col gap-3 p-card">
          {boundType && (
            <>
              <Line label="الجهاز المرتبط حالياً" value={boundType} ltr />
              {boundDevice?.boundAt && (
                <Line label="تاريخ الربط" value={formatDate(boundDevice.boundAt)} />
              )}
              <span className="h-px bg-border" aria-hidden="true" />
            </>
          )}

          {/* The identifier, always shown and always copyable. This is the
              screen where the student needs it and cannot reach the rest of the
              app; nobody dictates a sixteen-character hex string accurately
              over a phone. */}
          <div className="flex flex-col gap-[6px]">
            <Line label="معرّف هذا الحاسوب" value={deviceId || "—"} ltr mono />

            <button
              type="button"
              disabled={!deviceId}
              onClick={() => void copy_(deviceId, "تم نسخ معرّف الجهاز إلى الحافظة.")}
              className="self-start rounded-control border border-border px-3 py-1 text-secondary text-ink hover:bg-hover disabled:opacity-50"
            >
              نسخ المعرّف
            </button>
          </div>
        </Panel>

        <div className="mt-2 flex items-center gap-2">
          {/*
            Copies the number rather than dialling it. A desktop has no dialler,
            and a tel: link that silently does nothing is worse than a copy that
            works.

            The action carries the number once we have it and reads as a plain
            instruction until then. NEVER a placeholder: a wrong number on this
            screen is worse than no number.
          */}
          <button
            type="button"
            disabled={!phone}
            onClick={() => void copy_(phone!, "تم نسخ رقم الإدارة إلى الحافظة.")}
            className="rounded-control bg-primary px-4 py-[6px] text-body font-bold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {phone ? `التواصل مع الإدارة · ${phone}` : "التواصل مع الإدارة"}
          </button>

          <button
            type="button"
            onClick={onBackToLogin}
            className="rounded-control border border-border px-4 py-[6px] text-body text-ink hover:bg-hover"
          >
            تسجيل الدخول بحساب آخر
          </button>
        </div>

        {note && <p className="text-label text-success">{note}</p>}
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  ltr = false,
  mono = false,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-secondary text-ink-secondary">{label}</span>
      <span
        className={`min-w-0 truncate text-secondary text-ink ${ltr ? "ltr" : ""} ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
