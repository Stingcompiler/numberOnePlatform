/**
 * pages/dashboard/LivePodcastPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * إدارة البودكاست المباشر — تعديل حقلَي live_podcast_title + live_podcast_url
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from "react"
import {
  Radio, Search, Loader2, X, Check, Trash2, Pencil, Plus,
  Link2, AlertCircle, ChevronRight, ChevronLeft,
  RefreshCw, ExternalLink,
} from "lucide-react"
import api from "../../api/axiosInstance"

const PAGE_SIZE = 10

function StatusBadge({ hasUrl }) {
  return hasUrl ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">
      <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
      مفعّل
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/05 text-white/30 border border-white/08">
      غير مفعّل
    </span>
  )
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-blue/10 flex items-center justify-center">
        <Radio size={28} className="text-brand-blue/50" />
      </div>
      <div>
        <p className="text-white/60 font-medium">لا توجد بودكاستات مباشرة</p>
        <p className="text-white/30 text-sm mt-1">اضغط «إضافة بودكاست» لربط رابط Zoom بمحاضرة</p>
      </div>
      <button onClick={onAdd} className="btn-primary flex items-center gap-2 mt-2">
        <Plus size={15} />
        إضافة بودكاست
      </button>
    </div>
  )
}

function PodcastFormModal({ lesson, onClose, onSaved }) {
  const [courses, setCourses]   = useState([])
  const [lessons, setLessons]   = useState([])
  const [selectedCourse, setSelectedCourse] = useState(lesson?.unit_course_id ? String(lesson.unit_course_id) : "")
  const [selectedLesson, setSelectedLesson] = useState(lesson ? String(lesson.id) : "")
  const [podcastTitle, setPodcastTitle] = useState(lesson?.live_podcast_title || "")
  const [podcastUrl, setPodcastUrl]     = useState(lesson?.live_podcast_url   || "")
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState("")
  const [loadingLessons, setLoadingLessons] = useState(false)

  useEffect(() => {
    api.get("/academic/courses/").then(({ data }) => {
      const list = data.results ?? data
      setCourses(Array.isArray(list) ? list : [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedCourse) { setLessons([]); if (!lesson) setSelectedLesson(""); return }
    setLoadingLessons(true)
    api.get("/academic/units/", { params: { course: selectedCourse } })
      .then(({ data }) => {
        const unitList = data.results ?? data
        const unitIds  = Array.isArray(unitList) ? unitList.map(u => u.id) : []
        return Promise.all(
          unitIds.map(uid =>
            api.get("/academic/lessons/", { params: { unit: uid } })
              .then(r => r.data.results ?? r.data)
              .catch(() => [])
          )
        )
      })
      .then(arrays => { setLessons(arrays.flat()) })
      .catch(() => setLessons([]))
      .finally(() => setLoadingLessons(false))
  }, [selectedCourse])

  useEffect(() => {
    if (!selectedLesson) { setPodcastTitle(""); setPodcastUrl(""); return }
    const found = lessons.find(l => String(l.id) === String(selectedLesson))
    if (found) {
      setPodcastTitle(found.live_podcast_title || "")
      setPodcastUrl(found.live_podcast_url     || "")
    }
  }, [selectedLesson, lessons])

  const handleSave = async () => {
    if (!selectedLesson) { setError("يرجى اختيار محاضرة."); return }
    if (podcastUrl && !podcastUrl.startsWith("http")) {
      setError("الرابط يجب أن يبدأ بـ http:// أو https://"); return
    }
    setSaving(true); setError("")
    try {
      await api.patch(`/academic/lessons/${selectedLesson}/`, {
        live_podcast_title: podcastTitle.trim(),
        live_podcast_url:   podcastUrl.trim(),
      })
      onSaved()
    } catch (e) {
      setError(e.response?.data?.detail || "حدث خطأ أثناء الحفظ.")
    } finally { setSaving(false) }
  }

  const handleClear = async () => {
    if (!selectedLesson) return
    if (!window.confirm("هل تريد إزالة البودكاست من هذه المحاضرة؟")) return
    setSaving(true); setError("")
    try {
      await api.patch(`/academic/lessons/${selectedLesson}/`, { live_podcast_title: "", live_podcast_url: "" })
      onSaved()
    } catch (e) {
      setError(e.response?.data?.detail || "حدث خطأ.")
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-md">
      <div className="w-full max-w-lg glass-card-strong border border-white/10 shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/08">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-blue/15 flex items-center justify-center">
              <Radio size={17} className="text-brand-blue" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">{lesson ? "تعديل البودكاست" : "إضافة بودكاست مباشر"}</p>
              <p className="text-white/30 text-xs">ربط رابط Zoom بمحاضرة موجودة</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-xl"><X size={17} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">الكورس</label>
            <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} className="w-full form-select glass-input" disabled={!!lesson}>
              <option value="">— اختر كورساً —</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">المحاضرة</label>
            {loadingLessons ? (
              <div className="flex items-center gap-2 py-3 text-white/30 text-sm"><Loader2 size={14} className="animate-spin" /> جاري التحميل...</div>
            ) : (
              <select value={selectedLesson} onChange={e => setSelectedLesson(e.target.value)} className="w-full form-select glass-input" disabled={!!lesson || !selectedCourse}>
                <option value="">— اختر محاضرة —</option>
                {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            )}
          </div>

          <div className="border-t border-white/08 pt-2" />

          <div>
            <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">عنوان البودكاست</label>
            <input type="text" value={podcastTitle} onChange={e => setPodcastTitle(e.target.value)} placeholder="مثال: جلسة قواعد البيانات المباشرة" className="w-full glass-input" dir="rtl" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">رابط Zoom / المنصة</label>
            <div className="relative">
              <input type="url" value={podcastUrl} onChange={e => setPodcastUrl(e.target.value)} placeholder="https://zoom.us/j/..." className="w-full glass-input pl-10" dir="ltr" />
              <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            </div>
            {podcastUrl && (
              <a href={podcastUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-brand-blue hover:underline">
                <ExternalLink size={11} /> اختبر الرابط
              </a>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-red/10 text-brand-red text-sm border border-brand-red/20">
              <AlertCircle size={14} />{error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-white/08 gap-3">
          {lesson?.live_podcast_url ? (
            <button onClick={handleClear} disabled={saving} className="flex items-center gap-1.5 text-brand-red/60 hover:text-brand-red text-sm transition-colors">
              <Trash2 size={13} /> حذف البودكاست
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary text-sm px-4 py-2">إلغاء</button>
            <button onClick={handleSave} disabled={saving || !selectedLesson} className="btn-primary flex items-center gap-2 text-sm px-5 py-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              حفظ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PodcastRow({ lesson, onEdit }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/02 transition-all border border-white/04 group">
      <div className="w-9 h-9 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
        <Radio size={15} className="text-brand-blue" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">{lesson.live_podcast_title || lesson.title}</p>
        <p className="text-white/35 text-xs truncate mt-0.5">{lesson.course_name} — {lesson.title}</p>
      </div>
      {lesson.live_podcast_url && (
        <a href={lesson.live_podcast_url} target="_blank" rel="noopener noreferrer"
           className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-dark-700/60 text-white/30 text-xs hover:text-white/60 transition-colors max-w-[160px] truncate"
           onClick={e => e.stopPropagation()}>
          <ExternalLink size={10} />
          <span className="truncate">{lesson.live_podcast_url}</span>
        </a>
      )}
      <StatusBadge hasUrl={!!lesson.live_podcast_url} />
      <button onClick={() => onEdit(lesson)} className="p-2 btn-ghost rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil size={13} className="text-white/40" />
      </button>
    </div>
  )
}

export default function LivePodcastPage() {
  const [lessons, setLessons]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState("")
  const [search, setSearch]         = useState("")
  const [page, setPage]             = useState(1)
  const [showModal, setShowModal]   = useState(false)
  const [editLesson, setEditLesson] = useState(null)

  const fetchLessons = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const { data: courseData } = await api.get("/academic/courses/")
      const courseList = courseData.results ?? courseData
      const courseMap  = {}
      courseList.forEach(c => { courseMap[c.id] = c.name })

      const { data: unitData } = await api.get("/academic/units/")
      const unitList = unitData.results ?? unitData

      const lessonArrays = await Promise.all(
        (Array.isArray(unitList) ? unitList : []).map(unit =>
          api.get("/academic/lessons/", { params: { unit: unit.id } })
            .then(r => {
              const ls = r.data.results ?? r.data
              return Array.isArray(ls)
                ? ls.map(l => ({ ...l, unit_name: unit.name, unit_course_id: unit.course, course_name: courseMap[unit.course] || "" }))
                : []
            })
            .catch(() => [])
        )
      )
      const withPodcast = lessonArrays.flat().filter(l => l.live_podcast_url)
      setLessons(withPodcast)
    } catch { setError("تعذّر تحميل البيانات.") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchLessons() }, [fetchLessons])

  const filtered  = lessons.filter(l =>
    !search ||
    (l.live_podcast_title || l.title || "").includes(search) ||
    (l.course_name || "").includes(search)
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-blue/15 flex items-center justify-center">
            <Radio size={20} className="text-brand-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-cairo">البودكاست المباشر</h1>
            <p className="text-white/35 text-sm">إدارة جلسات Zoom المرتبطة بالمحاضرات</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={fetchLessons} className="btn-ghost p-2 rounded-xl" title="تحديث">
            <RefreshCw size={15} className={loading ? "animate-spin text-brand-blue" : "text-white/40"} />
          </button>
          <button onClick={() => { setEditLesson(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
            <Plus size={15} /><span className="text-sm">إضافة بودكاست</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "إجمالي البودكاستات", value: lessons.length, color: "text-brand-blue" },
          { label: "بروابط مفعّلة",       value: lessons.filter(l => l.live_podcast_url).length, color: "text-neon-cyan" },
          { label: "كورسات مشاركة",       value: [...new Set(lessons.map(l => l.unit_course_id))].length, color: "text-white/70" },
        ].map(stat => (
          <div key={stat.label} className="glass-card p-4 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-white/35 text-xs mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="text" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="بحث في عنوان البودكاست أو الكورس..."
          className="w-full glass-input pr-10" dir="rtl"
        />
        {search && (
          <button onClick={() => { setSearch(""); setPage(1) }} className="absolute left-3 top-1/2 -translate-y-1/2 btn-ghost p-1 rounded-lg">
            <X size={12} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={28} className="animate-spin text-brand-blue" />
          <p className="text-white/30 text-sm">جاري التحميل...</p>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-brand-red/10 text-brand-red border border-brand-red/20">
          <AlertCircle size={16} />{error}
          <button onClick={fetchLessons} className="mr-auto text-xs underline">إعادة المحاولة</button>
        </div>
      ) : paginated.length === 0 ? (
        search ? (
          <div className="text-center py-16 text-white/30">
            <Search size={28} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد نتائج لـ «{search}»</p>
          </div>
        ) : <EmptyState onAdd={() => { setEditLesson(null); setShowModal(true) }} />
      ) : (
        <div className="space-y-2">
          {paginated.map(lesson => (
            <PodcastRow key={lesson.id} lesson={lesson} onEdit={l => { setEditLesson(l); setShowModal(true) }} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-ghost p-2 rounded-xl disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
          <span className="text-white/40 text-sm px-2">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-ghost p-2 rounded-xl disabled:opacity-30">
            <ChevronLeft size={16} />
          </button>
        </div>
      )}

      {showModal && (
        <PodcastFormModal
          lesson={editLesson}
          onClose={() => { setShowModal(false); setEditLesson(null) }}
          onSaved={() => { setShowModal(false); setEditLesson(null); fetchLessons() }}
        />
      )}
    </div>
  )
}
