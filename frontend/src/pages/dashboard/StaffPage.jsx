/**
 * pages/dashboard/StaffPage.jsx
 * إدارة بطاقات الكادر — الهيئة الأكاديمية والإدارية
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Users, Plus, X, Loader2, Edit2, Trash2,
  User, GraduationCap, Briefcase, Eye, EyeOff,
  Image,
} from 'lucide-react'
import api from '../../api/axiosInstance'

/* ─ مودال إنشاء/تعديل ──────────────────────────────────────────── */
function StaffModal({ item, onClose, onSaved }) {
  const isEdit = !!item?.id
  const [form, setForm] = useState({
    name:          item?.name          || '',
    title:         item?.title         || '',
    bio:           item?.bio           || '',
    card_type:     item?.card_type     || 'academic',
    is_active:     item?.is_active     ?? true,
    display_order: item?.display_order ?? 0,
  })
  const [photoFile, setPhotoFile] = useState(null)
  const [preview,   setPreview]   = useState(item?.display_photo || item?.photo || null)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const handleChange = (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setError('')
    setForm(f => ({ ...f, [e.target.name]: val }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhotoFile(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      let payload
      if (photoFile) {
        payload = new FormData()
        Object.entries(form).forEach(([k, v]) => payload.append(k, v))
        payload.append('photo', photoFile)
      } else {
        payload = form
      }
      if (isEdit) await api.patch(`/admin/staff/${item.id}/`, payload)
      else         await api.post('/admin/staff/', payload)
      onSaved()
      onClose()
    } catch (err) {
      const d = err.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'حدث خطأ.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
      <div className="glass-card-strong w-full max-w-lg p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-cairo font-bold text-white text-lg flex items-center gap-2">
            {isEdit ? <Edit2 size={18} className="text-brand-blue" /> : <Plus size={18} className="text-brand-blue" />}
            {isEdit ? 'تعديل بطاقة الكادر' : 'بطاقة كادر جديدة'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-white/50 text-xs mb-1 block">الاسم الكامل *</label>
              <input name="name" value={form.name} onChange={handleChange}
                required placeholder="الاسم الثلاثي" className="input-glass" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">المسمى الوظيفي *</label>
              <input name="title" value={form.title} onChange={handleChange}
                required placeholder="مثال: مدرّس رياضيات" className="input-glass" />
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs mb-1 block">نبذة مختصرة</label>
            <textarea name="bio" value={form.bio} onChange={handleChange}
              rows={3} placeholder="نبذة تعريفية..." className="input-glass resize-none" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-white/50 text-xs mb-1 block">نوع الكادر *</label>
              <select name="card_type" value={form.card_type} onChange={handleChange} className="input-glass">
                <option value="academic">هيئة أكاديمية</option>
                <option value="administrative">هيئة إدارية</option>
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">ترتيب العرض</label>
              <input name="display_order" value={form.display_order} onChange={handleChange}
                type="number" min="0" className="input-glass text-sm" />
            </div>
          </div>

          {/* صورة الكادر */}
          <div>
            <label className="text-white/50 text-xs mb-1 block">صورة (اختياري)</label>
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
                  {photoFile ? photoFile.name : 'اختيار صورة...'}
                </span>
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange}
              className="w-4 h-4 accent-brand-blue" />
            <span className="text-white/60 text-sm">ظاهر في صفحة الهبوط</span>
          </label>

          {error && <p className="text-brand-red text-xs bg-brand-red/10 rounded-xl p-3">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saving ? 'حفظ...' : 'حفظ'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-6">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─ بطاقة عنصر الكادر ──────────────────────────────────────────── */
function StaffCard({ item, onEdit, onDelete }) {
  const isAcademic = item.card_type === 'academic'
  return (
    <div className={`glass-card p-4 flex items-center gap-4 transition-all ${!item.is_active ? 'opacity-50' : ''}`}>
      {/* الأيقونة */}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
        isAcademic ? 'bg-brand-blue/10' : 'bg-amber-400/10'
      }`}>
        {item.display_photo || item.photo ? (
          <img src={item.display_photo || item.photo} alt=""
            className="w-12 h-12 rounded-xl object-cover" />
        ) : isAcademic ? (
          <GraduationCap size={20} className="text-brand-blue" />
        ) : (
          <Briefcase size={20} className="text-amber-400" />
        )}
      </div>

      {/* المعلومات */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-cairo font-semibold text-white">{item.name}</h3>
          <span className={`badge text-xs ${isAcademic ? 'badge-blue' : 'bg-amber-400/10 text-amber-400 border border-amber-400/20'}`}>
            {isAcademic ? 'أكاديمي' : 'إداري'}
          </span>
          {!item.is_active && <span className="badge badge-red text-xs">مخفي</span>}
        </div>
        <p className="text-white/50 text-sm mt-0.5">{item.title}</p>
        {item.bio && (
          <p className="text-white/25 text-xs mt-1 line-clamp-1">{item.bio}</p>
        )}
        <p className="text-white/20 text-xs mt-0.5">ترتيب: {item.display_order}</p>
      </div>

      {/* الأزرار */}
      <div className="flex items-center gap-1 shrink-0">
        {item.is_active
          ? <Eye size={13} className="text-neon-cyan ml-1" />
          : <EyeOff size={13} className="text-white/20 ml-1" />
        }
        <button onClick={() => onEdit(item)}
          className="btn-ghost p-1.5 text-brand-blue">
          <Edit2 size={15} />
        </button>
        <button onClick={() => onDelete(item.id)}
          className="btn-ghost p-1.5 text-brand-red/40 hover:text-brand-red">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

/* ─ الصفحة ─────────────────────────────────────────────────────── */
export default function StaffPage() {
  const [staff,   setStaff]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)
  const [filter,  setFilter]  = useState('')  // '' | 'academic' | 'administrative'

  const load = useCallback(() => {
    setLoading(true)
    api.get('/admin/staff/')
      .then(({ data }) => setStaff(data.results || data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const destroy = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه البطاقة؟')) return
    await api.delete(`/admin/staff/${id}/`)
    load()
  }

  const filtered = filter ? staff.filter(s => s.card_type === filter) : staff
  const academic = staff.filter(s => s.card_type === 'academic').length
  const admin    = staff.filter(s => s.card_type === 'administrative').length

  return (
    <div className="space-y-5 animate-fade-in">
      {/* الرأس */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
            <Users size={20} className="text-brand-blue" /> بطاقات الكادر
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            {academic} أكاديمي &bull; {admin} إداري
          </p>
        </div>
        <button onClick={() => setModal({})} className="btn-primary">
          <Plus size={16} /> بطاقة جديدة
        </button>
      </div>

      <p className="text-white/40 text-sm">
        تُعرَض هذه البطاقات في قسم "فريقنا" بصفحة الهبوط. الفلتر على اليمين للبحث.
      </p>

      {/* فلاتر */}
      <div className="flex gap-2">
        {[
          ['', 'الكل'],
          ['academic', 'أكاديمي'],
          ['administrative', 'إداري'],
        ].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === val
                ? 'bg-brand-blue/15 text-brand-blue border border-brand-blue/30'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* القائمة */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-white/30">
          <User size={40} className="mx-auto mb-3 opacity-30" />
          <p>لا توجد بطاقات. أضف أول عنصر من الكادر!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <StaffCard
              key={item.id}
              item={item}
              onEdit={(it) => setModal({ item: it })}
              onDelete={destroy}
            />
          ))}
        </div>
      )}

      {modal !== null && (
        <StaffModal
          item={modal.item}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
