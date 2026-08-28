/**
 * pages/public/StorePage.jsx
 * ─────────────────────────────────────────────────────────────────
 * متجر التطبيقات — عام بلا مصادقة.
 *
 * الزائر الذي لم ينزّل التطبيق بعد لا يملك حساباً يسجّل به الدخول،
 * فاشتراط المصادقة هنا يخلق حلقة مغلقة. الصفحة تعمل لأي زائر.
 *
 * أزرار التنزيل تُرسم من download_url الذي يحسبه الخادم. لا تبني هذه
 * الصفحة منطق أولوية ثانياً بين رابط المتجر والرابط الخارجي والملف.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Loader2, Search, Download, ExternalLink, PackageOpen } from 'lucide-react'

import api from '../../api/axiosInstance'
import PublicLayout from '../../components/layout/PublicLayout'
import { PLATFORM_META, PlatformChip } from './storeShared'

/* ── بطاقة تطبيق ────────────────────────────────────────────────── */
function AppCard({ app }) {
  return (
    <article className="light-card p-5 flex flex-col gap-4">

      {/* الترويسة: الأيقونة والاسم */}
      <div className="flex items-start gap-4">
        <div
          className="w-14 h-14 rounded-xl shrink-0 overflow-hidden flex items-center justify-center"
          style={{ background: 'var(--lp-bg-subtle)', border: '1px solid var(--lp-border)' }}
        >
          {app.icon ? (
            <img src={app.icon} alt="" className="w-full h-full object-cover" />
          ) : (
            <PackageOpen size={22} style={{ color: 'var(--lp-text-muted)' }} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-cairo font-bold text-base leading-snug" style={{ color: 'var(--lp-text-primary)' }}>
            {app.name}
          </h3>
          {app.short_description && (
            <p className="text-sm mt-1 leading-relaxed line-clamp-2" style={{ color: 'var(--lp-text-secondary)' }}>
              {app.short_description}
            </p>
          )}
        </div>
      </div>

      {/* المنصات المدعومة */}
      <div className="flex flex-wrap gap-1.5">
        {app.platforms.map((p) => (
          <PlatformChip key={p.platform} platform={p.platform} label={p.platform_display} />
        ))}
      </div>

      {/* الإجراءات */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        <Link to={`/store/${app.id}`} className="lp-btn-ghost flex-1">
          التفاصيل
        </Link>
        {app.platforms.length === 1 ? (
          <DownloadButton platform={app.platforms[0]} className="flex-1" />
        ) : (
          <Link to={`/store/${app.id}`} className="lp-btn-primary flex-1">
            <Download size={15} />
            التنزيل
          </Link>
        )}
      </div>
    </article>
  )
}

/* ── زر تنزيل منصة واحدة ────────────────────────────────────────── */
export function DownloadButton({ platform, className = '' }) {
  const meta = PLATFORM_META[platform.platform] || {}
  const Icon = platform.is_store_link ? ExternalLink : Download

  return (
    <a
      href={platform.download_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`lp-btn-primary ${className}`}
    >
      <Icon size={15} />
      {platform.is_store_link ? `فتح في ${meta.storeName || 'المتجر'}` : 'تنزيل'}
      {platform.file_size_mb && (
        <span className="text-xs opacity-80">({platform.file_size_mb} م.ب)</span>
      )}
    </a>
  )
}

/* ── الصفحة ─────────────────────────────────────────────────────── */
export default function StorePage() {
  const [apps, setApps]       = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [search, setSearch]   = useState('')
  const [platform, setPlatform] = useState('')

  useEffect(() => {
    api.get('/public/site-data/')
      .then(({ data }) => setSettings(data?.settings || null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(false)

    const params = {}
    if (search.trim()) params.search = search.trim()
    if (platform) params.platform = platform

    api.get('/public/store/apps/', { params })
      .then(({ data }) => setApps(data))
      .catch((e) => {
        // الزائر لا يُعرَض عليه عطل تقني. فشل الطلب وقائمة فارغة يبدوان له
        // سواءً: لا تطبيقات ليأخذها. يبقى الخطأ في الـ console للتشخيص.
        console.warn('[store] تعذّر جلب التطبيقات:', e?.message)
        setApps([])
        setError(true)
      })
      .finally(() => setLoading(false))
  }, [search, platform])

  const filters = [
    { value: '', label: 'الكل' },
    ...Object.entries(PLATFORM_META).map(([value, meta]) => ({ value, label: meta.label })),
  ]

  return (
    <PublicLayout settings={settings}>
      <Helmet>
        <title>المتجر — نمبر ون</title>
        <meta name="description" content="تنزيل تطبيقات مدارس ومعاهد نمبر ون للهاتف والحاسوب." />
      </Helmet>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-20">

        {/* الترويسة */}
        <header className="mb-8">
          <h1 className="font-cairo font-bold text-2xl sm:text-3xl" style={{ color: 'var(--lp-text-primary)' }}>
            المتجر
          </h1>
          <p className="text-sm mt-2 max-w-xl leading-relaxed" style={{ color: 'var(--lp-text-secondary)' }}>
            نزّل تطبيقات المنصة على هاتفك أو حاسوبك.
          </p>
        </header>

        {/* البحث والفلترة */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={16}
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ insetInlineStart: '14px', color: 'var(--lp-text-muted)' }}
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في التطبيقات"
              className="input-light"
              style={{ paddingInlineStart: '40px' }}
              aria-label="ابحث في التطبيقات"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {filters.map((f) => {
              const active = platform === f.value
              return (
                <button
                  key={f.value || 'all'}
                  type="button"
                  onClick={() => setPlatform(f.value)}
                  aria-pressed={active}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-200"
                  style={{
                    background: active ? 'var(--brand-blue-soft)' : 'transparent',
                    color: active ? 'var(--brand-blue)' : 'var(--lp-text-secondary)',
                    border: `1px solid ${active ? 'rgba(26,86,219,0.35)' : 'var(--lp-border)'}`,
                  }}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* المحتوى */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={26} className="animate-spin" style={{ color: 'var(--brand-blue)' }} />
          </div>
        ) : apps.length === 0 ? (
          // بحث بلا نتيجة حالة مختلفة عن متجر فارغ — إلا عند فشل الطلب،
          // فحينها لا نعرف إن كان الفلتر هو السبب فنعرض رسالة الانتظار.
          (search || platform) && !error ? (
            <EmptyState
              title="لا توجد تطبيقات مطابقة"
              body="جرّب تعديل البحث أو الفلتر."
            />
          ) : (
            <EmptyState
              title="قريباً"
              body="سيتم إضافة التطبيقات هنا قريباً. تابعنا للحصول عليها فور توفّرها."
            />
          )
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => <AppCard key={app.id} app={app} />)}
          </div>
        )}
      </section>
    </PublicLayout>
  )
}

/* ── حالة فارغة ─────────────────────────────────────────────────── */
function EmptyState({ title, body }) {
  return (
    <div className="text-center py-20">
      <PackageOpen size={34} className="mx-auto mb-4" style={{ color: 'var(--lp-text-muted)' }} />
      <p className="font-cairo font-bold text-base" style={{ color: 'var(--lp-text-primary)' }}>
        {title}
      </p>
      <p className="text-sm mt-1.5" style={{ color: 'var(--lp-text-secondary)' }}>
        {body}
      </p>
    </div>
  )
}
