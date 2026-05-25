import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BookMarked, Plus, Loader2, X, ArrowLeft, Pencil, Trash2,
  Play, FileText, ClipboardList
} from 'lucide-react'
import api from '../../api/axiosInstance'
import Pagination from '../../components/ui/Pagination'

/* ═══════════════════════════════════════════════════════════════════
   Generic Modal — supports text, textarea, select, checkbox, file
   ═══════════════════════════════════════════════════════════════════ */
function ItemModal({ title, fields, initialData = {}, endpoint, onClose, onSaved, method = 'POST' }) {
  const [form, setForm]   = useState({ ...initialData })
  const [files, setFiles] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleChange = (e) => {
    if (e.target.type === 'file') {
      setFiles(f => ({ ...f, [e.target.name]: e.target.files[0] }))
    } else {
      const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm(f => ({ ...f, [e.target.name]: val }))
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const hasFiles = Object.keys(files).length > 0
      let payload
      if (hasFiles) {
        payload = new FormData()
        Object.entries(form).forEach(([k, v]) => {
          if (v !== '' && v !== null && v !== undefined) payload.append(k, v)
        })
        Object.entries(files).forEach(([k, v]) => { if (v) payload.append(k, v) })
      } else {
        payload = form
      }
      if (method === 'PATCH') await api.patch(endpoint, payload)
      else await api.post(endpoint, payload)
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
              ) : f.type === 'file' ? (
                <input name={f.name} type="file" accept={f.accept || '*'} onChange={handleChange}
                  className="input-glass text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-brand-blue/20 file:text-brand-blue" />
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
   YouTube Player
   ═══════════════════════════════════════════════════════════════════ */
function YouTubePlayer({ url, title }) {
  if (!url) return null
  return (
    <div className="relative rounded-xl overflow-hidden bg-dark-700 mb-3" style={{ paddingBottom: '56.25%' }}>
      <iframe
        className="absolute inset-0 w-full h-full rounded-xl"
        src={url}
        title={title || 'درس'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   ExerciseManager Modal
   ═══════════════════════════════════════════════════════════════════ */
function ExerciseManager({ lessonId, lessonTitle, exerciseData, onClose, onSaved }) {
  const [exercise, setExercise] = useState(exerciseData || null)
  const [questions, setQuestions] = useState(exerciseData?.questions || [])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // New question state
  const [showNewQ, setShowNewQ] = useState(false)
  const [newQ, setNewQ]         = useState({ text: '', marks: 1 })
  const [newChoices, setNewChoices] = useState([
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ])

  const createExercise = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/academic/exercises/', {
        lesson: lessonId,
        title: `تمرين: ${lessonTitle}`,
        pass_percentage: 60,
      })
      setExercise(res.data)
      setQuestions([])
      onSaved()
    } catch (err) {
      const d = err.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'خطأ في إنشاء التمرين')
    } finally { setLoading(false) }
  }

  const addQuestion = async () => {
    if (!newQ.text.trim()) return
    setLoading(true)
    try {
      const { data: qData } = await api.post(`/academic/exercises/${exercise.id}/questions/`, {
        text: newQ.text,
        marks: parseInt(newQ.marks) || 1,
      })
      for (const ch of newChoices) {
        if (ch.text.trim()) {
          await api.post(`/academic/questions/${qData.id}/choices/`, ch)
        }
      }
      const { data: exData } = await api.get(`/academic/exercises/${exercise.id}/`)
      setQuestions(exData.questions || [])
      setShowNewQ(false)
      setNewQ({ text: '', marks: 1 })
      setNewChoices([{ text: '', is_correct: false }, { text: '', is_correct: false }])
      onSaved()
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
      <div className="glass-card-strong w-full max-w-2xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-cairo font-bold text-white text-lg flex items-center gap-2">
            <ClipboardList size={18} className="text-brand-blue" />
            إدارة التمرين <span className="text-brand-blue text-sm">({lessonTitle})</span>
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>

        {error && <p className="text-brand-red text-sm mb-4 bg-brand-red/10 p-3 rounded-lg">{error}</p>}

        {!exercise ? (
          <div className="text-center py-10">
            <p className="text-white/40 mb-4">لا يوجد تمرين مرتبط بهذه المحاضرة بعد.</p>
            <button onClick={createExercise} disabled={loading} className="btn-primary mx-auto">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              إنشاء تمرين الآن
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Exercise info */}
            <div className="glass-card p-4 border border-brand-blue/10 bg-brand-blue/5">
              <h3 className="text-white font-bold text-sm mb-1">{exercise.title}</h3>
              <p className="text-white/50 text-xs">نسبة النجاح: {exercise.pass_percentage}% · {questions.length} سؤال</p>
            </div>

            {/* Questions list */}
            <div className="space-y-2">
              {questions.map((q, qi) => (
                <div key={q.id} className="glass-card p-3 space-y-2">
                  <p className="text-white text-sm font-medium flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-brand-blue/15 flex items-center justify-center text-brand-blue text-xs shrink-0">{qi + 1}</span>
                    {q.text}
                    <span className="text-white/30 text-xs mr-auto">{q.marks} درجة</span>
                  </p>
                  <div className="space-y-1 pr-7">
                    {q.choices?.map((c) => (
                      <div key={c.id} className={`flex items-center gap-2 text-xs px-2 py-1 rounded-lg ${c.is_correct ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20' : 'text-white/40'}`}>
                        <div className={`w-3 h-3 rounded-full border ${c.is_correct ? 'bg-neon-cyan border-neon-cyan' : 'border-white/20'} shrink-0`} />
                        {c.text}
                        {c.is_correct && <span className="mr-auto font-medium">✓ صحيحة</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Add question */}
            {showNewQ ? (
              <div className="glass-card p-4 space-y-3 border border-brand-blue/20">
                <div>
                  <label className="text-white/50 text-xs mb-1 block">نص السؤال *</label>
                  <input value={newQ.text} onChange={e => setNewQ(q => ({ ...q, text: e.target.value }))}
                    placeholder="اكتب السؤال هنا..." className="input-glass" />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1 block">الدرجة</label>
                  <input type="number" min="1" value={newQ.marks}
                    onChange={e => setNewQ(q => ({ ...q, marks: e.target.value }))}
                    className="input-glass w-24 text-sm" />
                </div>
                <div className="space-y-2">
                  <label className="text-white/50 text-xs block">الخيارات</label>
                  {newChoices.map((ch, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      <input type="checkbox" checked={ch.is_correct}
                        onChange={e => setNewChoices(cs => cs.map((c, i) => i === ci ? { ...c, is_correct: e.target.checked } : c))}
                        className="w-4 h-4 accent-neon-cyan shrink-0" />
                      <input value={ch.text}
                        onChange={e => setNewChoices(cs => cs.map((c, i) => i === ci ? { ...c, text: e.target.value } : c))}
                        placeholder={`الخيار ${ci + 1}`} className="input-glass flex-1 text-sm" />
                      {newChoices.length > 2 && (
                        <button onClick={() => setNewChoices(cs => cs.filter((_, i) => i !== ci))}
                          className="btn-ghost p-1 text-brand-red/50 hover:text-brand-red shrink-0"><X size={13} /></button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setNewChoices(cs => [...cs, { text: '', is_correct: false }])}
                    className="btn-ghost text-xs text-brand-blue flex items-center gap-1 p-1">
                    <Plus size={11} /> خيار آخر
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={addQuestion} disabled={loading} className="btn-primary text-sm px-4">
                    {loading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    حفظ السؤال
                  </button>
                  <button onClick={() => setShowNewQ(false)} className="btn-secondary text-sm px-3">إلغاء</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowNewQ(true)}
                className="btn-ghost text-xs text-brand-blue flex items-center gap-1 w-full justify-center py-2 border border-dashed border-white/10 rounded-xl hover:border-brand-blue/30">
                <Plus size={12} /> إضافة سؤال
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   UnitDetailsPage
   ═══════════════════════════════════════════════════════════════════ */
export default function UnitDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [unit, setUnit]   = useState(null)
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null) // 'edit_unit' | 'lesson'
  const [editLesson, setEditLesson]       = useState(null)
  const [manageExercise, setManageExercise] = useState(null)
  const [page, setPage]     = useState(1)
  const [totalLessons, setTotalLessons] = useState(0)

  const loadDetails = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get(`/academic/units/${id}/`),
      api.get('/academic/lessons/', { params: { unit: id, page } })
    ]).then(async ([uRes, lRes]) => {
      setUnit(uRes.data)
      const basicList = lRes.data.results || lRes.data
      setTotalLessons(lRes.data.count || 0)
      // Fetch full lesson detail (includes exercise + youtube_embed_url)
      const detailed = await Promise.all(
        basicList.map(l => api.get(`/academic/lessons/${l.id}/`).then(r => r.data))
      )
      setLessons(detailed)
    }).catch((err) => {
      console.error(err)
      if (err.response?.status === 404) navigate('/dashboard/academic/courses')
    }).finally(() => setLoading(false))
  }, [id, navigate, page])

  useEffect(() => { loadDetails() }, [loadDetails])

  const handleDeleteUnit = async () => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الوحدة؟ ستُحذف كافة المحاضرات.')) return
    try {
      await api.delete(`/academic/units/${unit.id}/`)
      navigate(-1)
    } catch { alert('خطأ في الحذف.') }
  }

  const deleteLesson = async (lessonId) => {
    if (!window.confirm('حذف المحاضرة؟ سيُحذف التمرين المرتبط أيضاً.')) return
    try {
      await api.delete(`/academic/lessons/${lessonId}/`)
      loadDetails()
    } catch { alert('خطأ في الحذف.') }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-brand-blue" /></div>
  }
  if (!unit) return null

  const unitFields = [
    { name: 'name', label: 'اسم الوحدة *', required: true, placeholder: 'مثال: الوحدة الأولى' },
    { name: 'display_order', label: 'الترتيب', type: 'number' },
    { name: 'course', label: '', type: 'hidden' },
  ]

  const lessonFields = [
    { name: 'title',            label: 'عنوان المحاضرة *', required: true },
    { name: 'youtube_url',      label: 'رابط يوتيوب', type: 'text', ltr: true, placeholder: 'https://www.youtube.com/watch?v=...' },
    { name: 'pdf_file',         label: 'ملف PDF', type: 'file', accept: 'application/pdf' },
    { name: 'duration_minutes', label: 'المدة (بالدقائق)', type: 'number' },
    { name: 'display_order',    label: 'الترتيب', type: 'number' },
    { name: 'unit',             label: '', type: 'hidden' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2 hover:bg-white/05 rounded-lg text-white/50">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-cairo font-bold text-white text-xl">استوديو الوحدة</h1>
          <p className="text-white/30 text-xs mt-0.5">تفاصيل الوحدة والمحاضرات</p>
        </div>
      </div>

      {/* Unit Info Card */}
      <div className="glass-card flex items-start md:items-center justify-between p-6 flex-col md:flex-row gap-4 border border-brand-blue/10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-dark-700 border border-white/05 flex items-center justify-center shrink-0">
            <BookMarked size={24} className="text-brand-blue" />
          </div>
          <div>
            <h2 className="font-cairo font-bold text-white text-xl mb-1">{unit.name}</h2>
            <p className="text-white/40 text-sm">الترتيب: {unit.display_order} · {lessons.length} محاضرة</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button onClick={() => setModal('edit_unit')} className="btn-secondary flex-1 md:flex-none justify-center">
            <Pencil size={14} className="mr-1" /> تعديل
          </button>
          <button onClick={handleDeleteUnit} className="btn-secondary flex-1 md:flex-none justify-center bg-brand-red/10 text-brand-red hover:bg-brand-red/20 border-brand-red/20">
            <Trash2 size={14} className="mr-1" /> حذف
          </button>
        </div>
      </div>

      {/* Lessons */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="font-cairo font-bold text-white text-lg flex items-center gap-2">
            <Play size={18} className="text-brand-blue" /> المحاضرات
          </h2>
          <button onClick={() => setModal('lesson')} className="btn-primary py-1.5 px-4 text-sm">
            <Plus size={14} /> محاضرة جديدة
          </button>
        </div>

        {lessons.length === 0 ? (
          <div className="glass-card p-10 text-center text-white/30">
            <Play size={36} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد محاضرات. أضف المحاضرة الأولى.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lessons.map((lesson) => (
              <div key={lesson.id} className="glass-card overflow-hidden border border-white/05">

                {/* YouTube Player */}
                {lesson.youtube_embed_url && (
                  <YouTubePlayer url={lesson.youtube_embed_url} title={lesson.title} />
                )}

                {/* No video placeholder */}
                {!lesson.youtube_embed_url && (
                  <div className="flex items-center justify-center bg-dark-700/60 h-36 rounded-t-xl">
                    <Play size={32} className="text-white/15" />
                  </div>
                )}

                <div className="p-4">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-cairo font-bold text-white text-sm line-clamp-2 flex-1">{lesson.title}</h3>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditLesson(lesson)}
                        className="btn-ghost p-1.5 text-brand-blue hover:bg-brand-blue/10 rounded-lg">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => deleteLesson(lesson.id)}
                        className="btn-ghost p-1.5 text-brand-red hover:bg-brand-red/10 rounded-lg">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {lesson.duration_minutes > 0 && (
                      <span className="text-white/30 text-xs">{lesson.duration_minutes} دق</span>
                    )}
                    {lesson.pdf_file && (
                      <a href={lesson.pdf_file} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-brand-blue hover:underline">
                        <FileText size={12} /> PDF
                      </a>
                    )}
                  </div>

                  {/* Exercise row */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/05">
                    <div>
                      {lesson.exercise ? (
                        <span className="badge badge-green text-[10px]">✓ يوجد تمرين</span>
                      ) : (
                        <span className="text-white/20 text-[10px]">لا يوجد تمرين</span>
                      )}
                    </div>
                    <button
                      onClick={() => setManageExercise(lesson)}
                      className="btn-ghost text-brand-blue border border-brand-blue/30 py-1 px-3 text-xs rounded-md flex items-center gap-1 hover:bg-brand-blue/10">
                      {lesson.exercise ? 'إدارة التمرين' : 'إضافة تمرين'} <ArrowLeft size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination count={totalLessons} currentPage={page} onPageChange={setPage} />
      </div>

      {/* ── Modals ── */}
      {modal === 'edit_unit' && (
        <ItemModal
          title="تعديل الوحدة"
          fields={unitFields}
          initialData={{ ...unit, course: unit.course?.id || unit.course }}
          endpoint={`/academic/units/${unit.id}/`}
          method="PATCH"
          onClose={() => setModal(null)}
          onSaved={loadDetails}
        />
      )}

      {modal === 'lesson' && (
        <ItemModal
          title={`محاضرة جديدة — ${unit.name}`}
          fields={lessonFields}
          initialData={{ unit: unit.id, display_order: lessons.length }}
          endpoint="/academic/lessons/"
          onClose={() => setModal(null)}
          onSaved={loadDetails}
        />
      )}

      {editLesson && (
        <ItemModal
          title="تعديل المحاضرة"
          fields={lessonFields}
          initialData={{ ...editLesson, unit: unit.id, youtube_url: editLesson.youtube_url || '' }}
          endpoint={`/academic/lessons/${editLesson.id}/`}
          method="PATCH"
          onClose={() => setEditLesson(null)}
          onSaved={loadDetails}
        />
      )}

      {manageExercise && (
        <ExerciseManager
          lessonId={manageExercise.id}
          lessonTitle={manageExercise.title}
          exerciseData={manageExercise.exercise}
          onClose={() => setManageExercise(null)}
          onSaved={loadDetails}
        />
      )}
    </div>
  )
}
