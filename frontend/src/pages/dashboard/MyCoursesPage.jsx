/**
 * pages/dashboard/MyCoursesPage.jsx
 * واجهة الطالب — كورساتي مع الوحدات والمحاضرات ومشغل الفيديو
 */

import { useEffect, useState, useCallback } from 'react'
import {
  BookOpen, BookMarked, Play, FileText, ChevronDown, ChevronLeft,
  Loader2, CheckCircle, Circle, Lock, Award, ClipboardList,
} from 'lucide-react'
import api from '../../api/axiosInstance'

/* ─ مشغل يوتيوب Embed ───────────────────────────────────────── */
function YouTubeEmbed({ embedUrl, title }) {
  if (!embedUrl) return null
  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-dark-700"
      style={{ paddingBottom: '56.25%' }}>
      <iframe
        className="absolute inset-0 w-full h-full"
        src={embedUrl}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}

/* ─ تمرين / نافذة الأسئلة ──────────────────────────────────── */
function ExercisePanel({ exercise, lessonId, onSubmitted }) {
  const [answers, setAnswers] = useState({})   // { questionId: choiceId }
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleSelect = (questionId, choiceId) =>
    setAnswers(a => ({ ...a, [questionId]: choiceId }))

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        exercise_id: exercise.id,
        answers: Object.entries(answers).map(([question_id, choice_id]) => ({
          question_id: parseInt(question_id),
          choice_id:   parseInt(choice_id),
        })),
      }
      const { data } = await api.post('/academic/submit/', payload)
      setResult(data)
      onSubmitted?.()
    } catch (e) {
      const d = e.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'حدث خطأ في التسليم.')
    } finally { setSubmitting(false) }
  }

  if (result) {
    return (
      <div className={`glass-card p-5 text-center border ${result.is_passed ? 'border-neon-cyan/30' : 'border-brand-red/30'}`}>
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${result.is_passed ? 'bg-neon-cyan/10' : 'bg-brand-red/10'}`}>
          {result.is_passed
            ? <Award size={30} className="text-neon-cyan" />
            : <Circle size={30} className="text-brand-red" />
          }
        </div>
        <p className="font-cairo font-bold text-white text-lg">
          {result.is_passed ? '🎉 أحسنت! اجتزت التمرين' : 'حاول مرة أخرى'}
        </p>
        <p className="text-white/60 mt-1">
          درجتك: <span className={`font-bold ${result.is_passed ? 'text-neon-cyan' : 'text-brand-red'}`}>
            {result.score} / {exercise.total_marks}
          </span>
          {' '}({result.percentage?.toFixed(1)}%)
        </p>
      </div>
    )
  }

  return (
    <div className="glass-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h4 className="font-cairo font-bold text-white flex items-center gap-2">
          <ClipboardList size={16} className="text-brand-blue" />
          {exercise.title || 'تمرين المحاضرة'}
        </h4>
        <span className="text-white/30 text-xs">
          {exercise.questions?.length} سؤال — {exercise.total_marks} درجة
        </span>
      </div>

      {exercise.instructions && (
        <p className="text-white/50 text-sm bg-dark-700/50 rounded-xl p-3">
          {exercise.instructions}
        </p>
      )}

      <div className="space-y-5">
        {exercise.questions?.map((q, qi) => (
          <div key={q.id} className="space-y-2">
            <p className="text-white text-sm font-medium">
              {qi + 1}. {q.text}
            </p>
            <div className="space-y-1.5 pr-3">
              {q.choices?.map((c) => (
                <label key={c.id}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                    answers[q.id] === c.id
                      ? 'border-brand-blue/50 bg-brand-blue/10 text-white'
                      : 'border-white/05 bg-dark-700/30 text-white/60 hover:border-white/15 hover:text-white'
                  }`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                    answers[q.id] === c.id ? 'border-brand-blue bg-brand-blue' : 'border-white/20'
                  }`}>
                    {answers[q.id] === c.id && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <input type="radio" name={`q-${q.id}`} value={c.id}
                    checked={answers[q.id] === c.id}
                    onChange={() => handleSelect(q.id, c.id)}
                    className="sr-only" />
                  <span className="text-sm">{c.text}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-brand-red text-xs bg-brand-red/10 rounded-xl p-3">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting || Object.keys(answers).length < (exercise.questions?.length || 0)}
        className="btn-primary w-full justify-center"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Award size={16} />}
        {submitting ? 'جاري التسليم...' : 'تسليم التمرين'}
      </button>
      {Object.keys(answers).length < (exercise.questions?.length || 0) && (
        <p className="text-white/30 text-xs text-center">
          أجب على جميع الأسئلة للتسليم ({Object.keys(answers).length}/{exercise.questions?.length})
        </p>
      )}
    </div>
  )
}

/* ─ تفاصيل المحاضرة ─────────────────────────────────────────── */
function LessonDetail({ lessonId, onBack }) {
  const [lesson, setLesson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get(`/academic/my-lessons/${lessonId}/`)
      .then(({ data }) => setLesson(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [lessonId])

  const markComplete = async () => {
    setMarking(true)
    try {
      await api.post(`/academic/my-lessons/${lessonId}/complete/`)
      setLesson(l => ({ ...l, is_completed: true }))
    } catch (e) { console.error(e) }
    finally { setMarking(false) }
  }

  if (loading) return (
    <div className="py-16 text-center">
      <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
    </div>
  )
  if (!lesson) return null

  return (
    <div className="space-y-5 animate-fade-in">
      <button onClick={onBack}
        className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
        <ChevronLeft size={16} /> العودة للكورس
      </button>

      <div className="flex items-start justify-between gap-3">
        <h2 className="font-cairo font-bold text-white text-lg">{lesson.title}</h2>
        {lesson.is_completed ? (
          <span className="badge-green badge flex items-center gap-1 shrink-0">
            <CheckCircle size={12} /> مكتملة
          </span>
        ) : (
          <button onClick={markComplete} disabled={marking}
            className="btn-secondary text-xs shrink-0">
            {marking ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
            وضّع كمكتملة
          </button>
        )}
      </div>

      {/* مشغل اليوتيوب */}
      {lesson.youtube_embed_url && (
        <YouTubeEmbed embedUrl={lesson.youtube_embed_url} title={lesson.title} />
      )}

      {/* الوصف */}
      {lesson.description && (
        <p className="text-white/60 text-sm leading-relaxed">{lesson.description}</p>
      )}

      {/* ملف PDF */}
      {lesson.pdf_file && (
        <a href={lesson.pdf_file} target="_blank" rel="noreferrer"
          className="flex items-center gap-3 glass-card p-4 hover:border-brand-blue/30 transition-colors group">
          <div className="w-10 h-10 rounded-xl bg-brand-red/10 flex items-center justify-center">
            <FileText size={18} className="text-brand-red" />
          </div>
          <div>
            <p className="text-white text-sm font-medium group-hover:text-brand-blue transition-colors">
              ملف PDF المحاضرة
            </p>
            <p className="text-white/30 text-xs">انقر للتحميل</p>
          </div>
        </a>
      )}

      {/* التمرين */}
      {lesson.exercise && (
        <div>
          <h3 className="font-cairo font-semibold text-white/70 text-sm mb-3 flex items-center gap-2">
            <ClipboardList size={15} className="text-brand-blue" /> تمرين المحاضرة
          </h3>
          <ExercisePanel exercise={lesson.exercise} lessonId={lessonId} />
        </div>
      )}
    </div>
  )
}

/* ─ بطاقة كورس ──────────────────────────────────────────────── */
function CourseCard({ course, onOpen }) {
  return (
    <button onClick={() => onOpen(course)}
      className="glass-card p-5 text-right hover:border-brand-blue/30 transition-all group hover:scale-[1.01] active:scale-[0.99]">
      {course.thumbnail && (
        <img src={course.thumbnail} alt=""
          className="w-full h-32 object-cover rounded-xl mb-3" />
      )}
      <h3 className="font-cairo font-bold text-white group-hover:text-brand-blue transition-colors">
        {course.name}
      </h3>
      {course.teacher_name && (
        <p className="text-white/40 text-xs mt-1">{course.teacher_name}</p>
      )}
      {course.description && (
        <p className="text-white/30 text-xs mt-2 line-clamp-2">{course.description}</p>
      )}
      <div className="flex items-center gap-2 mt-3">
        <span className="badge badge-blue text-xs">
          {course.units_count || 0} وحدة
        </span>
        <span className="badge text-xs bg-white/5 text-white/40">
          {course.lessons_count || 0} محاضرة
        </span>
      </div>
    </button>
  )
}

/* ─ تفاصيل الكورس (الوحدات والمحاضرات) ───────────────────────── */
function CourseDetail({ course, onBack, onOpenLesson }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openUnit, setOpenUnit] = useState({})

  useEffect(() => {
    setLoading(true)
    api.get(`/academic/my-courses/${course.id}/`)
      .then(({ data }) => setDetail(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [course.id])

  if (loading) return (
    <div className="py-16 text-center">
      <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <button onClick={onBack}
        className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
        <ChevronLeft size={16} /> العودة لكورساتي
      </button>

      <div className="glass-card p-5">
        <h2 className="font-cairo font-bold text-white text-xl">{detail?.name}</h2>
        {detail?.teacher_name && (
          <p className="text-white/40 text-sm mt-1 flex items-center gap-1">
            <BookOpen size={13} /> {detail.teacher_name}
          </p>
        )}
        {detail?.description && (
          <p className="text-white/50 text-sm mt-2">{detail.description}</p>
        )}
      </div>

      {/* الوحدات */}
      <div className="space-y-2">
        {detail?.units?.map((unit) => (
          <div key={unit.id} className="glass-card overflow-hidden">
            <button
              onClick={() => setOpenUnit(o => ({ ...o, [unit.id]: !o[unit.id] }))}
              className="w-full flex items-center gap-3 p-4 hover:bg-white/3 transition-colors text-right">
              <div className="w-8 h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0">
                <BookMarked size={15} className="text-brand-blue" />
              </div>
              <span className="flex-1 font-cairo font-semibold text-white">{unit.name}</span>
              <span className="text-white/30 text-xs">{unit.lessons?.length || 0} محاضرة</span>
              {openUnit[unit.id]
                ? <ChevronDown size={16} className="text-white/40" />
                : <ChevronLeft size={16} className="text-white/40" />
              }
            </button>

            {openUnit[unit.id] && (
              <div className="border-t border-white/08 divide-y divide-white/05">
                {unit.lessons?.map((lesson) => (
                  <button key={lesson.id}
                    onClick={() => onOpenLesson(lesson.id)}
                    className="w-full flex items-center gap-3 p-3.5 hover:bg-white/3 transition-colors text-right group">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      lesson.is_completed ? 'bg-neon-cyan/10' : 'bg-dark-600'
                    }`}>
                      {lesson.is_completed
                        ? <CheckCircle size={13} className="text-neon-cyan" />
                        : <Play size={13} className="text-white/40" />
                      }
                    </div>
                    <span className={`flex-1 text-sm ${lesson.is_completed ? 'text-white/60' : 'text-white'} group-hover:text-brand-blue transition-colors`}>
                      {lesson.title}
                    </span>
                    {lesson.duration_minutes > 0 && (
                      <span className="text-white/25 text-xs">{lesson.duration_minutes} دق</span>
                    )}
                  </button>
                ))}
                {!unit.lessons?.length && (
                  <p className="text-white/25 text-xs text-center py-4">لا توجد محاضرات</p>
                )}
              </div>
            )}
          </div>
        ))}
        {!detail?.units?.length && (
          <div className="glass-card p-12 text-center text-white/30">
            <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد وحدات بعد</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─ الصفحة الرئيسية ─────────────────────────────────────────── */
export default function MyCoursesPage() {
  const [courses,  setCourses]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [view,     setView]     = useState('list')  // 'list' | 'course' | 'lesson'
  const [selected, setSelected] = useState(null)    // course object
  const [lessonId, setLessonId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/academic/my-courses/')
      .then(({ data }) => setCourses(data.results || data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const openCourse = (course) => {
    setSelected(course)
    setView('course')
  }

  const openLesson = (id) => {
    setLessonId(id)
    setView('lesson')
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {view === 'list' && (
        <>
          <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
            <BookMarked size={20} className="text-brand-blue" /> كورساتي
            <span className="text-white/30 font-normal text-sm">({courses.length})</span>
          </h1>

          {loading ? (
            <div className="py-16 text-center">
              <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
            </div>
          ) : courses.length === 0 ? (
            <div className="glass-card p-16 text-center text-white/40">
              <Lock size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-cairo text-lg">لا توجد كورسات متاحة حالياً</p>
              <p className="text-sm mt-2 text-white/25">ستظهر كورساتك هنا بعد إتمام التسجيل والدفع</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((c) => (
                <CourseCard key={c.id} course={c} onOpen={openCourse} />
              ))}
            </div>
          )}
        </>
      )}

      {view === 'course' && selected && (
        <CourseDetail
          course={selected}
          onBack={() => setView('list')}
          onOpenLesson={openLesson}
        />
      )}

      {view === 'lesson' && lessonId && (
        <LessonDetail
          lessonId={lessonId}
          onBack={() => setView('course')}
          onSubmitted={load}
        />
      )}
    </div>
  )
}
