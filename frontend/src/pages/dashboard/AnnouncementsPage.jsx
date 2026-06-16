/**
 * pages/dashboard/AnnouncementsPage.jsx
 * إدارة الإعلانات — CRUD + Toggle
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Megaphone, Plus, X, Loader2, Eye, EyeOff,
  Trash2, Edit2, Image, CheckCircle, XCircle, Upload,
} from 'lucide-react'
import api from '../../api/axiosInstance'

function AnnouncementModal({ item, onClose, onSaved }) {
  const isEdit = !!item?.id
  const [form, setForm] = useState({
    title:        item?.title        || '',
    body:         item?.body         || '',
    link:         item?.link         || '',
    display_order:item?.display_order|| 0,
    is_active:    item?.is_active    ?? true,
    start_date:   item?.start_date   || '',
    end_date:     item?.end_date     || '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [preview,   setPreview]   = useState(
    item?.image ? (item.image.startsWith('http') ? item.image : `/media/${item.image}`) : null
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const handleChange = (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [e.target.name]: val }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImageFile(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      let payload
      if (imageFile) {
        payload = new FormData()
        Object.entries(form).forEach(([k, v]) => payload.append(k, v))
        payload.append('image', imageFile)
      } else {
        payload = form
      }
      if (isEdit) await api.patch(`/admin/announcements/${item.id}/`, payload)
      else         await api.post('/admin/announcements/', payload)
      onSaved()
      onClose()
    } catch (err) {
      const d = err.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'حدث خطأ.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
      <div className="glass-card-strong w-full max-w-lg p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-cairo font-bold text-white text-lg flex items-center gap-2">
            {isEdit ? <Edit2 size={17} className="text-brand-blue" /> : <Plus size={17} className="text-brand-blue" />}
            {isEdit ? 'تعديل إعلان' : 'إعلان جديد'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-white/50 text-xs mb-1 block">عنوان الإعلان *</label>
            <input name="title" value={form.title} onChange={handleChange} required placeholder="عنوان واضح..." className="input-glass" />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">نص الإعلان</label>
            <textarea name="body" value={form.body} onChange={handleChange} rows={3} placeholder="تفاصيل الإعلان..." className="input-glass resize-none" />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">رابط (اختياري)</label>
            <input name="link" value={form.link} onChange={handleChange} placeholder="https://..." className="input-glass" dir="ltr" />
          </div>
          {/* صورة الإعلان */}
          <div>
            <label className="text-white/50 text-xs mb-1 block">صورة الإعلان (اختياري)</label>
            <div className="flex items-center gap-4">
              {preview ? (
                <img src={preview} alt="" className="w-14 h-14 rounded-xl object-cover border border-white/10" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-dark-600 flex items-center justify-center border border-white/10">
                  <Image size={20} className="text-white/20" />
                </div>
              )}
              <label className="cursor-pointer flex-1">
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                <span className="inline-block px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors text-center w-full">
                  {imageFile ? imageFile.name : 'اختيار صورة...'}
                </span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white/50 text-xs mb-1 block">تاريخ البدء</label>
              <input name="start_date" value={form.start_date} onChange={handleChange} type="date" className="input-glass" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">تاريخ الانتهاء</label>
              <input name="end_date" value={form.end_date} onChange={handleChange} type="date" className="input-glass" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-white/50 text-xs">ترتيب العرض:</label>
            <input name="display_order" value={form.display_order} onChange={handleChange} type="number" min="0" className="input-glass w-24 text-sm" />
            <label className="flex items-center gap-2 cursor-pointer mr-4">
              <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange} className="w-4 h-4 accent-brand-blue" />
              <span className="text-white/60 text-sm">نشط</span>
            </label>
          </div>

          {error && <p className="text-brand-red text-xs bg-brand-red/10 rounded-xl p-3">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-5">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [modal,         setModal]         = useState(null)  // null | {} | { item }

  const load = useCallback(() => {
    setLoading(true)
    api.get('/admin/announcements/')
      .then(({ data }) => setAnnouncements(data.results || data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = async (id) => {
    await api.post(`/admin/announcements/${id}/toggle/`)
    load()
  }

  const destroy = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الإعلان؟')) return
    await api.delete(`/admin/announcements/${id}/`)
    load()
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
          <Megaphone size={20} className="text-brand-blue" /> الإعلانات
        </h1>
        <button onClick={() => setModal({})} className="btn-primary">
          <Plus size={16} /> إعلان جديد
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 size={28} className="animate-spin text-brand-blue mx-auto" /></div>
      ) : announcements.length === 0 ? (
        <div className="glass-card p-12 text-center text-white/30">
          <Megaphone size={40} className="mx-auto mb-3 opacity-30" />
          <p>لا توجد إعلانات. أضف إعلانك الأول!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <div key={ann.id} className={`glass-card p-4 flex items-center gap-4 transition-all ${ann.is_active ? '' : 'opacity-50'}`}>
              {/* صورة مصغَّرة */}
              {ann.image ? (
                <img src={`/media/${ann.image}`} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-dark-600 flex items-center justify-center shrink-0">
                  <Image size={20} className="text-white/20" />
                </div>
              )}

              {/* المعلومات */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-cairo font-semibold text-white text-sm">{ann.title}</h3>
                  <span className={`badge text-xs ${ann.is_active ? 'badge-green' : 'badge-red'}`}>
                    {ann.is_active ? 'نشط' : 'موقوف'}
                  </span>
                  <span className="text-white/25 text-xs">ترتيب: {ann.display_order}</span>
                </div>
                {ann.body && <p className="text-white/40 text-xs mt-1 line-clamp-1">{ann.body}</p>}
                {(ann.start_date || ann.end_date) && (
                  <p className="text-white/25 text-xs mt-1">
                    {ann.start_date} {ann.end_date ? `← ${ann.end_date}` : ''}
                  </p>
                )}
              </div>

              {/* الأزرار */}
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggle(ann.id)}
                  title={ann.is_active ? 'إيقاف' : 'تفعيل'}
                  className={`btn-ghost p-2 ${ann.is_active ? 'text-neon-cyan' : 'text-white/30'} hover:scale-110`}>
                  {ann.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button onClick={() => setModal({ item: ann })}
                  className="btn-ghost p-2 text-brand-blue hover:scale-110">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => destroy(ann.id)}
                  className="btn-ghost p-2 text-brand-red/40 hover:text-brand-red hover:scale-110">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <AnnouncementModal item={modal.item} onClose={() => setModal(null)} onSaved={load} />
      )}
    </div>
  )
}
