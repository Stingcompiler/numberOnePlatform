import { useState } from "react";

import { copyToClipboard } from "../platform/external";
import { Icon } from "../ui/Icon";
import { Panel } from "../ui/primitives";

/**
 * The app refuses to run on a virtual machine.
 *
 * WHY, stated to the student rather than hidden: on a guest,
 * SetWindowDisplayAffinity succeeds and reads back 0x11 while the HOST records
 * the whole guest window. The app would print "recording is disabled" and be
 * wrong. A lecture must not play where the app cannot keep the promise it
 * prints.
 *
 * The evidence is shown, not just the verdict. A student on a real school
 * computer that trips this needs something an administrator can act on, and
 * "عتاد VMware (VMware, Inc.)" is that; "غير مسموح" is not.
 */

interface Props {
  /** What was detected — the vendor and where it was found. */
  finding: string;
}

export function VirtualMachineScreen({ finding }: Props) {
  const [note, setNote] = useState("");

  return (
    <div className="grid h-full place-items-center overflow-auto p-6">
      <div className="flex w-full max-w-[520px] flex-col items-center gap-4 py-8">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-primary-tint text-primary">
          <Icon name="Monitor" size={28} />
        </span>

        <h1 className="text-center font-ui text-title font-extrabold text-ink">
          لا يمكن تشغيل التطبيق على جهاز افتراضي
        </h1>

        <p className="max-w-[480px] text-center font-copy text-body leading-relaxed text-ink-secondary">
          يُشغَّل هذا التطبيق على الأجهزة الحقيقية فقط. المحاضرات محمية من
          التسجيل، وهذه الحماية لا تعمل داخل جهاز افتراضي — فلا يمكن فتح
          المحاضرات هنا.
        </p>

        <Panel className="flex w-full flex-col gap-2 p-card">
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-secondary text-ink-secondary">
              ما تم اكتشافه
            </span>
            <span className="min-w-0 text-end text-secondary text-ink">
              {finding}
            </span>
          </div>

          <button
            type="button"
            onClick={async () =>
              setNote(
                (await copyToClipboard(finding))
                  ? "تم النسخ إلى الحافظة."
                  : "تعذّر النسخ إلى الحافظة",
              )
            }
            className="self-start rounded-control border border-border px-3 py-1 text-secondary text-ink hover:bg-hover"
          >
            نسخ التفاصيل
          </button>
        </Panel>

        <p className="max-w-[480px] text-center font-copy text-body text-ink-muted">
          إن كنت تستخدم حاسوب المدرسة وظهرت لك هذه الرسالة، أرسل السطر أعلاه إلى
          إدارة المدرسة.
        </p>

        {note && <p className="text-label text-success">{note}</p>}
      </div>
    </div>
  );
}
