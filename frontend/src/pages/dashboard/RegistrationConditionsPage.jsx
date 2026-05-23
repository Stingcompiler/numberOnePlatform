/**
 * RegistrationConditionsPage.jsx — إدارة شروط التسجيل الإلكتروني
 */
import { useState, useEffect, useCallback } from 'react'
import { Shield, Plus, Edit3, Trash2, Loader2, Save, X, GripVertical, Eye, EyeOff } from 'lucide-react'
import api from '../../api/axiosInstance'

export default function RegistrationConditionsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // {id,title,content,display_order,is_active} or {isNew:true,...}
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/registration-conditions/')
      setItems(data.results || data)
    } catch { setItems([]) }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const openNew = () => setEditing({ isNew: true, title: '', content: '', display_order: items.length, is_active: true })
  const openEdit = item => setEditing({ ...item })
  const close = () => setEditing(null)

  const handleSave = async () => {
    if (!editing.title.trim() || !editing.content.trim()) return
    setSaving(true)
    try {
      if (editing.isNew) {
        await api.post('/registration-conditions/', {
          title: editing.title, content: editing.content,
          display_order: editing.display_order, is_active: editing.is_active,
        })
      } else {
        await api.patch(`/registration-conditions/${editing.id}/`, {
          title: editing.title, content: editing.content,
          display_order: editing.display_order, is_active: editing.is_active,
        })
      }
      setEditing(null)
      fetch()
    } catch { /* silent */ }
    setSaving(false)
  }

  const handleDelete = async id => {
    if (!confirm('هل أنت متأكد من حذف هذا الشرط؟')) return
    try { await api.delete(`/registration-conditions/${id}/`); fetch() } catch { /* silent */ }
  }

  const toggleActive = async (item) => {
    try {
      await api.patch(`/registration-conditions/${item.id}/`, { is_active: !item.is_active })
      fetch()
    } catch { /* silent */ }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-red/15 flex items-center justify-center">
            <Shield size={20} className="text-brand-red" />
          </div>
          <div>
            <h1 className="font-cairo font-bold text-xl text-white">شروط التسجيل الإلكتروني</h1>
            <p className="text-white/40 text-sm">إدارة الشروط المعروضة في صفحة التسجيل العامة</p>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-blue text-white text-sm font-bold hover:opacity-90 transition-all">
          <Plus size={16} /> إضافة شرط
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 size={28} className="animate-spin text-brand-blue" /></div>
      ) : items.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Shield size={40} className="mx-auto mb-3 text-white/15" />
          <p className="text-white/40 text-sm">لا توجد شروط حالياً</p>
          <button onClick={openNew} className="mt-4 text-sm text-brand-blue hover:underline">أضف أول شرط</button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={item.id} className="glass-card p-4 flex items-start gap-4">
              <span className="w-8 h-8 rounded-lg bg-brand-blue/10 text-brand-blue text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-cairo font-bold text-white text-sm">{item.title}</h3>
                  {!item.is_active && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">مخفي</span>}
                </div>
                <p className="text-white/70 text-sm whitespace-pre-wrap leading-relaxed">{item.content}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleActive(item)} className="btn-ghost p-2 rounded-lg" title={item.is_active ? 'إخفاء' : 'إظهار'}>
                  {item.is_active ? <Eye size={14} className="text-emerald-400" /> : <EyeOff size={14} className="text-white/30" />}
                </button>
                <button onClick={() => openEdit(item)} className="btn-ghost p-2 rounded-lg"><Edit3 size={14} className="text-brand-blue" /></button>
                <button onClick={() => handleDelete(item.id)} className="btn-ghost p-2 rounded-lg"><Trash2 size={14} className="text-red-400" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark-900/80 backdrop-blur-sm" onClick={close} />
          <div className="relative z-10 w-full max-w-lg glass-card-strong p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-cairo font-bold text-white">{editing.isNew ? 'إضافة شرط جديد' : 'تعديل الشرط'}</h2>
              <button onClick={close} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-white/50 text-xs block mb-1.5">العنوان</label>
                <input value={editing.title} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-dark-700 border border-white/15 text-white rounded-xl px-3 py-2.5 text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-blue/50 transition-colors" placeholder="عنوان الشرط" />
              </div>
              <div>
                <label className="text-white/50 text-xs block mb-1.5">المحتوى</label>
                <textarea value={editing.content} onChange={e => setEditing(p => ({ ...p, content: e.target.value }))} rows={5}
                  className="w-full bg-dark-700 border border-white/15 text-white rounded-xl px-3 py-2.5 text-sm resize-none placeholder:text-white/30 focus:outline-none focus:border-brand-blue/50 transition-colors" placeholder="نص الشرط..." />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-white/50 text-xs block mb-1.5">ترتيب العرض</label>
                  <input type="number" value={editing.display_order} onChange={e => setEditing(p => ({ ...p, display_order: +e.target.value }))}
                    className="w-full bg-dark-700 border border-white/15 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-blue/50 transition-colors" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editing.is_active} onChange={e => setEditing(p => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 rounded accent-blue-600" />
                    <span className="text-white text-sm">نشط</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-blue text-white text-sm font-bold hover:opacity-90">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} حفظ
              </button>
              <button onClick={close} className="px-5 py-2.5 rounded-xl bg-white/06 text-white/60 text-sm hover:bg-white/10">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
