/**
 * pages/dashboard/StoreManagementPage.jsx
 * ─────────────────────────────────────────────────────────────────
 * إدارة المتجر — إضافة التطبيقات وتعديلها ونشرها وحذفها.
 *
 * حقول كل منصة تُبنى من /admin/store/platform-options/ لا من ثوابت هنا:
 * إضافة منصة جديدة في الباك إند تظهر في هذا النموذج تلقائياً.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Store, Plus, Search, Pencil, Trash2, Eye, EyeOff, X, Loader2,
  PackageOpen, Upload, Image as ImageIcon, AlertCircle, Check,
} from 'lucide-react'

import api from '../../api/axiosInstance'

/* ── إشعار عابر ─────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      className={`fixed bottom-6 left-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-2xl text-white text-sm font-medium shadow-2xl ${
        type === 'error' ? 'bg-brand-red' : 'bg-emerald-500'
      }`}
    >
      {type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
      {msg}
    </div>
  )
}

/* ── عرض أخطاء الحقول القادمة من الخادم ─────────────────────────── */
function FieldError({ errors, name }) {
  const value = errors?.[name]
  if (!value) return null
  const text = Array.isArray(value) ? value.join(' ') : String(value)
  return <p className="text-brand-red text-[11px] mt-1">{text}</p>
}

/* ── محرّر منصة واحدة ───────────────────────────────────────────── */
function PlatformEditor({ appId, spec, existing, onSaved, onRemoved }) {
  const [storeUrl, setStoreUrl]       = useState(existing?.store_url || '')
  const [externalUrl, setExternalUrl] = useState(existing?.external_url || '')
  const [file, setFile]               = useState(null)
  const [saving, setSaving]           = useState(false)
  const [errors, setErrors]           = useState(null)

  const acceptsFile = spec.extensions.length > 0
  const needsStore  = spec.requires === 'store_url'
  const needsLink   = spec.requires === 'any_link'

  const hint = {
    store_url:    'رابط المتجر الرسمي مطلوب لهذه المنصة.',
    any_link:     'يلزم رابط متجر أو رابط تنزيل مباشر.',
    file_or_link: 'يلزم رفع ملف التطبيق أو رابط تنزيل خارجي.',
  }[spec.requires]

  const save = async () => {
    setSaving(true)
    setErrors(null)

    const body = new FormData()
    body.append('platform', spec.value)
    body.append('store_url', storeUrl)
    body.append('external_url', externalUrl)
    if (file) body.append('file', file)

    const url = existing
      ? `/admin/store/platforms/${existing.id}/`
      : `/admin/store/apps/${appId}/platforms/`

    try {
      const { data } = existing
        ? await api.patch(url, body, { headers: { 'Content-Type': 'multipart/form-data' } })
        : await api.post(url, body, { headers: { 'Content-Type': 'multipart/form-data' } })
      onSaved(data)
    } catch (e) {
      setErrors(e?.response?.data || { detail: 'تعذّر الحفظ.' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!existing) return
    setSaving(true)
    try {
      await api.delete(`/admin/store/platforms/${existing.id}/`)
      onRemoved(existing.id)
    } catch {
      setErrors({ detail: 'تعذّر الحذف.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl p-4 border border-white/06 bg-white/02 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-white font-semibold text-sm">{spec.label}</h4>
        {existing && (
          <button
            type="button"
            onClick={remove}
            className="text-brand-red/80 hover:text-brand-red text-xs flex items-center gap-1"
          >
            <Trash2 size={12} /> إزالة المنصة
          </button>
        )}
      </div>

      <p className="text-white/30 text-[11px]">{hint}</p>

      <div>
        <label className="label-field">
          رابط المتجر {needsStore && <span className="text-brand-red">*</span>}
        </label>
        <input
          type="url"
          dir="ltr"
          value={storeUrl}
          onChange={(e) => setStoreUrl(e.target.value)}
          placeholder="https://play.google.com/..."
          className="input-field w-full text-sm"
        />
        <FieldError errors={errors} name="store_url" />
      </div>

      <div>
        <label className="label-field">رابط تنزيل خارجي</label>
        <input
          type="url"
          dir="ltr"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="https://..."
          className="input-field w-full text-sm"
        />
        <FieldError errors={errors} name="external_url" />
      </div>

      {acceptsFile && (
        <div>
          <label className="label-field">
            ملف التطبيق
            <span className="text-white/25 mr-1">({spec.extensions.join('، ')})</span>
          </label>
          <input
            type="file"
            accept={spec.extensions.join(',')}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="input-field w-full text-xs"
          />
          {existing?.file_size_mb && !file && (
            <p className="text-white/30 text-[11px] mt-1">
              الملف الحالي: {existing.file_size_mb} م.ب
            </p>
          )}
          <FieldError errors={errors} name="file" />
        </div>
      )}

      <FieldError errors={errors} name="platform" />
      <FieldError errors={errors} name="detail" />

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="btn-primary text-sm w-full flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        {existing ? 'حفظ التعديلات' : 'إضافة المنصة'}
      </button>
    </div>
  )
}

/* ── محرّر التطبيق (نافذة) ──────────────────────────────────────── */
function AppEditor({ app, specs, onClose, onSaved, notify }) {
  const isNew = !app?.id

  const [tab, setTab]     = useState('info')
  const [form, setForm]   = useState({
    name: app?.name || '',
    short_description: app?.short_description || '',
    description: app?.description || '',
  })
  const [icon, setIcon]   = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState(null)

  const [platforms, setPlatforms]     = useState(app?.platforms || [])
  const [screenshots, setScreenshots] = useState(app?.screenshots || [])
  const [current, setCurrent]         = useState(app)
  const fileRef = useRef(null)

  const saveInfo = async () => {
    setSaving(true)
    setErrors(null)

    const body = new FormData()
    body.append('name', form.name)
    body.append('short_description', form.short_description)
    body.append('description', form.description)
    if (icon) body.append('icon', icon)

    try {
      const { data } = isNew
        ? await api.post('/admin/store/apps/', body, { headers: { 'Content-Type': 'multipart/form-data' } })
        : await api.patch(`/admin/store/apps/${app.id}/`, body, { headers: { 'Content-Type': 'multipart/form-data' } })

      setCurrent(data)
      onSaved(data)
      notify(isNew ? 'أُضيف التطبيق ✓' : 'حُفظت التعديلات ✓')
      if (isNew) setTab('platforms')
    } catch (e) {
      setErrors(e?.response?.data || { detail: 'تعذّر الحفظ.' })
    } finally {
      setSaving(false)
    }
  }

  const uploadScreenshot = async (imageFile) => {
    if (!current?.id || !imageFile) return
    const body = new FormData()
    body.append('image', imageFile)

    try {
      const { data } = await api.post(
        `/admin/store/apps/${current.id}/screenshots/`, body,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      setScreenshots((s) => [...s, data])
    } catch (e) {
      const msg = e?.response?.data?.image
      notify(Array.isArray(msg) ? msg.join(' ') : 'تعذّر رفع الصورة.', 'error')
    }
  }

  const deleteScreenshot = async (id) => {
    try {
      await api.delete(`/admin/store/screenshots/${id}/`)
      setScreenshots((s) => s.filter((x) => x.id !== id))
    } catch {
      notify('تعذّر حذف الصورة.', 'error')
    }
  }

  const tabs = [
    { key: 'info',        label: 'البيانات' },
    { key: 'platforms',   label: 'المنصات',  disabled: isNew && !current },
    { key: 'screenshots', label: 'الصور',    disabled: isNew && !current },
  ]

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 overflow-y-auto bg-black/70" dir="rtl">
      <div className="glass-card-strong w-full max-w-2xl my-8 p-6 space-y-5">

        <div className="flex items-center justify-between">
          <h2 className="text-white font-cairo font-bold text-lg">
            {isNew ? 'إضافة تطبيق' : current?.name}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white" aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        {/* التبويبات */}
        <div className="flex gap-1 border-b border-white/06">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              disabled={t.disabled}
              onClick={() => setTab(t.key)}
              className="px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-30"
              style={{
                color: tab === t.key ? 'var(--brand-blue)' : 'rgba(255,255,255,0.45)',
                borderBottom: tab === t.key ? '2px solid var(--brand-blue)' : '2px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* البيانات */}
        {tab === 'info' && (
          <div className="space-y-3">
            <div>
              <label className="label-field">اسم التطبيق <span className="text-brand-red">*</span></label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="input-field w-full text-sm"
              />
              <FieldError errors={errors} name="name" />
            </div>

            <div>
              <label className="label-field">وصف مختصر</label>
              <input
                value={form.short_description}
                onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))}
                className="input-field w-full text-sm"
                placeholder="سطر يظهر في بطاقة التطبيق"
              />
            </div>

            <div>
              <label className="label-field">الوصف</label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="input-field w-full text-sm"
              />
            </div>

            <div>
              <label className="label-field">أيقونة التطبيق</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setIcon(e.target.files?.[0] || null)}
                className="input-field w-full text-xs"
              />
              <FieldError errors={errors} name="icon" />
            </div>

            <FieldError errors={errors} name="detail" />

            <button
              onClick={saveInfo}
              disabled={saving}
              className="btn-primary w-full text-sm flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {isNew ? 'إنشاء والمتابعة' : 'حفظ'}
            </button>
          </div>
        )}

        {/* المنصات */}
        {tab === 'platforms' && current && (
          <div className="space-y-3">
            <p className="text-white/30 text-[11px]">
              منصة واحدة لكل تطبيق — التحديث يستبدل الإصدار السابق.
            </p>
            {specs.map((spec) => (
              <PlatformEditor
                key={spec.value}
                appId={current.id}
                spec={spec}
                existing={platforms.find((p) => p.platform === spec.value)}
                onSaved={(saved) => {
                  setPlatforms((list) => [
                    ...list.filter((p) => p.platform !== saved.platform),
                    saved,
                  ])
                  notify('حُفظت المنصة ✓')
                }}
                onRemoved={(id) => {
                  setPlatforms((list) => list.filter((p) => p.id !== id))
                  notify('أُزيلت المنصة ✓')
                }}
              />
            ))}
          </div>
        )}

        {/* الصور */}
        {tab === 'screenshots' && current && (
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                Array.from(e.target.files || []).forEach(uploadScreenshot)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn-secondary w-full text-sm flex items-center justify-center gap-2"
            >
              <Upload size={13} /> رفع صور
            </button>

            {screenshots.length === 0 ? (
              <p className="text-white/25 text-xs text-center py-6">لا توجد صور بعد.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {screenshots.map((s) => (
                  <div key={s.id} className="relative rounded-xl overflow-hidden border border-white/06">
                    <img src={s.image} alt="" className="w-full h-28 object-cover" />
                    <button
                      type="button"
                      onClick={() => deleteScreenshot(s.id)}
                      className="absolute top-1.5 left-1.5 p-1 rounded-lg bg-black/70 text-white"
                      aria-label="حذف الصورة"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── الصفحة ─────────────────────────────────────────────────────── */
export default function StoreManagementPage() {
  const [apps, setApps]       = useState([])
  const [specs, setSpecs]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [platform, setPlatform] = useState('')
  const [editing, setEditing] = useState(null)
  const [toast, setToast]     = useState(null)

  const notify = useCallback(
    (msg, type = 'success') => setToast({ msg, type }),
    [],
  )

  useEffect(() => {
    api.get('/admin/store/platform-options/')
      .then(({ data }) => setSpecs(data.platforms))
      .catch(() => notify('تعذّر تحميل قائمة المنصات.', 'error'))
  }, [notify])

  const load = useCallback(() => {
    setLoading(true)
    const params = {}
    if (search.trim()) params.search = search.trim()
    if (platform) params.platform = platform

    api.get('/admin/store/apps/', { params })
      .then(({ data }) => setApps(data.results || data))
      .catch(() => notify('تعذّر تحميل التطبيقات.', 'error'))
      .finally(() => setLoading(false))
  }, [search, platform, notify])

  useEffect(() => { load() }, [load])

  const togglePublish = async (app) => {
    try {
      const { data } = await api.post(`/admin/store/apps/${app.id}/publish/`, {
        is_published: !app.is_published,
      })
      setApps((list) => list.map((a) => (a.id === data.id ? data : a)))
      notify(data.is_published ? 'نُشر التطبيق ✓' : 'أُلغي نشر التطبيق ✓')
    } catch (e) {
      const msg = e?.response?.data?.is_published
      notify(Array.isArray(msg) ? msg.join(' ') : 'تعذّر تغيير حالة النشر.', 'error')
    }
  }

  const remove = async (app) => {
    if (!window.confirm(`سيُحذف «${app.name}» نهائياً. هل أنت متأكد؟`)) return
    try {
      await api.delete(`/admin/store/apps/${app.id}/`)
      setApps((list) => list.filter((a) => a.id !== app.id))
      notify('حُذف التطبيق ✓')
    } catch {
      notify('تعذّر الحذف.', 'error')
    }
  }

  const filters = useMemo(
    () => [{ value: '', label: 'كل المنصات' }, ...specs.map((s) => ({ value: s.value, label: s.label }))],
    [specs],
  )

  return (
    <div className="space-y-5 animate-fade-in">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* الترويسة */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
            <Store size={20} className="text-brand-blue" /> إدارة المتجر
          </h1>
          <p className="text-white/30 text-xs mt-0.5">
            التطبيقات المعروضة للتنزيل في الصفحة العامة
          </p>
        </div>

        <button onClick={() => setEditing({})} className="btn-primary text-sm flex items-center gap-2">
          <Plus size={14} /> إضافة تطبيق
        </button>
      </div>

      {/* البحث والفلترة */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={15}
            className="absolute top-1/2 -translate-y-1/2 text-white/25 pointer-events-none"
            style={{ insetInlineStart: '12px' }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في التطبيقات"
            className="input-field w-full text-sm"
            style={{ paddingInlineStart: '36px' }}
          />
        </div>

        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="input-field text-sm sm:w-48"
          aria-label="فلترة حسب المنصة"
        >
          {filters.map((f) => (
            <option key={f.value || 'all'} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* القائمة */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-brand-blue" />
        </div>
      ) : apps.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <PackageOpen size={30} className="mx-auto mb-3 text-white/20" />
          <p className="text-white/60 text-sm">
            {search || platform ? 'لا توجد تطبيقات مطابقة' : 'لا توجد تطبيقات بعد'}
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {apps.map((app, i) => (
            <div
              key={app.id}
              className="flex items-center gap-4 px-5 py-4"
              style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="w-11 h-11 rounded-xl shrink-0 overflow-hidden bg-white/05 border border-white/06 flex items-center justify-center">
                {app.icon
                  ? <img src={app.icon} alt="" className="w-full h-full object-cover" />
                  : <ImageIcon size={16} className="text-white/20" />}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-white font-semibold text-sm truncate">{app.name}</p>
                <p className="text-white/30 text-[11px] mt-0.5">
                  {app.platform_count > 0
                    ? `${app.platform_count} منصة`
                    : 'بلا منصات — لا يمكن نشره'}
                </p>
              </div>

              <span className={app.is_published ? 'badge-green' : 'badge-red'}>
                {app.is_published ? 'منشور' : 'غير منشور'}
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => togglePublish(app)}
                  className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/05 transition-colors"
                  title={app.is_published ? 'إلغاء النشر' : 'نشر'}
                >
                  {app.is_published ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button
                  onClick={() => setEditing(app)}
                  className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/05 transition-colors"
                  title="تعديل"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => remove(app)}
                  className="p-2 rounded-lg text-white/40 hover:text-brand-red hover:bg-white/05 transition-colors"
                  title="حذف"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <AppEditor
          app={editing.id ? editing : null}
          specs={specs}
          notify={notify}
          onClose={() => { setEditing(null); load() }}
          onSaved={() => {}}
        />
      )}
    </div>
  )
}
