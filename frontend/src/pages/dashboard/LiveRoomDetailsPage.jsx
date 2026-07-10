/**
 * pages/dashboard/LiveRoomDetailsPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * صفحة تفاصيل غرفة البث المباشر — عرض معلومات الغرفة وإدارة جلساتها
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Radio, Plus, Pencil, Trash2, X, Check, Loader2,
  AlertCircle, RefreshCw, Link2, ExternalLink, Play,
  Clock, Calendar, Video, Youtube, Monitor, Wifi, ArrowRight
} from "lucide-react"
import api from "../../api/axiosInstance"

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDERS = [
  { value: "zoom",        label: "Zoom",           icon: Video },
  { value: "google_meet", label: "Google Meet",    icon: Monitor },
  { value: "teams",       label: "Microsoft Teams", icon: Monitor },
  { value: "youtube",     label: "YouTube Live",   icon: Youtube },
  { value: "other",       label: "أخرى",           icon: Wifi },
]

const SESSION_STATUSES = [
  { value: "upcoming", label: "قادمة",        color: "text-blue-400" },
  { value: "live",     label: "مباشرة الآن",  color: "text-neon-cyan" },
  { value: "ended",    label: "انتهت",         color: "text-white/40" },
  { value: "archived", label: "مؤرشفة",        color: "text-white/25" },
]

function StatusBadge({ status }) {
  const s = SESSION_STATUSES.find(x => x.value === status)
  const isLive = status === "live"
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border
      ${isLive
        ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20"
        : status === "upcoming"
        ? "bg-brand-blue/10 text-brand-blue border-brand-blue/20"
        : "bg-white/5 text-white/30 border-white/10"
      }`}>
      {isLive && <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />}
      {s?.label || status}
    </span>
  )
}

function RoomTypeBadge({ type }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border
      ${type === "online"
        ? "bg-brand-blue/10 text-brand-blue border-brand-blue/20"
        : "bg-purple-500/10 text-purple-400 border-purple-400/20"
      }`}>
      {type === "online" ? "أونلاين" : "فلاش"}
    </span>
  )
}

function FieldLabel({ children }) {
  return (
    <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-1.5">
      {children}
    </label>
  )
}

function FormInput({ label, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <FieldLabel>{label}</FieldLabel>}
      <input
        className="w-full input-glass"
        dir="rtl"
        {...props}
      />
    </div>
  )
}

function FormSelect({ label, options, value, onChange, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <FieldLabel>{label}</FieldLabel>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full input-glass bg-dark-800/60 cursor-pointer"
        dir="rtl"
        {...props}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-brand-red/10 text-brand-red text-sm border border-brand-red/20">
      <AlertCircle size={15} className="shrink-0" />
      <span>{message}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Form Modal
// ─────────────────────────────────────────────────────────────────────────────

function SessionFormModal({ roomId, session, onClose, onSaved }) {
  const isEdit = !!session

  const toLocal = (iso) => {
    if (!iso) return ""
    const d = new Date(iso)
    const pad = n => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const [form, setForm] = useState({
    session_name:    session?.session_name    || "",
    description:     session?.description     || "",
    provider:        session?.provider        || "zoom",
    stream_url:      session?.stream_url      || "",
    scheduled_start: toLocal(session?.scheduled_start) || "",
    scheduled_end:   toLocal(session?.scheduled_end)   || "",
    status:          session?.status          || "upcoming",
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState("")

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.session_name.trim())    { setError("اسم الجلسة مطلوب.");       return }
    if (!form.stream_url.trim())      { setError("رابط البث مطلوب.");         return }
    if (form.scheduled_start && form.scheduled_end && form.scheduled_end <= form.scheduled_start) {
      setError("موعد النهاية يجب أن يكون بعد موعد البداية.")
      return
    }

    setSaving(true); setError("")
    try {
      const payload = { ...form, room: roomId }
      if (!payload.scheduled_start) payload.scheduled_start = null
      if (!payload.scheduled_end)   payload.scheduled_end = null

      if (isEdit) {
        await api.patch(`/live/rooms/${roomId}/sessions/${session.id}/`, payload)
      } else {
        await api.post(`/live/rooms/${roomId}/sessions/`, payload)
      }
      onSaved()
    } catch (e) {
      const data = e.response?.data
      if (typeof data === "object") {
        const msgs = Object.values(data).flat().join(" | ")
        setError(msgs || "حدث خطأ أثناء الحفظ.")
      } else {
        setError("حدث خطأ أثناء الحفظ.")
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-dark-900/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-xl glass-card-strong border border-white/10 shadow-2xl rounded-2xl my-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/05">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neon-cyan/10 flex items-center justify-center">
              <Play size={16} className="text-neon-cyan" />
            </div>
            <div>
              <p className="font-bold text-white">{isEdit ? "تعديل الجلسة" : "إنشاء جلسة جديدة"}</p>
              <p className="text-white/35 text-xs mt-0.5">جلسة بث مباشر</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-white/40 hover:bg-white/10 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <FormInput
            label="اسم الجلسة *"
            value={form.session_name}
            onChange={e => set("session_name", e.target.value)}
            placeholder="مثال: مراجعة شاملة — الفصل الأول"
            disabled={saving}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="مزود البث *"
              value={form.provider}
              onChange={v => set("provider", v)}
              options={PROVIDERS}
            />
            <FormSelect
              label="الحالة"
              value={form.status}
              onChange={v => set("status", v)}
              options={SESSION_STATUSES.map(s => ({ value: s.value, label: s.label }))}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>رابط البث *</FieldLabel>
            <div className="relative">
              <input
                type="url"
                value={form.stream_url}
                onChange={e => set("stream_url", e.target.value)}
                placeholder="https://zoom.us/j/..."
                className="w-full input-glass pl-11 pr-4"
                dir="ltr"
                disabled={saving}
              />
              <Link2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            </div>
            {form.stream_url && (
              <a href={form.stream_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-blue hover:underline mt-1">
                <ExternalLink size={11} /> تجربة الرابط
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>موعد البداية</FieldLabel>
              <input
                type="datetime-local"
                value={form.scheduled_start}
                onChange={e => set("scheduled_start", e.target.value)}
                className="w-full input-glass"
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>موعد النهاية</FieldLabel>
              <input
                type="datetime-local"
                value={form.scheduled_end}
                onChange={e => set("scheduled_end", e.target.value)}
                className="w-full input-glass"
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>الوصف (اختياري)</FieldLabel>
            <textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              rows={2}
              className="w-full input-glass resize-none"
              dir="rtl"
              placeholder="ملاحظات اختيارية..."
              disabled={saving}
            />
          </div>

          <ErrorBanner message={error} />
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/05">
          <button onClick={onClose} disabled={saving}
            className="px-5 py-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/5 text-sm transition-colors disabled:opacity-50">
            إلغاء
          </button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            <span className="font-semibold text-sm">حفظ</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Row
// ─────────────────────────────────────────────────────────────────────────────

function SessionRow({ session, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const provider = PROVIDERS.find(p => p.value === session.provider)
  const ProviderIcon = provider?.icon || Wifi

  const formatDate = (iso) => {
    if (!iso) return "—"
    const d = new Date(iso)
    return d.toLocaleString("ar-EG", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  }

  const handleDelete = async () => {
    if (!window.confirm(`هل تريد حذف الجلسة «${session.session_name}»؟`)) return
    setDeleting(true)
    try { await onDelete(session.id) }
    finally { setDeleting(false) }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-dark-800/40 border border-white/04 group hover:border-white/08 transition-all">
      <div className="w-10 h-10 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0">
        <ProviderIcon size={18} className="text-brand-blue" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">{session.session_name}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-white/35 text-xs flex items-center gap-1">
            <Calendar size={12} />
            {formatDate(session.scheduled_start)}
          </span>
          <span className="text-white/20 text-xs">·</span>
          <span className="text-white/35 text-xs flex items-center gap-1">
            <Clock size={12} />
            {formatDate(session.scheduled_end)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={session.status} />
        {session.stream_url && (
          <a href={session.stream_url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="p-2 rounded-lg bg-dark-700/60 text-white/25 hover:text-white/60 transition-colors">
            <ExternalLink size={14} />
          </a>
        )}
        <button onClick={() => onEdit(session)}
          className="p-2 rounded-lg btn-ghost">
          <Pencil size={14} className="text-white/40" />
        </button>
        <button onClick={handleDelete} disabled={deleting}
          className="p-2 rounded-lg btn-ghost disabled:opacity-30">
          {deleting ? <Loader2 size={14} className="animate-spin text-brand-red/60" /> : <Trash2 size={14} className="text-brand-red/60" />}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function LiveRoomDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [room, setRoom] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [showSessionForm, setShowSessionForm] = useState(false)
  const [editSession, setEditSession] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const roomRes = await api.get(`/live/rooms/${id}/`)
      setRoom(roomRes.data)

      const sessRes = await api.get(`/live/rooms/${id}/sessions/`)
      setSessions(Array.isArray(sessRes.data) ? sessRes.data : (sessRes.data.results || []))
    } catch {
      setError("تعذّر تحميل بيانات الغرفة والجلسات.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDeleteSession = async (sessionId) => {
    await api.delete(`/live/rooms/${id}/sessions/${sessionId}/`)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
  }

  const handleSessionSaved = () => {
    setShowSessionForm(false)
    setEditSession(null)
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={28} className="animate-spin text-brand-blue" />
        <p className="text-white/30 text-sm">جاري تحميل بيانات الغرفة...</p>
      </div>
    )
  }

  if (error || !room) {
    return (
      <div className="max-w-4xl mx-auto space-y-4" dir="rtl">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm mb-4">
          <ArrowRight size={16} /> العودة للغرف
        </button>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-brand-red/10 text-brand-red border border-brand-red/20">
          <AlertCircle size={16} />
          <span>{error || "الغرفة غير موجودة"}</span>
          <button onClick={fetchData} className="mr-auto text-xs underline">إعادة المحاولة</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6" dir="rtl">
      {/* ── Breadcrumb & Header ── */}
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm w-fit">
          <ArrowRight size={16} /> العودة لقائمة الغرف
        </button>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 border-brand-blue/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-blue/15 flex items-center justify-center shrink-0">
              <Radio size={24} className="text-brand-blue" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-white font-cairo">{room.room_name}</h1>
                <RoomTypeBadge type={room.room_type} />
                {!room.is_active && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/05 text-white/30 border border-white/08">
                    معطّلة
                  </span>
                )}
              </div>
              <p className="text-white/40 text-sm mt-1">{room.description || "لا يوجد وصف لهذه الغرفة"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={fetchData} className="btn-ghost p-2 rounded-xl" title="تحديث">
              <RefreshCw size={18} className="text-white/40" />
            </button>
            <button
              onClick={() => { setEditSession(null); setShowSessionForm(true) }}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl">
              <Plus size={16} />
              <span className="text-sm font-semibold">إضافة جلسة</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Sessions List ── */}
      <div className="glass-card">
        <div className="px-6 py-5 border-b border-white/05 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white font-cairo">الجلسات المجدولة ({sessions.length})</h2>
        </div>
        
        <div className="p-6">
          {sessions.length === 0 ? (
            <div className="text-center py-10 text-white/25 text-sm border border-dashed border-white/10 rounded-xl">
              <Play size={28} className="mx-auto mb-3 opacity-30" />
              <p>لا توجد جلسات بعد في هذه الغرفة</p>
              <button
                onClick={() => { setEditSession(null); setShowSessionForm(true) }}
                className="mt-4 px-4 py-2 rounded-lg bg-brand-blue/10 text-brand-blue text-xs font-semibold hover:bg-brand-blue/20 transition-colors">
                إنشاء الجلسة الأولى
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map(s => (
                <SessionRow
                  key={s.id}
                  session={s}
                  onEdit={sess => { setEditSession(sess); setShowSessionForm(true) }}
                  onDelete={handleDeleteSession}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showSessionForm && (
        <SessionFormModal
          roomId={room.id}
          session={editSession}
          onClose={() => { setShowSessionForm(false); setEditSession(null) }}
          onSaved={handleSessionSaved}
        />
      )}
    </div>
  )
}
