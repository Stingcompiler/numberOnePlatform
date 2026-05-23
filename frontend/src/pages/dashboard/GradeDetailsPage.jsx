import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BookOpen, BookMarked, ArrowLeft, Loader2, GraduationCap, Link, Plus, X, Edit, Trash2 } from 'lucide-react'
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


export default function GradeDetailsPage() {
  const { id } = useParams()
  const [grade, setGrade] = useState(null)
  const [courses, setCourses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [editCourse, setEditCourse] = useState(null)
  const navigate = useNavigate()

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الكورس؟")) return
    try {
      await api.delete(`/academic/courses/${courseId}/`)
      loadDetails()
    } catch (err) {
      alert("حدث خطأ أثناء الحذف.")
    }
  }
  
  const [page, setPage] = useState(1)
  const [totalCourses, setTotalCourses] = useState(0)

  const loadDetails = useCallback(() => {
    setLoading(true)
    setError(null)
    
    // Fetch grade details, courses belonging to this grade, and teachers
    Promise.all([
      api.get(`/academic/grades/${id}/`),
      api.get('/academic/courses/', { params: { grade: id, page } }),
      api.get('/teachers/').catch(() => ({ data: [] }))
    ]).then(([gradeRes, coursesRes, tRes]) => {
      setGrade(gradeRes.data)
      setCourses(coursesRes.data.results || coursesRes.data)
      setTotalCourses(coursesRes.data.count || 0)
      const rawTeachers = tRes.data.results || tRes.data
      setTeachers(rawTeachers.map(t => ({
        id: t.id,
        full_name: t.user?.full_name || `أستاذ #${t.id}`,
      })))
    }).catch(err => {
      console.error(err)
      setError("حدث خطأ في تحميل تفاصيل الفصل.")
    }).finally(() => {
      setLoading(false)
    })
  }, [id, page])

  useEffect(() => { loadDetails() }, [loadDetails])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-brand-blue" />
      </div>
    )
  }

  if (error || !grade) {
    return (
      <div className="glass-card p-12 text-center text-white/30 space-y-4">
        <p className="text-brand-red">{error || 'لم يتم العثور على الفصل.'}</p>
        <button onClick={() => navigate('/dashboard/academic/levels')} className="btn-secondary mx-auto">
          العودة للمراحل والفصول
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Back Button */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => navigate('/dashboard/academic/levels')}
          className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft size={16} /> العودة للاستكشاف
        </button>
      </div>

      {/* Grade Information Card */}
      <div className="glass-card flex items-start md:items-center justify-between p-6 flex-col md:flex-row gap-4 border border-brand-blue/10">
         <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-dark-700 border border-white/05 flex items-center justify-center shrink-0">
               <BookOpen size={24} className="text-brand-blue" />
            </div>
            <div>
               <h1 className="font-cairo font-bold text-white text-2xl mb-1 flex items-center gap-2">
                  {grade.name}
                  <span className={`badge text-xs ${grade.system_type === 'online' ? 'bg-brand-blue/20 text-brand-blue' : 'bg-purple-500/20 text-purple-400'}`}>
                     {grade.system_type === 'online' ? 'أونلاين' : 'فلاش'}
                  </span>
               </h1>
               <p className="text-brand-blue/70 text-sm flex items-center gap-1.5">
                 <GraduationCap size={14} /> {grade.level_name || 'بدون مرحلة'}
               </p>
            </div>
         </div>
         <div className="flex items-center gap-2 text-white/40 text-sm">
            المرتبة (الترتيب): <span className="text-white bg-white/10 px-2 py-0.5 rounded">{grade.display_order}</span>
         </div>
      </div>

      {/* Associated Courses */}
      <div className="space-y-4">
         <div className="flex items-center justify-between">
            <h2 className="font-cairo font-bold text-white text-lg flex items-center gap-2">
               <BookMarked size={18} className="text-brand-blue" /> الكورسات المرتبطة ({courses.length})
            </h2>
            <div className="flex items-center gap-2">
               <button 
                 onClick={() => setModal('course')} 
                 className="btn-primary text-xs flex items-center gap-1"
               >
                  إضافة كورس <Plus size={12} />
               </button>
               <button 
                 onClick={() => navigate('/dashboard/academic/courses')} 
                 className="btn-ghost text-brand-blue text-xs flex items-center gap-1 ml-2 border border-brand-blue/30 px-2 py-1 rounded"
               >
                  مدير الكورسات <Link size={12} />
               </button>
            </div>
         </div>

         {courses.length === 0 ? (
            <div className="glass-card p-10 text-center text-white/30">
               <BookMarked size={36} className="mx-auto mb-3 opacity-30" />
               <p>لا توجد كورسات مرتبطة بهذا الفصل.</p>
               <button 
                  onClick={() => setModal('course')}
                  className="btn-primary mt-4 mx-auto text-sm"
               >
                  <Plus size={16} /> إضافة كورس
               </button>
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {courses.map((c) => (
                  <div key={c.id} className="glass-card p-4 flex flex-col gap-3">
                     <div className="flex items-center gap-3">
                        {c.thumbnail ? (
                           <img src={c.thumbnail} alt="" className="w-12 h-12 rounded-xl object-cover" />
                        ) : (
                           <div className="w-12 h-12 rounded-xl bg-dark-700 flex items-center justify-center shrink-0">
                              <BookMarked size={20} className="text-white/30" />
                           </div>
                        )}
                        <div className="min-w-0 flex-1">
                           <h3 className="font-cairo font-bold text-white text-sm truncate flex items-center justify-between">
                              <span>{c.name}</span>
                              <span className={`badge text-[10px] shrink-0 ${c.system_type === 'online' ? 'bg-brand-blue/20 text-brand-blue' : 'bg-purple-500/20 text-purple-400'}`}>
                                 {c.system_type === 'online' ? 'أونلاين' : 'فلاش'}
                              </span>
                           </h3>
                           <p className="text-white/40 text-xs truncate mt-0.5">{c.teacher_name || 'بدون أستاذ'}</p>
                        </div>
                     </div>
                     <div className="mt-auto pt-3 border-t border-white/05 flex items-center justify-between gap-2">
                        <span className={`badge text-xs ${c.is_active ? 'badge-green' : 'badge-red'}`}>
                          {c.is_active ? 'نشط' : 'موقوف'}
                        </span>
                        <div className="flex items-center gap-1">
                           <button 
                              onClick={() => setEditCourse(c)}
                              className="btn-ghost text-brand-blue hover:bg-brand-blue/10 p-1.5 rounded-md"
                              title="تعديل"
                           >
                              <Edit size={14} />
                           </button>
                           <button 
                              onClick={() => handleDeleteCourse(c.id)}
                              className="btn-ghost text-brand-red hover:bg-brand-red/10 p-1.5 rounded-md"
                              title="حذف"
                           >
                              <Trash2 size={14} />
                           </button>
                           <button 
                              onClick={() => navigate(`/dashboard/academic/courses/${c.id}`)}
                              className="btn-ghost border border-brand-blue/30 text-brand-blue hover:bg-brand-blue/10 py-1 px-3 text-[10px] sm:text-xs shrink-0 flex items-center gap-1 rounded-md mr-1"
                           >
                              التفاصيل <ArrowLeft size={12} />
                           </button>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         )}
         <Pagination count={totalCourses} currentPage={page} onPageChange={setPage} />
      </div>

      {modal === 'course' && (
        <ItemModal
          title={`كورس جديد — ${grade?.name}`}
          fields={[
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
          ]}
          initialData={{ grade: grade?.id, is_active: true, display_order: 0, system_type: grade?.system_type || 'online' }}
          endpoint="/academic/courses/"
          onClose={() => setModal(null)}
          onSaved={loadDetails}
        />
      )}

      {editCourse && (
        <ItemModal
          title={`تعديل كورس — ${editCourse.name}`}
          method="PATCH"
          fields={[
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
          ]}
          initialData={{
             name: editCourse.name,
             description: editCourse.description || '',
             teacher: editCourse.teacher || '',
             system_type: editCourse.system_type || 'online',
             display_order: editCourse.display_order || 0,
             is_active: editCourse.is_active,
          }}
          endpoint={`/academic/courses/${editCourse.id}/`}
          onClose={() => setEditCourse(null)}
          onSaved={loadDetails}
        />
      )}
    </div>
  )
}
