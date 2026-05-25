import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Play, ArrowLeft, FileText, ClipboardList, Loader2,
  Plus, X, Trash2, Pencil, BookMarked, BookOpen,
  Clock, CheckCircle2, AlertCircle, Eye, ChevronDown, ChevronUp
} from 'lucide-react'
import api from '../../api/axiosInstance'

/* ─── YouTube Player ─────────────────────────────────────────────── */
function YouTubePlayer({ url, title }) {
  if (!url) return null
  const embedUrl = url.includes('?') ? `${url}&origin=${window.location.origin}` : `${url}?origin=${window.location.origin}`
  return (
    <div className="relative rounded-2xl overflow-hidden bg-dark-800 shadow-2xl" style={{ paddingBottom: '56.25%' }}>
      <iframe
        className="absolute inset-0 w-full h-full"
        src={embedUrl}
        title={title || 'محاضرة'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}

/* ─── Question Card ──────────────────────────────────────────────── */
function QuestionCard({ question, index, onDelete }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div className="glass-card border border-white/05 overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/02 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="w-7 h-7 rounded-full bg-brand-blue/15 flex items-center justify-center text-brand-blue text-sm font-bold shrink-0">
          {index + 1}
        </span>
        <p className="text-white text-sm font-medium flex-1">{question.text}</p>
        <span className="text-white/30 text-xs bg-dark-700 px-2 py-0.5 rounded-full">{question.marks} درجة</span>
        <button
          onClick={e => { e.stopPropagation(); onDelete(question.id) }}
          className="btn-ghost p-1.5 text-brand-red/40 hover:text-brand-red shrink-0"
        >
          <Trash2 size={13} />
        </button>
        {expanded ? <ChevronUp size={15} className="text-white/30 shrink-0" /> : <ChevronDown size={15} className="text-white/30 shrink-0" />}
      </div>
      {expanded && (
        <div className="px-4 pb-4 space-y-1.5">
          {question.choices?.map((choice) => (
            <div
              key={choice.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all
                ${choice.is_correct
                  ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20'
                  : 'text-white/40 bg-dark-700/50'}`}
            >
              <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center
                ${choice.is_correct ? 'border-neon-cyan bg-neon-cyan' : 'border-white/20'}`}>
                {choice.is_correct && <div className="w-1.5 h-1.5 rounded-full bg-dark-900" />}
              </div>
              <span className="flex-1">{choice.text}</span>
              {choice.is_correct && (
                <span className="text-[10px] font-bold text-neon-cyan flex items-center gap-1">
                  <CheckCircle2 size={11} /> صحيحة
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Add Question Form ──────────────────────────────────────────── */
function AddQuestionForm({ exerciseId, onSaved, onCancel }) {
  const [text, setText] = useState('')
  const [marks, setMarks] = useState(1)
  const [choices, setChoices] = useState([
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!text.trim()) { setError('نص السؤال مطلوب.'); return }
    setSaving(true); setError('')
    try {
      const { data: qData } = await api.post(`/academic/exercises/${exerciseId}/questions/`, {
        text: text.trim(),
        marks: parseInt(marks) || 1,
      })
      for (const ch of choices) {
        if (ch.text.trim()) {
          await api.post(`/academic/questions/${qData.id}/choices/`, ch)
        }
      }
      onSaved()
    } catch (e) {
      const d = e.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'حدث خطأ.')
    } finally { setSaving(false) }
  }

  return (
    <div className="glass-card border border-brand-blue/20 p-5 space-y-4 animate-fade-in">
      <h4 className="text-white font-bold text-sm flex items-center gap-2">
        <Plus size={14} className="text-brand-blue" /> سؤال جديد
      </h4>

      {/* Question text */}
      <div>
        <label className="text-white/50 text-xs mb-1 block">نص السؤال *</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="اكتب السؤال هنا..."
          rows={2}
          className="input-glass resize-none"
        />
      </div>

      {/* Marks */}
      <div>
        <label className="text-white/50 text-xs mb-1 block">الدرجة</label>
        <input
          type="number" min="1" value={marks}
          onChange={e => setMarks(e.target.value)}
          className="input-glass w-28 text-sm"
        />
      </div>

      {/* Choices */}
      <div className="space-y-2">
        <label className="text-white/50 text-xs block">الخيارات</label>
        {choices.map((ch, ci) => (
          <div key={ci} className="flex items-center gap-2">
            <button
              onClick={() => setChoices(cs => cs.map((c, i) => i === ci ? { ...c, is_correct: !c.is_correct } : c))}
              title="تبديل الإجابة الصحيحة"
              className={`w-5 h-5 rounded-full border-2 shrink-0 transition-colors flex items-center justify-center
                ${ch.is_correct ? 'border-neon-cyan bg-neon-cyan' : 'border-white/20 hover:border-neon-cyan/50'}`}
            >
              {ch.is_correct && <div className="w-2 h-2 rounded-full bg-dark-900" />}
            </button>
            <input
              value={ch.text}
              onChange={e => setChoices(cs => cs.map((c, i) => i === ci ? { ...c, text: e.target.value } : c))}
              placeholder={`الخيار ${ci + 1}`}
              className="input-glass flex-1 text-sm"
            />
            {choices.length > 2 && (
              <button
                onClick={() => setChoices(cs => cs.filter((_, i) => i !== ci))}
                className="btn-ghost p-1.5 text-brand-red/40 hover:text-brand-red shrink-0"
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => setChoices(cs => [...cs, { text: '', is_correct: false }])}
          className="btn-ghost text-xs text-brand-blue flex items-center gap-1 p-1"
        >
          <Plus size={11} /> خيار آخر
        </button>
      </div>

      {error && <p className="text-brand-red text-xs bg-brand-red/10 rounded-xl p-3">{error}</p>}

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm px-5">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {saving ? 'جاري الحفظ...' : 'حفظ السؤال'}
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm px-4">إلغاء</button>
      </div>
    </div>
  )
}

/* ─── Edit Lecture Modal ─────────────────────────────────────────── */
function EditLectureModal({ lesson, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: lesson.title || '',
    youtube_url: lesson.youtube_url || '',
    duration_minutes: lesson.duration_minutes || '',
    display_order: lesson.display_order || '',
  })
  const [pdfFile, setPdfFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const payload = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) payload.append(k, v) })
      if (pdfFile) payload.append('pdf_file', pdfFile)
      await api.patch(`/academic/lessons/${lesson.id}/`, payload)
      onSaved(); onClose()
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
            <Pencil size={16} className="text-brand-blue" /> تعديل المحاضرة
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-white/50 text-xs mb-1 block">عنوان المحاضرة *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input-glass" required />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">رابط يوتيوب</label>
            <input value={form.youtube_url} onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))}
              placeholder="https://www.youtube.com/watch?v=..." className="input-glass" dir="ltr" />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">ملف PDF</label>
            <input type="file" accept="application/pdf" onChange={e => setPdfFile(e.target.files[0])}
              className="input-glass text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-brand-blue/20 file:text-brand-blue" />
            {lesson.pdf_file && <p className="text-white/30 text-xs mt-1">الملف الحالي: <a href={lesson.pdf_file} target="_blank" rel="noreferrer" className="text-brand-blue hover:underline">فتح PDF</a></p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs mb-1 block">المدة (دقائق)</label>
              <input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                className="input-glass" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">الترتيب</label>
              <input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: e.target.value }))}
                className="input-glass" />
            </div>
          </div>
          {error && <p className="text-brand-red text-xs bg-brand-red/10 rounded-xl p-3">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-5">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────────── */
export default function LectureDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [lesson, setLesson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState([])
  const [showAddQ, setShowAddQ] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [creatingExercise, setCreatingExercise] = useState(false)
  const [error, setError] = useState('')

  const loadLesson = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/academic/lessons/${id}/`)
      setLesson(data)
      setQuestions(data.exercise?.questions || [])
    } catch (err) {
      if (err.response?.status === 404) navigate('/dashboard/academic/lessons')
      else setError('حدث خطأ في تحميل بيانات المحاضرة.')
    } finally { setLoading(false) }
  }, [id, navigate])

  useEffect(() => { loadLesson() }, [loadLesson])

  const handleCreateExercise = async () => {
    setCreatingExercise(true)
    try {
      await api.post('/academic/exercises/', {
        lesson: lesson.id,
        title: `تمرين: ${lesson.title}`,
        pass_percentage: 60,
      })
      loadLesson()
    } catch (e) { console.error(e) }
    finally { setCreatingExercise(false) }
  }

  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm('حذف هذا السؤال؟')) return
    try {
      await api.delete(`/academic/questions/${qId}/`)
      setQuestions(qs => qs.filter(q => q.id !== qId))
    } catch { alert('خطأ في الحذف.') }
  }

  const handleDeleteLesson = async () => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المحاضرة؟')) return
    try {
      await api.delete(`/academic/lessons/${lesson.id}/`)
      navigate(-1)
    } catch { alert('خطأ في الحذف.') }
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-blue" />
      </div>
    )
  }

  if (error || !lesson) {
    return (
      <div className="glass-card p-12 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 text-brand-red/60" />
        <p className="text-white/40">{error || 'المحاضرة غير موجودة.'}</p>
        <button onClick={() => navigate(-1)} className="btn-secondary mt-4 mx-auto">
          <ArrowLeft size={14} /> رجوع
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2 hover:bg-white/05 rounded-lg text-white/50">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-cairo font-bold text-white text-xl">تفاصيل المحاضرة</h1>
          <p className="text-white/30 text-xs mt-0.5">عرض وإدارة محتوى المحاضرة</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowEditModal(true)} className="btn-secondary text-sm">
            <Pencil size={14} /> تعديل
          </button>
          <button onClick={handleDeleteLesson}
            className="btn-secondary text-sm bg-brand-red/10 text-brand-red hover:bg-brand-red/20 border-brand-red/20">
            <Trash2 size={14} /> حذف
          </button>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* ── LEFT: Video + Info ── */}
        <div className="xl:col-span-3 space-y-5">

          {/* Video Player or placeholder */}
          {lesson.youtube_embed_url ? (
            <YouTubePlayer url={lesson.youtube_embed_url} title={lesson.title} />
          ) : (
            <div className="glass-card flex flex-col items-center justify-center h-56 border border-dashed border-white/10 rounded-2xl">
              <Play size={40} className="text-white/10 mb-3" />
              <p className="text-white/20 text-sm">لا يوجد فيديو مرتبط</p>
              <button onClick={() => setShowEditModal(true)}
                className="btn-ghost text-brand-blue text-xs mt-3 flex items-center gap-1 hover:underline">
                <Plus size={11} /> أضف رابط يوتيوب
              </button>
            </div>
          )}

          {/* Lecture Info Card */}
          <div className="glass-card p-6 border border-white/05">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 className="font-cairo font-bold text-white text-xl leading-snug">{lesson.title}</h2>
              <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
                <Play size={18} className="text-brand-blue" />
              </div>
            </div>

            {/* Meta badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              {lesson.unit_name && (
                <span className="flex items-center gap-1.5 text-xs text-white/50 bg-dark-700 px-3 py-1.5 rounded-full">
                  <BookMarked size={11} className="text-brand-blue" /> {lesson.unit_name}
                </span>
              )}
              {lesson.course_name && (
                <span className="flex items-center gap-1.5 text-xs text-white/50 bg-dark-700 px-3 py-1.5 rounded-full">
                  <BookOpen size={11} className="text-neon-cyan" /> {lesson.course_name}
                </span>
              )}
              {lesson.duration_minutes > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-white/50 bg-dark-700 px-3 py-1.5 rounded-full">
                  <Clock size={11} /> {lesson.duration_minutes} دقيقة
                </span>
              )}
              {lesson.display_order !== undefined && (
                <span className="text-xs text-white/30 bg-dark-700 px-3 py-1.5 rounded-full">
                  الترتيب: {lesson.display_order}
                </span>
              )}
            </div>

            {/* PDF */}
            {lesson.pdf_file ? (
              <a href={lesson.pdf_file} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-brand-blue bg-brand-blue/10 border border-brand-blue/20
                           px-4 py-2 rounded-xl hover:bg-brand-blue/20 transition-colors">
                <FileText size={15} /> فتح ملف PDF
              </a>
            ) : (
              <p className="text-white/20 text-sm flex items-center gap-1.5">
                <FileText size={13} /> لا يوجد ملف PDF مرفق
              </p>
            )}
          </div>
        </div>

        {/* ── RIGHT: Exercise + Questions ── */}
        <div className="xl:col-span-2 space-y-5">

          {/* Exercise Header Card */}
          <div className="glass-card p-5 border border-white/05">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-cairo font-bold text-white text-base flex items-center gap-2">
                <ClipboardList size={16} className="text-neon-cyan" /> التمرين
              </h3>
              {lesson.exercise && (
                <span className="badge badge-green text-[10px]">
                  <CheckCircle2 size={9} className="inline mr-0.5" /> مفعّل
                </span>
              )}
            </div>

            {lesson.exercise ? (
              <div className="space-y-2">
                <div className="glass-card p-3 bg-neon-cyan/5 border border-neon-cyan/10">
                  <p className="text-white font-medium text-sm">{lesson.exercise.title}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-white/40 text-xs">نسبة النجاح: {lesson.exercise.pass_percentage}%</span>
                    <span className="text-white/40 text-xs">{questions.length} سؤال</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddQ(v => !v)}
                  className={`w-full btn-ghost text-sm flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed
                    ${showAddQ ? 'border-brand-blue/40 text-brand-blue bg-brand-blue/5' : 'border-white/10 text-white/40 hover:border-brand-blue/30 hover:text-brand-blue'}`}
                >
                  <Plus size={14} />
                  {showAddQ ? 'إخفاء النموذج' : 'إضافة سؤال جديد'}
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                <ClipboardList size={32} className="mx-auto mb-3 text-white/10" />
                <p className="text-white/30 text-sm mb-4">لا يوجد تمرين مرتبط بهذه المحاضرة</p>
                <button onClick={handleCreateExercise} disabled={creatingExercise} className="btn-primary mx-auto text-sm">
                  {creatingExercise ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {creatingExercise ? 'جاري الإنشاء...' : 'إنشاء تمرين'}
                </button>
              </div>
            )}
          </div>

          {/* Add Question Form */}
          {showAddQ && lesson.exercise && (
            <AddQuestionForm
              exerciseId={lesson.exercise.id}
              onSaved={() => { setShowAddQ(false); loadLesson() }}
              onCancel={() => setShowAddQ(false)}
            />
          )}

          {/* Questions List */}
          {questions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-white/60 text-sm font-medium">الأسئلة ({questions.length})</h4>
              </div>
              {questions.map((q, qi) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={qi}
                  onDelete={handleDeleteQuestion}
                />
              ))}
            </div>
          )}

          {lesson.exercise && questions.length === 0 && !showAddQ && (
            <div className="glass-card p-6 text-center border border-dashed border-white/05">
              <p className="text-white/20 text-sm">لا توجد أسئلة بعد.</p>
              <button onClick={() => setShowAddQ(true)}
                className="btn-ghost text-brand-blue text-xs mt-2 flex items-center gap-1 mx-auto">
                <Plus size={11} /> ابدأ بإضافة الأسئلة
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditLectureModal
          lesson={lesson}
          onClose={() => setShowEditModal(false)}
          onSaved={loadLesson}
        />
      )}
    </div>
  )
}
