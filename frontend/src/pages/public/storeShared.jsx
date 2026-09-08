/**
 * pages/public/storeShared.jsx
 * ─────────────────────────────────────────────────────────────────
 * تسميات المنصات وأيقوناتها، مشتركة بين قائمة المتجر وصفحة التفاصيل.
 *
 * الأسماء والامتدادات مصدرها الباك إند (PLATFORM_SPECS). ما هنا هو
 * التمثيل البصري فقط: أيقونة واسم المتجر الرسمي.
 */

import { Smartphone, Monitor, Laptop } from 'lucide-react'

export const PLATFORM_META = {
  android: { label: 'أندرويد',   icon: Smartphone, storeName: 'Google Play' },
  ios:     { label: 'آي أو إس',  icon: Smartphone, storeName: 'App Store' },
  windows: { label: 'ويندوز',    icon: Monitor,    storeName: null },
  macos:   { label: 'ماك أو إس', icon: Laptop,     storeName: null },
}

/** شارة منصة صغيرة تُعرض في بطاقة التطبيق. */
export function PlatformChip({ platform, label }) {
  const meta = PLATFORM_META[platform]
  const Icon = meta?.icon || Monitor

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold"
      style={{
        background: 'var(--lp-bg-subtle)',
        color: 'var(--lp-text-secondary)',
        border: '1px solid var(--lp-border)',
      }}
    >
      <Icon size={13} />
      {label || meta?.label || platform}
    </span>
  )
}
