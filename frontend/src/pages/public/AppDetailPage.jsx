/**
 * pages/public/AppDetailPage.jsx
 * ─────────────────────────────────────────────────────────────────
 * تفاصيل تطبيق — عام بلا مصادقة.
 *
 * تطبيق غير منشور يرجع 404 من الخادم، فالصفحة تعرض حالة "غير موجود"
 * بدل كشف وجوده.
 */

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Loader2, ChevronLeft, PackageOpen, X } from 'lucide-react'

import api from '../../api/axiosInstance'
import PublicLayout from '../../components/layout/PublicLayout'
import { PLATFORM_META } from './storeShared'
import { DownloadButton } from './StorePage'

/* ── صف تنزيل لمنصة ────────────────────────────────────────────── */
function PlatformRow({ platform }) {
  const meta = PLATFORM_META[platform.platform] || {}
  const Icon = meta.icon || PackageOpen

  return (
    <div
      className="flex items-center gap-3 py-3.5"
      style={{ borderBottom: '1px solid var(--lp-border)' }}
    >
      <Icon size={18} style={{ color: 'var(--lp-text-secondary)' }} className="shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm" style={{ color: 'var(--lp-text-primary)' }}>
          {platform.platform_display}
        </p>
        {platform.file_size_mb && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--lp-text-muted)' }} dir="ltr">
            {platform.file_size_mb} MB
          </p>
        )}
      </div>

      <DownloadButton platform={platform} />
    </div>
  )
}

/* ── معرض الصور ─────────────────────────────────────────────────── */
function Gallery({ screenshots }) {
  const [open, setOpen] = useState(null)

  useEffect(() => {
    if (open === null) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!screenshots?.length) return null

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {screenshots.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setOpen(i)}
            className="shrink-0 rounded-xl overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
            style={{ border: '1px solid var(--lp-border)' }}
            aria-label={s.caption || `لقطة ${i + 1}`}
          >
            <img src={s.image} alt={s.caption || ''} className="h-56 w-auto object-cover block" />
          </button>
        ))}
      </div>

      {open !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.88)' }}
          onClick={() => setOpen(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="absolute top-5 p-2 rounded-lg text-white"
            style={{ insetInlineEnd: '20px', background: 'rgba(255,255,255,0.12)' }}
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
          <img
            src={screenshots[open].image}
            alt={screenshots[open].caption || ''}
            className="max-h-[85vh] max-w-full rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}

/* ── الصفحة ─────────────────────────────────────────────────────── */
export default function AppDetailPage() {
  const { id } = useParams()
  const [app, setApp]           = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    api.get('/public/site-data/')
      .then(({ data }) => setSettings(data?.settings || null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    api.get(`/public/store/apps/${id}/`)
      .then(({ data }) => setApp(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <PublicLayout settings={settings}>
      <Helmet>
        <title>{app ? `${app.name} — المتجر` : 'المتجر'} — نمبر ون</title>
      </Helmet>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-20">

        <Link
          to="/store"
          className="inline-flex items-center gap-1.5 text-sm font-semibold mb-6 transition-colors"
          style={{ color: 'var(--lp-text-secondary)' }}
        >
          <ChevronLeft size={16} className="rotate-180" />
          عودة إلى المتجر
        </Link>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={26} className="animate-spin" style={{ color: 'var(--brand-blue)' }} />
          </div>
        ) : notFound || !app ? (
          <div className="text-center py-20">
            <PackageOpen size={34} className="mx-auto mb-4" style={{ color: 'var(--lp-text-muted)' }} />
            <p className="font-cairo font-bold text-base" style={{ color: 'var(--lp-text-primary)' }}>
              التطبيق غير موجود
            </p>
            <p className="text-sm mt-1.5" style={{ color: 'var(--lp-text-secondary)' }}>
              ربما أُزيل من المتجر أو لم يُنشر بعد.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">

            {/* الترويسة */}
            <header className="flex items-start gap-5">
              <div
                className="w-20 h-20 rounded-2xl shrink-0 overflow-hidden flex items-center justify-center"
                style={{ background: 'var(--lp-bg-subtle)', border: '1px solid var(--lp-border)' }}
              >
                {app.icon ? (
                  <img src={app.icon} alt="" className="w-full h-full object-cover" />
                ) : (
                  <PackageOpen size={28} style={{ color: 'var(--lp-text-muted)' }} />
                )}
              </div>

              <div className="min-w-0 pt-1">
                <h1 className="font-cairo font-bold text-2xl" style={{ color: 'var(--lp-text-primary)' }}>
                  {app.name}
                </h1>
                {app.short_description && (
                  <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--lp-text-secondary)' }}>
                    {app.short_description}
                  </p>
                )}
              </div>
            </header>

            {/* الوصف */}
            {app.description && (
              <div>
                <h2 className="font-cairo font-bold text-base mb-2" style={{ color: 'var(--lp-text-primary)' }}>
                  عن التطبيق
                </h2>
                <p className="text-sm leading-loose whitespace-pre-line" style={{ color: 'var(--lp-text-secondary)' }}>
                  {app.description}
                </p>
              </div>
            )}

            {/* المعرض */}
            {app.screenshots?.length > 0 && (
              <div>
                <h2 className="font-cairo font-bold text-base mb-3" style={{ color: 'var(--lp-text-primary)' }}>
                  لقطات من التطبيق
                </h2>
                <Gallery screenshots={app.screenshots} />
              </div>
            )}

            {/* التنزيل */}
            <div>
              <h2 className="font-cairo font-bold text-base mb-1" style={{ color: 'var(--lp-text-primary)' }}>
                التنزيل
              </h2>
              <div className="light-card px-5 py-1 mt-3">
                {app.platforms.map((p) => (
                  <PlatformRow key={p.platform} platform={p} />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </PublicLayout>
  )
}
