/**
 * pages/dashboard/LivePodcastPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * إدارة البودكاست المباشر — مرتبطة بالكورس مباشرة
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Radio, Search, Loader2, X, Check, Trash2, Pencil, Plus,
  Link2, AlertCircle, ChevronRight, ChevronLeft, ChevronDown,
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
      <div className="w-16 h-16 rounded-2xl bg-brand-blue/10 flex items-center justify-center shadow-inner">
        <Radio size={28} className="text-brand-blue/60" />
      </div>
      <div>
        <p className="text-white/80 font-bold text-lg">لا توجد بودكاستات مباشرة</p>
        <p className="text-white/40 text-sm mt-1.5 max-w-sm mx-auto">اضغط «إضافة بودكاست» لربط رابط بث مباشر (Zoom، Google Meet، الخ) بكورس دراسي</p>
      </div>
      <button onClick={onAdd} className="btn-primary flex items-center gap-2 mt-4 px-6 py-2.5 rounded-xl shadow-lg shadow-brand-blue/20">
        <Plus size={16} strokeWidth={2.5} />
        <span className="font-semibold">إضافة بودكاست</span>
      </button>
    </div>
  )
}

function CustomSelect({ value, onChange, options, placeholder, disabled, loading }) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectedOption = options.find(o => String(o.id) === String(value))

  return (
    <div className={`relative w-full ${disabled ? "opacity-50 pointer-events-none" : ""}`} ref={wrapperRef}>
      <button
        type="button"
        className="w-full glass-input flex items-center justify-between text-right px-4 py-3 rounded-xl transition-all hover:border-white/20 focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/20 bg-dark-800/50"
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        disabled={disabled || loading}
      >
        <span className={selectedOption ? "text-white truncate font-medium" : "text-white/40 truncate"}>
          {loading ? "جاري التحميل..." : (selectedOption ? selectedOption.label : placeholder)}
        </span>
        {loading ? (
          <Loader2 size={16} className="text-white/40 animate-spin shrink-0 ml-1" />
        ) : (
          <ChevronDown size={16} className={`text-white/40 transition-transform duration-200 shrink-0 ml-1 ${isOpen ? "rotate-180 text-brand-blue" : ""}`} />
        )}
      </button>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 bg-[#1e2738] border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto" dir="rtl">
          {options.length === 0 ? (
            <div className="p-5 text-center text-white/40 text-sm">لا توجد خيارات متاحة</div>
          ) : (
            <div className="p-1.5">
              {options.map(option => (
                <button
                  key={option.id}
                  type="button"
                  className={`w-full text-right px-4 py-3 rounded-lg text-sm transition-colors mb-0.5 last:mb-0 ${
                    String(option.id) === String(value)
                      ? "bg-brand-blue/15 text-brand-blue font-bold"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                  onClick={() => {
                    onChange(option.id)
                    setIsOpen(false)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PodcastFormModal({ course, onClose, onSaved }) {
  const [coursesList, setCoursesList] = useState([])
  const [selectedCourse, setSelectedCourse] = useState(course ? String(course.id) : "")
  const [podcastTitle, setPodcastTitle] = useState(course?.live_podcast_title || "")
  const [podcastUrl, setPodcastUrl]     = useState(course?.live_podcast_url   || "")
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState("")

  useEffect(() => {
    api.get("/academic/courses/").then(({ data }) => {
      const list = data.results ?? data
      setCoursesList(Array.isArray(list) ? list : [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedCourse) { setPodcastTitle(""); setPodcastUrl(""); return }
    const found = coursesList.find(c => String(c.id) === String(selectedCourse))
    if (found) {
      // Only set if not already set from props or user input
      setPodcastTitle(prev => prev || (found.live_podcast_title || ""))
      setPodcastUrl(prev => prev || (found.live_podcast_url || ""))
    }
  }, [selectedCourse, coursesList])

  const handleSave = async () => {
    if (!selectedCourse) { setError("يرجى اختيار كورس."); return }
    if (podcastUrl && !podcastUrl.startsWith("http")) {
      setError("الرابط يجب أن يبدأ بـ http:// أو https://"); return
    }
    setSaving(true); setError("")
    try {
      await api.patch(`/academic/courses/${selectedCourse}/`, {
        live_podcast_title: podcastTitle.trim(),
        live_podcast_url:   podcastUrl.trim(),
      })
      onSaved()
    } catch (e) {
      setError(e.response?.data?.detail || "حدث خطأ أثناء الحفظ.")
    } finally { setSaving(false) }
  }

  const handleClear = async () => {
    if (!selectedCourse) return
    if (!window.confirm("هل تريد إزالة البودكاست من هذا الكورس؟")) return
    setSaving(true); setError("")
    try {
      await api.patch(`/academic/courses/${selectedCourse}/`, { live_podcast_title: "", live_podcast_url: "" })
      onSaved()
    } catch (e) {
      setError(e.response?.data?.detail || "حدث خطأ.")
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-dark-900/80 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-xl glass-card-strong border border-white/10 shadow-2xl animate-slide-up rounded-2xl flex flex-col my-auto relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/05 bg-white/[0.02] rounded-t-2xl">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-blue/15 flex items-center justify-center shadow-inner">
              <Radio size={20} className="text-brand-blue" />
            </div>
            <div>
              <p className="font-bold text-white text-base">{course ? "تعديل البودكاست" : "إضافة بودكاست مباشر"}</p>
              <p className="text-white/40 text-xs mt-0.5">ربط رابط بث مباشر بكورس موجود ضمن المنهج</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-white/40 hover:bg-white/10 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider">الكورس الدراسي</label>
            <CustomSelect
              value={selectedCourse}
              onChange={setSelectedCourse}
              options={coursesList.map(c => ({ id: c.id, label: c.name }))}
              placeholder="— اختر الكورس —"
              disabled={!!course}
            />
          </div>

          <div className="h-px bg-white/05 w-full" />

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider">عنوان البودكاست التوضيحي (اختياري)</label>
              <input
                type="text"
                value={podcastTitle}
                onChange={e => setPodcastTitle(e.target.value)}
                placeholder="مثال: جلسة مراجعة الكورس المباشرة"
                className="w-full glass-input px-4 py-3 rounded-xl transition-all hover:border-white/20 focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/20 bg-dark-800/50"
                dir="rtl"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider">رابط البث (Zoom / Google Meet)</label>
              <div className="relative">
                <input
                  type="url"
                  value={podcastUrl}
                  onChange={e => setPodcastUrl(e.target.value)}
                  placeholder="https://zoom.us/j/..."
                  className="w-full glass-input pl-11 pr-4 py-3 rounded-xl transition-all hover:border-white/20 focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/20 bg-dark-800/50"
                  dir="ltr"
                  disabled={saving}
                />
                <Link2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              </div>
              {podcastUrl && (
                <div className="flex justify-start mt-2.5">
                  <a href={podcastUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-blue/10 text-xs font-medium text-brand-blue hover:bg-brand-blue/20 transition-colors">
                    <ExternalLink size={12} /> تجربة الرابط
                  </a>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-brand-red/10 text-brand-red text-sm border border-brand-red/20 animate-fade-in">
              <AlertCircle size={16} className="shrink-0" />
              <p className="flex-1 font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-5 border-t border-white/05 bg-white/[0.01] rounded-b-2xl">
          {course?.live_podcast_url ? (
            <button
              onClick={handleClear}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-brand-red/70 hover:text-brand-red hover:bg-brand-red/10 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Trash2 size={16} /> إزالة البودكاست
            </button>
          ) : <span />}
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !selectedCourse}
              className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl shadow-lg shadow-brand-blue/20 disabled:opacity-50 disabled:shadow-none"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.5} />}
              <span className="font-semibold">حفظ التغييرات</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PodcastRow({ course, onEdit }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/02 transition-all border border-white/04 group">
      <div className="w-9 h-9 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
        <Radio size={15} className="text-brand-blue" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">{course.live_podcast_title || course.name}</p>
        <p className="text-white/35 text-xs truncate mt-0.5">{course.name}</p>
      </div>
      {course.live_podcast_url && (
        <a href={course.live_podcast_url} target="_blank" rel="noopener noreferrer"
           className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-dark-700/60 text-white/30 text-xs hover:text-white/60 transition-colors max-w-[160px] truncate"
           onClick={e => e.stopPropagation()}>
          <ExternalLink size={10} />
          <span className="truncate">{course.live_podcast_url}</span>
        </a>
      )}
      <StatusBadge hasUrl={!!course.live_podcast_url} />
      <button onClick={() => onEdit(course)} className="p-2 btn-ghost rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil size={13} className="text-white/40" />
      </button>
    </div>
  )
}

export default function LivePodcastPage() {
  const [courses, setCourses]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState("")
  const [search, setSearch]         = useState("")
  const [page, setPage]             = useState(1)
  const [showModal, setShowModal]   = useState(false)
  const [editCourse, setEditCourse] = useState(null)

  const fetchCourses = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const { data } = await api.get("/academic/courses/")
      const list = data.results ?? data
      const withPodcast = (Array.isArray(list) ? list : []).filter(c => c.live_podcast_url)
      setCourses(withPodcast)
    } catch { setError("تعذّر تحميل البيانات.") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchCourses() }, [fetchCourses])

  const filtered  = courses.filter(c =>
    !search ||
    (c.live_podcast_title || c.name || "").includes(search) ||
    (c.name || "").includes(search)
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
            <p className="text-white/35 text-sm">إدارة الجلسات المباشرة المرتبطة بالكورسات</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={fetchCourses} className="btn-ghost p-2 rounded-xl" title="تحديث">
            <RefreshCw size={15} className={loading ? "animate-spin text-brand-blue" : "text-white/40"} />
          </button>
          <button onClick={() => { setEditCourse(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
            <Plus size={15} /><span className="text-sm">إضافة بودكاست</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
        {[
          { label: "إجمالي البودكاستات", value: courses.length, color: "text-brand-blue" },
          { label: "بروابط مفعّلة",       value: courses.filter(c => c.live_podcast_url).length, color: "text-neon-cyan" },
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
          <button onClick={fetchCourses} className="mr-auto text-xs underline">إعادة المحاولة</button>
        </div>
      ) : paginated.length === 0 ? (
        search ? (
          <div className="text-center py-16 text-white/30">
            <Search size={28} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد نتائج لـ «{search}»</p>
          </div>
        ) : <EmptyState onAdd={() => { setEditCourse(null); setShowModal(true) }} />
      ) : (
        <div className="space-y-2">
          {paginated.map(course => (
            <PodcastRow key={course.id} course={course} onEdit={c => { setEditCourse(c); setShowModal(true) }} />
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
          course={editCourse}
          onClose={() => { setShowModal(false); setEditCourse(null) }}
          onSaved={() => { setShowModal(false); setEditCourse(null); fetchCourses() }}
        />
      )}
    </div>
  )
}
