import { useEffect, useState, useCallback } from 'react'
import {
  BookOpen, Plus, ChevronDown, ChevronLeft, Loader2,
  X, Settings2, ArrowLeft, BookMarked, GraduationCap, Trash2
} from 'lucide-react'
import api from '../../api/axiosInstance'
import { useNavigate } from 'react-router-dom'
import Pagination from '../../components/ui/Pagination'

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
   بطاقة كورس (مع زر إدارة)
   ═══════════════════════════════════════════════════════════════════ */
function CourseCard({ course, onManage }) {
  return (
    <div className="glass-card p-3 flex items-center gap-3 bg-dark-800/40">
      {course.thumbnail && (
        <img src={`/media/${course.thumbnail}`} alt=""
          className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/10" />
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-cairo font-bold text-white text-sm truncate flex items-center justify-between">
          <span>{course.name}</span>
          <span className={`badge text-[10px] shrink-0 ${course.system_type === 'online' ? 'bg-brand-blue/20 text-brand-blue' : 'bg-purple-500/20 text-purple-400'}`}>
             {course.system_type === 'online' ? 'أونلاين' : 'فلاش'}
          </span>
        </h4>
        {course.teacher_name && (
          <p className="text-white/35 text-xs flex items-center gap-1 mt-0.5">
            <GraduationCap size={10} /> {course.teacher_name}
          </p>
        )}
      </div>
      <span className={`badge text-[10px] shrink-0 ${course.is_active ? 'badge-green' : 'badge-red'}`}>
        {course.is_active ? 'نشط' : 'موقوف'}
      </span>
      <button onClick={() => onManage(course)}
        className="btn-ghost border border-brand-blue/30 text-brand-blue hover:bg-brand-blue/10 py-1 px-3 text-xs shrink-0 flex items-center gap-1 rounded-md">
        التفاصيل <ArrowLeft size={12} />
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   الصفحة الرئيسية للكورسات والوحدات
   ═══════════════════════════════════════════════════════════════════ */
export default function CoursesUnitsPage() {
  const navigate = useNavigate()
  const [grades, setGrades] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState({})
  const [modal, setModal] = useState(null)
  const [ctx, setCtx] = useState(null)
  const [activeSystemType, setActiveSystemType] = useState('online')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/academic/grades/', { params: { system_type: activeSystemType, page } }),
      api.get('/teachers/').catch(() => ({ data: [] })),
    ]).then(([gRes, tRes]) => {
      setGrades(gRes.data.results || gRes.data)
      setTotalCount(gRes.data.count || 0)
      const rawTeachers = tRes.data.results || tRes.data
      setTeachers(rawTeachers.map(t => ({
        id: t.id,
        full_name: t.user?.full_name || `أستاذ #${t.id}`,
      })))
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [activeSystemType, page])

  useEffect(() => { load() }, [load])
  
  // Reset page when system type changes
  useEffect(() => { setPage(1) }, [activeSystemType])

  const toggleGrade = (id) => setOpen(o => ({ ...o, [id]: !o[id] }))

  const courseFields = [
    { name: 'name', label: 'اسم الكورس *', required: true },
    { name: 'description', label: 'وصف', type: 'textarea' },
    {
      name: 'teacher', label: 'الأستاذ', type: 'select',
      options: [{ value: '', label: '— بدون —' },
      ...teachers.map(t => ({ value: t.id, label: t.full_name }))]
    },
    { name: 'system_type', label: 'نوع النظام', type: 'select', options: [{ value: 'online', label: 'أونلاين' }, { value: 'flash', label: 'فلاش / حضوري' }] },
    { name: 'display_order', label: 'الترتيب', type: 'number' },
    { name: 'is_active', type: 'checkbox', checkLabel: 'نشط', label: '' },
    { name: 'grade', type: 'hidden', label: '' },
  ]


  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
            <BookMarked size={20} className="text-brand-blue" /> الكورسات والوحدات
          </h1>
          <p className="text-white/30 text-xs mt-0.5">
            إدارة الكورسات داخل الفصول وبناء الوحدات الدراسية
          </p>
        </div>

        <div className="flex items-center gap-2 bg-dark-800 p-1 rounded-xl border border-white/05">
          <button
            onClick={() => setActiveSystemType('online')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeSystemType === 'online' ? 'bg-white text-dark-900 shadow-md' : 'text-white/40 hover:text-white'
              }`}
          >
            أونلاين
          </button>
          <button
            onClick={() => setActiveSystemType('flash')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeSystemType === 'flash' ? 'bg-white text-dark-900 shadow-md' : 'text-white/40 hover:text-white'
              }`}
          >
            فلاش
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
        </div>
      ) : grades.length === 0 ? (
        <div className="glass-card p-12 text-center text-white/30">
          <p>يرجى إنشاء بعض الفصول أولاً من صفحة المراحل والفصول.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grades.map((grade) => (
            <div key={grade.id} className="glass-card overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <button onClick={() => toggleGrade(grade.id)}
                  className="flex-1 flex items-center gap-3 text-right">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-dark-700 to-dark-600 flex items-center justify-center shrink-0">
                    <BookOpen size={16} className="text-white/70" />
                  </div>
                  <div>
                    <h3 className="font-cairo font-bold text-white flex items-center gap-2">
                      {grade.name}
                      <span className={`badge text-[10px] ${grade.system_type === 'online' ? 'bg-brand-blue/20 text-brand-blue' : 'bg-purple-500/20 text-purple-400'}`}>
                         {grade.system_type === 'online' ? 'أونلاين' : 'فلاش'}
                      </span>
                    </h3>
                    <p className="text-white/40 text-xs">{grade.level_name || 'فصل دراسي'}</p>
                  </div>
                  <span className="text-white/30 text-xs mr-2">{grade.courses?.length || 0} كورس</span>
                  {open[grade.id]
                    ? <ChevronDown size={16} className="text-white/40 mr-auto" />
                    : <ChevronLeft size={16} className="text-white/40 mr-auto" />
                  }
                </button>
                <button onClick={() => { setCtx({ gradeId: grade.id }); setModal('course') }}
                  className="btn-ghost p-2 text-brand-blue text-xs flex items-center gap-1 shrink-0">
                  <Plus size={13} /> إدراج كورس
                </button>
              </div>

              {open[grade.id] && (
                <div className="border-t border-white/08 p-3 space-y-2">
                  {grade.courses?.length === 0 ? (
                    <p className="text-white/25 text-xs text-center py-3">لا توجد كورسات في هذا الفصل</p>
                  ) : (
                    grade.courses?.map(c => (
                      <CourseCard key={c.id} course={c} onManage={(c) => navigate(`/dashboard/academic/courses/${c.id}`)} />
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
          <Pagination count={totalCount} currentPage={page} onPageChange={setPage} />
        </div>
      )}

      {modal === 'course' && ctx?.gradeId && (
        <ItemModal
          title="كورس جديد"
          fields={courseFields}
          initialData={{ grade: ctx.gradeId, is_active: true, display_order: 0, system_type: activeSystemType }}
          endpoint="/academic/courses/"
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
