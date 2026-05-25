import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, Plus, Loader2, X, Trash2, BookMarked, Play,
  ClipboardList, ArrowLeft, FileText, Search, Filter, SlidersHorizontal, Eye
} from 'lucide-react'
import api from '../../api/axiosInstance'
import Pagination from '../../components/ui/Pagination'

/* ─── Generic Modal ─────────────────────────────────────────────── */
function ItemModal({ title, fields, initialData = {}, endpoint, onClose, onSaved, method = 'POST' }) {
  const [form, setForm] = useState({ ...initialData })
  const [files, setFiles] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
    setSaving(true); setError('')
    try {
      const hasFiles = Object.keys(files).length > 0
      let payload
      if (hasFiles) {
        payload = new FormData()
        Object.entries(form).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) payload.append(k, v) })
        Object.entries(files).forEach(([k, v]) => { if (v) payload.append(k, v) })
      } else { payload = form }
      if (method === 'PATCH') await api.patch(endpoint, payload)
      else await api.post(endpoint, payload)
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
          <h2 className="font-cairo font-bold text-white text-lg">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          {fields.map((f) => (
            <div key={f.name}>
              {f.type !== 'hidden' && <label className="text-white/50 text-xs mb-1 block">{f.label}</label>}
              {f.type === 'textarea' ? (
                <textarea name={f.name} value={form[f.name] || ''} onChange={handleChange} rows={f.rows || 3} placeholder={f.placeholder || ''} className="input-glass resize-none" />
              ) : f.type === 'select' ? (
                <select name={f.name} value={form[f.name] || ''} onChange={handleChange} className="input-glass">
                  {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'checkbox' ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input name={f.name} type="checkbox" checked={!!form[f.name]} onChange={handleChange} className="w-4 h-4 accent-brand-blue" />
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

/* ─── YouTube Player ────────────────────────────────────────────── */
function YouTubePlayer({ url, title }) {
  if (!url) return null
  const embedUrl = url.includes('?') ? `${url}&origin=${window.location.origin}` : `${url}?origin=${window.location.origin}`
  return (
    <div className="relative rounded-t-xl overflow-hidden bg-dark-700" style={{ paddingBottom: '56.25%' }}>
      <iframe className="absolute inset-0 w-full h-full" src={embedUrl} title={title || 'درس'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  )
}

/* ─── ExerciseManager ───────────────────────────────────────────── */
function ExerciseManager({ exercise }) {
  const [questions] = useState(exercise.questions || [])
  return (
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
  )
}

/* ─── Lesson Card ───────────────────────────────────────────────── */
function LessonCard({ lesson, onDelete, onCreateExercise }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="glass-card overflow-hidden border border-white/05 flex flex-col">
      {/* Video or placeholder */}
      {lesson.youtube_embed_url ? (
        <YouTubePlayer url={lesson.youtube_embed_url} title={lesson.title} />
      ) : (
        <div className="flex items-center justify-center bg-dark-700/60 h-36">
          <Play size={32} className="text-white/15" />
        </div>
      )}

      <div className="p-4 flex flex-col flex-1">
        {/* Title + actions */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-cairo font-bold text-white text-sm line-clamp-2 flex-1">{lesson.title}</h3>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => navigate(`/dashboard/academic/lessons/${lesson.id}`)}
              className="btn-ghost p-1.5 text-brand-blue/60 hover:text-brand-blue"
              title="عرض التفاصيل"
            >
              <Eye size={13} />
            </button>
            <button onClick={() => onDelete(lesson.id)} className="btn-ghost p-1.5 text-brand-red/50 hover:text-brand-red">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Meta badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {lesson.unit_name && (
            <span className="badge bg-dark-600 text-white/40 text-[10px]">
              <BookMarked size={9} className="inline mr-0.5" /> {lesson.unit_name}
            </span>
          )}
          {lesson.course_name && (
            <span className="badge bg-dark-600 text-white/40 text-[10px]">
              <BookOpen size={9} className="inline mr-0.5" /> {lesson.course_name}
            </span>
          )}
          {lesson.duration_minutes > 0 && (
            <span className="text-white/30 text-[10px] bg-dark-600 px-1.5 py-0.5 rounded">{lesson.duration_minutes} دق</span>
          )}
          {lesson.pdf_file && (
            <a href={lesson.pdf_file} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-brand-blue bg-brand-blue/10 px-1.5 py-0.5 rounded hover:bg-brand-blue/20">
              <FileText size={9} /> PDF
            </a>
          )}
        </div>

        {/* Exercise section + View button */}
        <div className="mt-auto pt-3 border-t border-white/05 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              {lesson.exercise ? (
                <button onClick={() => setExpanded(e => !e)}
                  className="flex items-center gap-1 text-[10px] text-neon-cyan bg-neon-cyan/10 px-2 py-0.5 rounded-full hover:bg-neon-cyan/20 transition-colors">
                  <ClipboardList size={10} /> {expanded ? 'إخفاء التمرين' : 'عرض التمرين'}
                </button>
              ) : (
                <span className="text-white/20 text-[10px]">لا يوجد تمرين</span>
              )}
            </div>
            {!lesson.exercise && (
              <button onClick={() => onCreateExercise(lesson)}
                className="btn-ghost text-brand-blue border border-brand-blue/30 py-1 px-2.5 text-[10px] rounded-md flex items-center gap-1 hover:bg-brand-blue/10">
                <Plus size={10} /> إنشاء تمرين
              </button>
            )}
          </div>
          {expanded && lesson.exercise && (
            <div className="mt-2">
              <p className="text-white/40 text-xs mb-2">
                {lesson.exercise.title} · نسبة النجاح: {lesson.exercise.pass_percentage}%
              </p>
              <ExerciseManager exercise={lesson.exercise} />
            </div>
          )}
          {/* View Details button */}
          <button
            onClick={() => navigate(`/dashboard/academic/lessons/${lesson.id}`)}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] text-white/50 hover:text-brand-blue
                       border border-white/08 hover:border-brand-blue/30 rounded-xl py-1.5 transition-all hover:bg-brand-blue/5"
          >
            <Eye size={11} /> عرض التفاصيل الكاملة
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Page ─────────────────────────────────────────────────── */
export default function LessonsExercisesPage() {
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [modal, setModal] = useState(null)
  const [ctx, setCtx] = useState(null)

  // Filter data
  const [grades, setGrades] = useState([])
  const [courses, setCourses] = useState([])
  const [units, setUnits] = useState([])

  // Filter state
  const [filterGrade, setFilterGrade] = useState('')
  const [filterCourse, setFilterCourse] = useState('')
  const [filterUnit, setFilterUnit] = useState('')
  const [filterName, setFilterName] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Load filter options
  useEffect(() => {
    api.get('/academic/grades/', { params: { page_size: 100 } })
      .then(r => setGrades(r.data.results || r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const params = { page_size: 100 }
    if (filterGrade) params.grade = filterGrade
    api.get('/academic/courses/', { params })
      .then(r => setCourses(r.data.results || r.data)).catch(() => {})
    setFilterCourse('')
    setFilterUnit('')
  }, [filterGrade])

  useEffect(() => {
    if (!filterCourse) { setUnits([]); setFilterUnit(''); return }
    api.get('/academic/units/', { params: { course: filterCourse, page_size: 100 } })
      .then(r => setUnits(r.data.results || r.data)).catch(() => {})
    setFilterUnit('')
  }, [filterCourse])

  const loadLessons = useCallback(() => {
    setLoading(true)
    const params = { page }
    if (filterUnit) params.unit = filterUnit
    else if (filterCourse) params.course = filterCourse
    if (filterName) params.search = filterName
    api.get('/academic/lessons/', { params })
      .then(async ({ data }) => {
        const basicList = data.results || data
        setTotal(data.count || 0)
        const detailed = await Promise.all(
          basicList.map(l => api.get(`/academic/lessons/${l.id}/`).then(r => r.data))
        )
        setLessons(detailed)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, filterUnit, filterCourse, filterName])

  useEffect(() => { loadLessons() }, [loadLessons])

  const deleteLesson = async (id) => {
    if (!window.confirm('حذف هذه المحاضرة؟')) return
    await api.delete(`/academic/lessons/${id}/`)
    loadLessons()
  }

  const createExercise = async (lesson) => {
    try {
      await api.post('/academic/exercises/', {
        lesson: lesson.id,
        title: `تمرين: ${lesson.title}`,
        pass_percentage: 60,
      })
      loadLessons()
    } catch (e) { console.error(e) }
  }

  const exerciseFields = [
    { name: 'title', label: 'عنوان التمرين', placeholder: 'تمرين المحاضرة...' },
    { name: 'instructions', label: 'تعليمات', type: 'textarea', placeholder: 'تعليمات للطالب...' },
    { name: 'pass_percentage', label: 'نسبة النجاح % (0-100)', type: 'number', placeholder: '60' },
    { name: 'lesson', label: '', type: 'hidden' },
  ]

  const activeFilters = [filterGrade, filterCourse, filterUnit, filterName].filter(Boolean).length

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
            <Play size={20} className="text-brand-blue" /> المحاضرات والتمارين
          </h1>
          <p className="text-white/30 text-xs mt-0.5">عرض وإدارة جميع المحاضرات وتمارينها</p>
        </div>
        <button onClick={() => setShowFilters(v => !v)}
          className={`btn-ghost border px-4 py-2 text-sm flex items-center gap-2 rounded-xl transition-all
            ${showFilters ? 'border-brand-blue/50 text-brand-blue bg-brand-blue/10' : 'border-white/10 text-white/50'}`}>
          <SlidersHorizontal size={15} />
          تصفية
          {activeFilters > 0 && (
            <span className="w-5 h-5 rounded-full bg-brand-blue text-white text-[10px] flex items-center justify-center font-bold">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="glass-card p-4 border border-brand-blue/10 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={14} className="text-brand-blue" />
            <span className="text-white/60 text-sm font-medium">خيارات التصفية</span>
            {activeFilters > 0 && (
              <button onClick={() => { setFilterGrade(''); setFilterCourse(''); setFilterUnit(''); setFilterName(''); setPage(1) }}
                className="mr-auto text-xs text-brand-red/70 hover:text-brand-red flex items-center gap-1">
                <X size={11} /> مسح الكل
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search by name */}
            <div className="relative">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              <input
                type="text"
                value={filterName}
                onChange={e => { setFilterName(e.target.value); setPage(1) }}
                placeholder="ابحث باسم المحاضرة..."
                className="input-glass pr-9 text-sm"
              />
            </div>

            {/* Grade filter */}
            <select value={filterGrade} onChange={e => { setFilterGrade(e.target.value); setPage(1) }} className="input-glass text-sm">
              <option value="">كل الفصول</option>
              {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>

            {/* Course filter */}
            <select value={filterCourse} onChange={e => { setFilterCourse(e.target.value); setPage(1) }}
              className="input-glass text-sm" disabled={courses.length === 0}>
              <option value="">كل الكورسات</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Unit filter */}
            <select value={filterUnit} onChange={e => { setFilterUnit(e.target.value); setPage(1) }}
              className="input-glass text-sm" disabled={units.length === 0}>
              <option value="">كل الوحدات</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center"><Loader2 size={28} className="animate-spin text-brand-blue mx-auto" /></div>
      ) : lessons.length === 0 ? (
        <div className="glass-card p-12 text-center text-white/30">
          <Play size={40} className="mx-auto mb-3 opacity-20" />
          <p>لا توجد محاضرات{activeFilters > 0 ? ' تطابق هذه الفلاتر' : '. أضف محاضرات من صفحة الوحدات.'}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lessons.map(lesson => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              onDelete={deleteLesson}
              onCreateExercise={createExercise}
            />
          ))}
        </div>
      )}

      <Pagination count={total} currentPage={page} onPageChange={setPage} />

      {modal === 'exercise' && ctx?.lessonId && (
        <ItemModal
          title="إنشاء تمرين"
          fields={exerciseFields}
          initialData={{ lesson: ctx.lessonId, pass_percentage: 60 }}
          endpoint="/academic/exercises/"
          onClose={() => setModal(null)}
          onSaved={loadLessons}
        />
      )}
    </div>
  )
}
