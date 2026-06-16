import { useEffect, useState, useCallback } from 'react'
import {
  BookOpen, Plus, Loader2, X, GraduationCap, BookMarked, Filter, ArrowLeft, Pencil, Trash2
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axiosInstance'

/* ═══════════════════════════════════════════════════════════════════
   نافذة إنشاء/تعديل عامة (Generic Modal)
   ═══════════════════════════════════════════════════════════════════ */
function ItemModal({ title, fields, initialData = {}, endpoint, onClose, onSaved, method = 'POST' }) {
  const [form, setForm] = useState({ ...initialData })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [e.target.name]: val }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (method === 'PATCH') await api.patch(endpoint, form)
      else await api.post(endpoint, form)
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
          <h2 className="font-cairo font-bold text-white text-lg">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          {fields.map((f) => (
            <div key={f.name}>
              {f.type !== 'hidden' && (
                <label className="text-white/50 text-xs mb-1 block">{f.label}</label>
              )}
              {f.type === 'textarea' ? (
                <textarea name={f.name} value={form[f.name] || ''} onChange={handleChange}
                  rows={f.rows || 3} placeholder={f.placeholder || ''}
                  className="input-glass resize-none" />
              ) : f.type === 'select' ? (
                <select name={f.name} value={form[f.name] || ''} onChange={handleChange} className="input-glass">
                  {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'checkbox' ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input name={f.name} type="checkbox" checked={!!form[f.name]} onChange={handleChange}
                    className="w-4 h-4 accent-brand-blue" />
                  <span className="text-white/60 text-sm">{f.checkLabel}</span>
                </label>
              ) : f.type === 'hidden' ? null : (
                <input name={f.name} value={form[f.name] || ''} onChange={handleChange}
                  type={f.type || 'text'} required={f.required} placeholder={f.placeholder || ''}
                  className="input-glass" dir={f.ltr ? 'ltr' : undefined} />
              )}
            </div>
          ))}
          {error && <p className="text-brand-red text-xs bg-brand-red/10 rounded-xl p-3">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-5">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════════════
   الصفحة الرئيسية
   ═══════════════════════════════════════════════════════════════════ */
export default function LevelsGradesPage() {
  const [activeTab, setActiveTab] = useState('levels') // 'levels' | 'grades'
  const [activeSystemType, setActiveSystemType] = useState('online') // 'online' | 'flash'
  const [levels, setLevels] = useState([])
  const [grades, setGrades] = useState([])
  
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // 'level' | 'grade' | 'edit_level' | 'edit_grade'
  const [ctx, setCtx] = useState(null)
  const navigate = useNavigate()

  // فلاتر الفصول
  const [filterLevel, setFilterLevel] = useState('')

  const loadLevels = useCallback(() => {
    setLoading(true)
    api.get(`/academic/levels/?system_type=${activeSystemType}`)
      .then((res) => {
        setLevels(res.data.results || res.data)
      }).catch(console.error)
      .finally(() => setLoading(false))
  }, [activeSystemType])

  const loadGrades = useCallback(() => {
    setLoading(true)
    const params = { system_type: activeSystemType }
    if (filterLevel) params.level = filterLevel

    api.get('/academic/grades/', { params })
      .then((res) => {
        setGrades(res.data.results || res.data)
      }).catch(console.error)
      .finally(() => setLoading(false))
  }, [filterLevel, activeSystemType])

  useEffect(() => {
    if (activeTab === 'levels') loadLevels()
    else loadGrades()
  }, [activeTab, loadLevels, loadGrades])

  const handleDeleteLevel = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المرحلة؟ ستُحذف كل الفصول المرتبطة بها.')) return
    try {
      await api.delete(`/academic/levels/${id}/`)
      loadLevels()
    } catch (err) { alert('خطأ في الحذف، قد تكون مرتبطة ببيانات أخرى.') }
  }

  const handleDeleteGrade = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الفصل؟ ستُحذف كل الكورسات المرتبطة.')) return
    try {
      await api.delete(`/academic/grades/${id}/`)
      loadGrades()
    } catch (err) { alert('خطأ في الحذف، قد يكون مرتبطاً ببيانات أخرى.') }
  }

  const levelFields = [
    { name: 'name', label: 'اسم المرحلة *', required: true, placeholder: 'مثال: المرحلة الثانوية' },
    { name: 'description', label: 'وصف', type: 'textarea' },
    { name: 'system_type', label: 'نوع النظام', type: 'select', options: [{ value: 'online', label: 'أونلاين' }, { value: 'flash', label: 'فلاش / حضوري' }] },
    { name: 'display_order', label: 'الترتيب', type: 'number' },
  ]

  const gradeFields = [
    { name: 'name', label: 'اسم الفصل *', required: true, placeholder: 'مثال: الصف الأول' },
    { name: 'level', label: 'المرحلة *', type: 'select', options: [{ value: '', label: '— الأب —' }, ...levels.map(l => ({ value: l.id, label: l.name }))] },
    { name: 'system_type', label: 'نوع النظام', type: 'select', options: [{ value: 'online', label: 'أونلاين' }, { value: 'flash', label: 'فلاش / حضوري' }] },
    { name: 'display_order', label: 'الترتيب', type: 'number' },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
            <BookOpen size={20} className="text-brand-blue" /> المراحل والفصول
          </h1>
          <p className="text-white/30 text-xs mt-0.5">
            إدارة المراحل الدراسية والفصول التابعة لها
          </p>
        </div>
        {activeTab === 'levels' ? (
           <button onClick={() => setModal('level')} className="btn-primary">
             <Plus size={16} /> مرحلة جديدة
           </button>
        ) : (
           <button onClick={() => setModal('grade')} className="btn-primary">
             <Plus size={16} /> فصل جديد
           </button>
        )}
      </div>

      {/* Tabs / Filter Navigation */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex bg-dark-800 p-1 rounded-xl w-max border border-white/05">
          <button 
            onClick={() => setActiveTab('levels')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'levels' ? 'bg-brand-blue text-white shadow-md' : 'text-white/40 hover:text-white hover:bg-white/05'
            }`}
          >
            <GraduationCap size={16} /> المراحل
          </button>
          <button 
            onClick={() => setActiveTab('grades')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'grades' ? 'bg-brand-blue text-white shadow-md' : 'text-white/40 hover:text-white hover:bg-white/05'
            }`}
          >
            <BookMarked size={16} /> الفصول
          </button>
        </div>

        <div className="flex bg-dark-800 p-1 rounded-xl w-max border border-white/05">
           <button 
             onClick={() => setActiveSystemType('online')}
             className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
               activeSystemType === 'online' ? 'bg-white text-dark-900 shadow-md' : 'text-white/40 hover:text-white'
             }`}
           >
             أونلاين
           </button>
           <button 
             onClick={() => setActiveSystemType('flash')}
             className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
               activeSystemType === 'flash' ? 'bg-white text-dark-900 shadow-md' : 'text-white/40 hover:text-white'
             }`}
           >
             فلاش
           </button>
        </div>
      </div>

      {/* المحتوى حسب التبويب */}
      {activeTab === 'levels' && (
        <div className="space-y-3">
           {loading ? (
             <div className="py-16 text-center">
               <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
             </div>
           ) : levels.length === 0 ? (
             <div className="glass-card p-12 text-center text-white/30">
               <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
               <p>لا توجد مراحل مسجلة. أضف مرحلة جديدة.</p>
             </div>
           ) : (
             levels.map((level) => (
                <div key={level.id} className="glass-card flex items-center p-4">
                   <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-red/20 to-brand-blue/10 flex items-center justify-center shrink-0 ml-3">
                     <GraduationCap size={18} className="text-brand-blue" />
                   </div>
                   <div className="flex-1 min-w-0">
                     <h3 className="font-cairo font-bold text-white mb-1 flex items-center gap-2">
                        {level.name}
                        <span className={`badge text-[10px] ${level.system_type === 'online' ? 'bg-brand-blue/20 text-brand-blue' : 'bg-purple-500/20 text-purple-400'}`}>
                           {level.system_type === 'online' ? 'أونلاين' : 'فلاش'}
                        </span>
                     </h3>
                     {level.description && (
                       <p className="text-white/40 text-xs truncate">{level.description}</p>
                     )}
                   </div>
                   <div className="flex items-center gap-2 shrink-0">
                      <span className="badge badge-blue">مرتبة: {level.display_order}</span>
                      <button onClick={() => { setCtx(level); setModal('edit_level'); }} className="btn-ghost p-1.5 text-white/50 hover:text-brand-blue" title="تعديل">
                         <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDeleteLevel(level.id)} className="btn-ghost p-1.5 text-white/50 hover:text-brand-red" title="حذف">
                         <Trash2 size={14} />
                      </button>
                   </div>
                </div>
             ))
           )}
        </div>
      )}

      {activeTab === 'grades' && (
         <div className="space-y-4">
            {/* الفلترة للفصول */}
            <div className="glass-card p-3 flex flex-wrap items-center gap-3">
               <div className="flex items-center gap-2 text-white/50 text-sm">
                  <Filter size={16} /> تصفية:
               </div>
               <select
                 value={filterLevel}
                 onChange={(e) => setFilterLevel(e.target.value)}
                 className="input-glass min-w-[200px]"
                 title="اختر المرحلة"
               >
                 <option value="">-- كل المراحل --</option>
                 {levels.map(l => (
                   <option key={l.id} value={l.id}>{l.name}</option>
                 ))}
               </select>
            </div>

            {loading ? (
             <div className="py-16 text-center">
               <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
             </div>
           ) : grades.length === 0 ? (
             <div className="glass-card p-12 text-center text-white/30">
               <BookMarked size={40} className="mx-auto mb-3 opacity-30" />
               <p>لا توجد فصول متطابقة.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {grades.map((grade) => (
                   <div key={grade.id} className="glass-card p-4 space-y-4 hover:-translate-y-1 transition-transform">
                      <div className="flex items-start justify-between gap-3">
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-dark-700 border border-white/05 flex items-center justify-center shrink-0">
                             <BookOpen size={16} className="text-white/70" />
                           </div>
                           <div>
                             <h3 className="font-cairo font-bold text-white text-sm flex items-center gap-2">
                                {grade.name}
                                <span className={`badge text-[10px] ${grade.system_type === 'online' ? 'bg-brand-blue/20 text-brand-blue' : 'bg-purple-500/20 text-purple-400'}`}>
                                   {grade.system_type === 'online' ? 'أونلاين' : 'فلاش'}
                                </span>
                             </h3>
                             <p className="text-brand-blue/70 text-xs">{grade.level_name || 'بدون مرحلة'}</p>
                           </div>
                         </div>
                         
                         <div className="flex flex-col gap-1 shrink-0">
                            <button onClick={() => { setCtx(grade); setModal('edit_grade'); }} className="btn-ghost p-1 hover:text-brand-blue" title="تعديل">
                               <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDeleteGrade(grade.id)} className="btn-ghost p-1 hover:text-brand-red" title="حذف">
                               <Trash2 size={14} />
                            </button>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-2 pt-2 border-t border-white/05">
                         <span className="text-white/40 text-xs">الكورسات المرتبطة: {grade.courses?.length || 0}</span>
                         <button 
                           onClick={() => navigate(`/dashboard/academic/grades/${grade.id}`)}
                           className="btn-ghost mr-auto text-xs text-brand-blue py-1 px-2 border border-brand-blue/30 rounded flex items-center gap-1"
                         >
                            التفاصيل <ArrowLeft size={10} />
                         </button>
                      </div>
                   </div>
                ))}
             </div>
           )}
         </div>
      )}

      {modal === 'level' && (
        <ItemModal
          title="مرحلة جديدة"
          fields={levelFields}
          initialData={{ display_order: levels.length, system_type: activeSystemType }}
          endpoint="/academic/levels/"
          onClose={() => setModal(null)}
          onSaved={loadLevels}
        />
      )}

      {modal === 'edit_level' && ctx && (
        <ItemModal
          title="تعديل المرحلة"
          fields={levelFields}
          initialData={ctx}
          endpoint={`/academic/levels/${ctx.id}/`}
          method="PATCH"
          onClose={() => { setModal(null); setCtx(null); }}
          onSaved={loadLevels}
        />
      )}

      {modal === 'grade' && (
        <ItemModal
          title="فصل جديد"
          fields={gradeFields}
          initialData={{ display_order: 0, level: filterLevel, system_type: activeSystemType }}
          endpoint="/academic/grades/"
          onClose={() => setModal(null)}
          onSaved={loadGrades}
          method="POST"
        />
      )}

      {modal === 'edit_grade' && ctx && (
        <ItemModal
          title="تعديل الفصل"
          fields={gradeFields}
          initialData={ctx}
          endpoint={`/academic/grades/${ctx.id}/`}
          method="PATCH"
          onClose={() => { setModal(null); setCtx(null); }}
          onSaved={loadGrades}
        />
      )}
    </div>
  )
}
