import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BookOpen, Plus, Loader2, X, GraduationCap, ArrowLeft, Pencil, Trash2, BookMarked, Settings2
} from 'lucide-react'
import api from '../../api/axiosInstance'
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
   تفاصيل الكورس ووحداته
   ═══════════════════════════════════════════════════════════════════ */
export default function CourseDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [course, setCourse] = useState(null)
  const [units, setUnits] = useState([])
  const [teachers, setTeachers] = useState([])

  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // 'edit_course' | 'unit'
  const [ctx, setCtx] = useState(null)

  const [page, setPage] = useState(1)
  const [totalUnits, setTotalUnits] = useState(0)

  const loadDetails = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get(`/academic/courses/${id}/`),
      api.get('/academic/units/', { params: { course: id, page } }),
      api.get('/teachers/').catch(() => ({ data: [] }))
    ]).then(([cRes, uRes, tRes]) => {
      setCourse(cRes.data)
      setUnits(uRes.data.results || uRes.data)
      setTotalUnits(uRes.data.count || 0)

      const rawTeachers = tRes.data.results || tRes.data
      setTeachers(rawTeachers.map(t => ({
        id: t.id,
        full_name: t.user?.full_name || `أستاذ #${t.id}`,
      })))
    }).catch((err) => {
      console.error(err)
      if (err.response?.status === 404) navigate('/dashboard/academic/courses')
    }).finally(() => setLoading(false))
  }, [id, navigate, page])

  useEffect(() => { loadDetails() }, [loadDetails])

  const handleDeleteCourse = async () => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الكورس؟ ستُحذف كافة الوحدات والمحاضرات المرتبطة.')) return;
    try {
      await api.delete(`/academic/courses/${course.id}/`)
      navigate(-1) // العودة للصفحة السابقة
    } catch (err) { alert('خطأ في الحذف.') }
  }

  const deleteUnit = async (unitId) => {
    if (!window.confirm('حذف الوحدة؟ ستُحذف كل المحاضرات التابعة لها أيضاً.')) return
    try {
      await api.delete(`/academic/units/${unitId}/`)
      loadDetails()
    } catch (err) { alert('خطأ في الحذف.') }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-blue" />
      </div>
    )
  }

  if (!course) return null // Handled in catch block

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

  const unitFields = [
    { name: 'name', label: 'اسم الوحدة *', required: true, placeholder: 'مثال: الوحدة الأولى' },
    { name: 'description', label: 'وصف', type: 'textarea', placeholder: 'وصف موجز...' },
    { name: 'display_order', label: 'الترتيب', type: 'number' },
    { name: 'course', label: '', type: 'hidden' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2 hover:bg-white/05 rounded-lg text-white/50">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
            استوديو إدارة الكورس
          </h1>
          <p className="text-white/30 text-xs mt-0.5">تفاصيل الكورس ووحداته</p>
        </div>
      </div>

      {/* Course Information Card */}
      <div className="glass-card flex items-start md:items-center justify-between p-6 flex-col md:flex-row gap-4 border border-brand-blue/10">
        <div className="flex items-center gap-4">
          {course.thumbnail ? (
            <img src={course.thumbnail} alt="" className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-white/10" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-dark-700 border border-white/05 flex items-center justify-center shrink-0">
              <Settings2 size={24} className="text-brand-blue" />
            </div>
          )}
          <div>
            <h1 className="font-cairo font-bold text-white text-2xl mb-1 flex items-center gap-2">
              {course.name}
              <span className={`badge text-xs ${course.system_type === 'online' ? 'bg-brand-blue/20 text-brand-blue' : 'bg-purple-500/20 text-purple-400'}`}>
                {course.system_type === 'online' ? 'أونلاين' : 'فلاش'}
              </span>
              <span className={`badge text-[10px] ${course.is_active ? 'badge-green' : 'badge-red'}`}>
                {course.is_active ? 'نشط' : 'موقوف'}
              </span>
            </h1>
            <div className="flex items-center gap-3 text-sm">
              <p className="text-white/50 flex items-center gap-1.5"><GraduationCap size={14} className="text-brand-blue/70" /> {course.teacher_name || 'بدون أستاذ'}</p>
              <span className="text-white/20">•</span>
              <p className="text-white/50 flex items-center gap-1.5"><BookOpen size={14} className="text-brand-blue/70" /> {course.grade_name || 'بدون فصل'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto mt-4 md:mt-0">
          <button onClick={() => setModal('edit_course')} className="btn-secondary flex-1 md:flex-none justify-center">
            <Pencil size={14} className="mr-1" /> تعديل
          </button>
          <button onClick={handleDeleteCourse} className="btn-secondary flex-1 md:flex-none justify-center bg-brand-red/10 text-brand-red hover:bg-brand-red/20 border-brand-red/20">
            <Trash2 size={14} className="mr-1" /> حذف
          </button>
        </div>
      </div>

      {/* Units Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="font-cairo font-bold text-white text-lg flex items-center gap-2">
            <BookMarked size={18} className="text-brand-blue" /> وحدات الكورس
          </h2>
          <button onClick={() => setModal('unit')} className="btn-primary py-1.5 px-4 text-sm">
            <Plus size={14} /> وحدة جديدة
          </button>
        </div>

        {units.length === 0 ? (
          <div className="glass-card p-10 text-center text-white/30">
            <BookMarked size={36} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد وحدات. أضف وحدة أولى لهذا الكورس.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {units.map((unit) => (
              <div key={unit.id} className="glass-card overflow-hidden">
                <div className="flex items-center gap-2 p-3.5">
                  <div className="flex-1 flex items-center gap-3 text-right">
                    <div className="w-8 h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0">
                      <BookMarked size={14} className="text-brand-blue" />
                    </div>
                    <span className="font-cairo font-semibold text-white truncate">{unit.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(`/dashboard/academic/units/${unit.id}`)}
                      className="btn-ghost border border-brand-blue/30 text-brand-blue hover:bg-brand-blue/10 py-1 px-3 text-[10px] sm:text-xs shrink-0 flex items-center gap-1 rounded-md"
                    >
                      التفاصيل <ArrowLeft size={12} />
                    </button>
                    <button onClick={() => deleteUnit(unit.id)}
                      className="btn-ghost p-1.5 text-brand-red hover:bg-brand-red/10 rounded-md">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination count={totalUnits} currentPage={page} onPageChange={setPage} />
      </div>

      {/* Modals */}
      {modal === 'edit_course' && (
        <ItemModal
          title="تعديل الكورس"
          fields={courseFields}
          initialData={{
            ...course,
            teacher: course.teacher || '',
            grade: course.grade || '',
          }}
          endpoint={`/academic/courses/${course.id}/`}
          method="PATCH"
          onClose={() => setModal(null)}
          onSaved={loadDetails}
        />
      )}

      {modal === 'unit' && (
        <ItemModal
          title={`وحدة جديدة — ${course.name}`}
          fields={unitFields}
          initialData={{ course: course.id, display_order: units.length }}
          endpoint="/academic/units/"
          onClose={() => setModal(null)}
          onSaved={loadDetails}
        />
      )}
    </div>
  )
}
