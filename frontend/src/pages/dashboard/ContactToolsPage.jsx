/**
 * pages/dashboard/ContactToolsPage.jsx
 * إدارة أدوات التواصل — واتساب، تيليغرام، فيسبوك، إلخ
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Link2, Plus, X, Loader2, Edit2, Trash2,
  MessageCircle, Phone, Mail, Globe, Youtube,
  Instagram, Facebook, Twitter, ToggleLeft, ToggleRight,
} from 'lucide-react'
import api from '../../api/axiosInstance'

/* ─ مطابق أيقونات الأداة ──────────────────────────────────────── */
const TOOL_ICONS = {
  whatsapp:  { icon: MessageCircle, color: 'text-green-400',  bg: 'bg-green-400/10', label: 'واتساب' },
  telegram:  { icon: MessageCircle, color: 'text-sky-400',    bg: 'bg-sky-400/10',   label: 'تيليغرام' },
  facebook:  { icon: Facebook,      color: 'text-blue-500',   bg: 'bg-blue-500/10',  label: 'فيسبوك' },
  instagram: { icon: Instagram,     color: 'text-pink-400',   bg: 'bg-pink-400/10',  label: 'إنستغرام' },
  twitter:   { icon: Twitter,       color: 'text-sky-300',    bg: 'bg-sky-300/10',   label: 'إكس' },
  youtube:   { icon: Youtube,       color: 'text-brand-red',  bg: 'bg-brand-red/10', label: 'يوتيوب' },
  phone:     { icon: Phone,         color: 'text-neon-cyan',  bg: 'bg-neon-cyan/10', label: 'هاتف' },
  email:     { icon: Mail,          color: 'text-amber-400',  bg: 'bg-amber-400/10', label: 'بريد' },
  website:   { icon: Globe,         color: 'text-brand-blue', bg: 'bg-brand-blue/10',label: 'موقع' },
  other:     { icon: Link2,         color: 'text-white/50',   bg: 'bg-white/05',     label: 'أخرى' },
}

/* ─ مودال إنشاء/تعديل ──────────────────────────────────────────── */
function ToolModal({ tool, onClose, onSaved }) {
  const isEdit = !!tool?.id
  const [form, setForm] = useState({
    tool_type:     tool?.tool_type     || 'whatsapp',
    label:         tool?.label         || '',
    value:         tool?.value         || '',
    is_active:     tool?.is_active     ?? true,
    display_order: tool?.display_order ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const handleChange = (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setError('')
    setForm(f => ({ ...f, [e.target.name]: val }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit) await api.patch(`/admin/contact-tools/${tool.id}/`, form)
      else         await api.post('/admin/contact-tools/', form)
      onSaved()
      onClose()
    } catch (err) {
      const d = err.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'حدث خطأ.')
    } finally { setSaving(false) }
  }

  const placeholders = {
    whatsapp:  'https://wa.me/249xxxxxxxxx',
    telegram:  'https://t.me/username',
    facebook:  'https://facebook.com/page',
    instagram: 'https://instagram.com/account',
    twitter:   'https://x.com/account',
    youtube:   'https://youtube.com/channel/...',
    phone:     '+249xxxxxxxxx',
    email:     'info@numberone.edu.sd',
    website:   'https://numberone.edu.sd',
    other:     'رابط أو رقم',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
      <div className="glass-card-strong w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-cairo font-bold text-white text-lg flex items-center gap-2">
            {isEdit ? <Edit2 size={18} className="text-brand-blue" /> : <Plus size={18} className="text-brand-blue" />}
            {isEdit ? 'تعديل أداة التواصل' : 'أداة تواصل جديدة'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-white/50 text-xs mb-1 block">نوع الأداة *</label>
            <select name="tool_type" value={form.tool_type} onChange={handleChange} className="input-glass">
              {Object.entries(TOOL_ICONS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-white/50 text-xs mb-1 block">التسمية (اختياري)</label>
            <input name="label" value={form.label} onChange={handleChange}
              placeholder="مثال: تواصل معنا على واتساب" className="input-glass" />
          </div>

          <div>
            <label className="text-white/50 text-xs mb-1 block">الرابط أو الرقم *</label>
            <input name="value" value={form.value} onChange={handleChange}
              required placeholder={placeholders[form.tool_type]} className="input-glass" dir="ltr" />
          </div>

          <div className="flex items-center gap-4">
            <div>
              <label className="text-white/50 text-xs mb-1 block">الترتيب</label>
              <input name="display_order" value={form.display_order} onChange={handleChange}
                type="number" min="0" className="input-glass w-24 text-sm" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-4">
              <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange}
                className="w-4 h-4 accent-brand-blue" />
              <span className="text-white/60 text-sm">نشطة</span>
            </label>
          </div>

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

/* ─ الصفحة ─────────────────────────────────────────────────────── */
export default function ContactToolsPage() {
  const [tools,   setTools]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/admin/contact-tools/')
      .then(({ data }) => setTools(data.results || data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const destroy = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الأداة؟')) return
    await api.delete(`/admin/contact-tools/${id}/`)
    load()
  }

  const toggleActive = async (tool) => {
    await api.patch(`/admin/contact-tools/${tool.id}/`, { is_active: !tool.is_active })
    load()
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* الرأس */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
          <Link2 size={20} className="text-brand-blue" /> أدوات التواصل
        </h1>
        <button onClick={() => setModal({})} className="btn-primary">
          <Plus size={16} /> أداة جديدة
        </button>
      </div>

      <p className="text-white/40 text-sm">
        تُعرَض هذه الروابط في قسم التواصل بصفحة الهبوط. مرتّبة حسب ترتيب العرض.
      </p>

      {/* القائمة */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
        </div>
      ) : tools.length === 0 ? (
        <div className="glass-card p-12 text-center text-white/30">
          <Link2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>لا توجد أدوات تواصل. أضف أولى روابطك!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tools.map((tool) => {
            const meta = TOOL_ICONS[tool.tool_type] || TOOL_ICONS.other
            const Icon = meta.icon
            return (
              <div key={tool.id}
                className={`glass-card p-4 flex items-center gap-4 transition-all ${!tool.is_active ? 'opacity-50' : ''}`}>
                {/* أيقونة النوع */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.bg}`}>
                  <Icon size={18} className={meta.color} />
                </div>

                {/* المعلومات */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white text-sm">{meta.label}</span>
                    {tool.label && (
                      <span className="text-white/30 text-xs">— {tool.label}</span>
                    )}
                    {!tool.is_active && <span className="badge badge-red text-xs">موقوف</span>}
                  </div>
                  <p className="text-white/40 text-xs mt-0.5 truncate" dir="ltr">{tool.value}</p>
                </div>

                <span className="text-white/25 text-xs shrink-0">ترتيب: {tool.display_order}</span>

                {/* الأزرار */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleActive(tool)}
                    title={tool.is_active ? 'إيقاف' : 'تفعيل'}
                    className={`btn-ghost p-2 ${tool.is_active ? 'text-neon-cyan' : 'text-white/30'}`}>
                    {tool.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </button>
                  <button onClick={() => setModal({ tool })}
                    className="btn-ghost p-2 text-brand-blue">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => destroy(tool.id)}
                    className="btn-ghost p-2 text-brand-red/40 hover:text-brand-red">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal !== null && (
        <ToolModal
          tool={modal.tool}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
