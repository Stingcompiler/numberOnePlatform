/**
 * pages/dashboard/LivePodcastPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * إدارة البث المباشر — نظام الغرف والجلسات الجديد
 *
 * الهيكل:
 *   LiveRoom (الغرفة) → يحتوي على → LiveSession (جلسات)
 *
 * الميزات:
 *   • CRUD كامل للغرف (إنشاء، تعديل، حذف، تفعيل/تعطيل)
 *   • CRUD كامل للجلسات داخل كل غرفة
 *   • عرض الجلسات بشكل مدمج داخل بطاقة الغرفة
 *   • اختيار مزود البث، رابط، موعد، حالة
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from "react"
import {
  Radio, Plus, Pencil, Trash2, X, Check, Loader2,
  AlertCircle, RefreshCw, ChevronDown, ChevronUp,
  Link2, ExternalLink, Play, Clock, Calendar,
  Video, Youtube, Monitor, Wifi, ToggleLeft, ToggleRight,
} from "lucide-react"
import api from "../../api/axiosInstance"

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ROOM_TYPES = [
  { value: "online", label: "أونلاين" },
  { value: "flash",  label: "فلاش" },
]

const COURSE_TYPES = [
  { value: "general",    label: "عام" },
  { value: "scientific", label: "علمي" },
  { value: "literary",   label: "أدبي" },
]

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

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

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
        className="w-full glass-input px-4 py-3 rounded-xl text-sm"
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
        className="w-full glass-input px-4 py-3 rounded-xl text-sm bg-dark-800/60 cursor-pointer"
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
// Room Form Modal
// ─────────────────────────────────────────────────────────────────────────────

function RoomFormModal({ room, onClose, onSaved }) {
  const isEdit = !!room
  const [form, setForm] = useState({
    room_name:   room?.room_name   || "",
    room_type:   room?.room_type   || "online",
    course_type: room?.course_type || "general",
    description: room?.description || "",
    is_active:   room?.is_active   ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState("")

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.room_name.trim()) { setError("اسم الغرفة مطلوب."); return }
    setSaving(true); setError("")
    try {
      if (isEdit) {
        await api.patch(`/live/rooms/${room.id}/`, form)
      } else {
        await api.post("/live/rooms/", form)
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-md">
      <div className="w-full max-w-lg glass-card-strong border border-white/10 shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/05">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-blue/15 flex items-center justify-center">
              <Radio size={18} className="text-brand-blue" />
            </div>
            <div>
              <p className="font-bold text-white">{isEdit ? "تعديل الغرفة" : "إنشاء غرفة جديدة"}</p>
              <p className="text-white/35 text-xs mt-0.5">الغرفة التنظيمية للبث المباشر</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-white/40 hover:bg-white/10 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <FormInput
            label="اسم الغرفة *"
            value={form.room_name}
            onChange={e => set("room_name", e.target.value)}
            placeholder="مثال: غرفة البث المباشر — أونلاين"
            disabled={saving}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="نوع النظام *"
              value={form.room_type}
              onChange={v => set("room_type", v)}
              options={ROOM_TYPES}
            />
            <FormSelect
              label="نوع الكورس"
              value={form.course_type}
              onChange={v => set("course_type", v)}
              options={COURSE_TYPES}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>الوصف (اختياري)</FieldLabel>
            <textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              rows={3}
              className="w-full glass-input px-4 py-3 rounded-xl text-sm resize-none"
              dir="rtl"
              placeholder="وصف اختياري للغرفة..."
              disabled={saving}
            />
          </div>

          <ErrorBanner message={error} />
        </div>

        {/* Footer */}
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
// Session Form Modal
// ─────────────────────────────────────────────────────────────────────────────

function SessionFormModal({ roomId, session, onClose, onSaved }) {
  const isEdit = !!session

  // تحويل datetime للتوافق مع input type="datetime-local"
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
    if (!form.scheduled_start)        { setError("موعد البداية مطلوب.");      return }
    if (!form.scheduled_end)          { setError("موعد النهاية مطلوب.");      return }
    if (form.scheduled_end <= form.scheduled_start) {
      setError("موعد النهاية يجب أن يكون بعد موعد البداية.")
      return
    }

    setSaving(true); setError("")
    try {
      const payload = { ...form, room: roomId }
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
        {/* Header */}
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

        {/* Body */}
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

          {/* Stream URL */}
          <div className="space-y-1.5">
            <FieldLabel>رابط البث *</FieldLabel>
            <div className="relative">
              <input
                type="url"
                value={form.stream_url}
                onChange={e => set("stream_url", e.target.value)}
                placeholder="https://zoom.us/j/..."
                className="w-full glass-input pl-11 pr-4 py-3 rounded-xl text-sm"
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

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>موعد البداية *</FieldLabel>
              <input
                type="datetime-local"
                value={form.scheduled_start}
                onChange={e => set("scheduled_start", e.target.value)}
                className="w-full glass-input px-4 py-3 rounded-xl text-sm"
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>موعد النهاية *</FieldLabel>
              <input
                type="datetime-local"
                value={form.scheduled_end}
                onChange={e => set("scheduled_end", e.target.value)}
                className="w-full glass-input px-4 py-3 rounded-xl text-sm"
                disabled={saving}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <FieldLabel>الوصف (اختياري)</FieldLabel>
            <textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              rows={2}
              className="w-full glass-input px-4 py-3 rounded-xl text-sm resize-none"
              dir="rtl"
              placeholder="ملاحظات اختيارية..."
              disabled={saving}
            />
          </div>

          <ErrorBanner message={error} />
        </div>

        {/* Footer */}
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
// Session Row — صف الجلسة داخل بطاقة الغرفة
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
      {/* Provider icon */}
      <div className="w-8 h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0">
        <ProviderIcon size={14} className="text-brand-blue" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">{session.session_name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-white/35 text-xs flex items-center gap-1">
            <Calendar size={10} />
            {formatDate(session.scheduled_start)}
          </span>
          <span className="text-white/20 text-xs">·</span>
          <span className="text-white/35 text-xs flex items-center gap-1">
            <Clock size={10} />
            {formatDate(session.scheduled_end)}
          </span>
        </div>
      </div>

      {/* Status + actions */}
      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={session.status} />
        {session.stream_url && (
          <a href={session.stream_url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="p-1.5 rounded-lg bg-dark-700/60 text-white/25 hover:text-white/60 transition-colors">
            <ExternalLink size={12} />
          </a>
        )}
        <button onClick={() => onEdit(session)}
          className="p-1.5 rounded-lg btn-ghost opacity-0 group-hover:opacity-100 transition-opacity">
          <Pencil size={12} className="text-white/40" />
        </button>
        <button onClick={handleDelete} disabled={deleting}
          className="p-1.5 rounded-lg btn-ghost opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30">
          {deleting ? <Loader2 size={12} className="animate-spin text-brand-red/60" /> : <Trash2 size={12} className="text-brand-red/60" />}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Room Card — بطاقة الغرفة مع جلساتها
// ─────────────────────────────────────────────────────────────────────────────

function RoomCard({ room, onEditRoom, onDeleteRoom, onToggle, onRefresh }) {
  const [expanded,        setExpanded]        = useState(false)
  const [sessions,        setSessions]        = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [editSession,     setEditSession]     = useState(null)
  const [toggling,        setToggling]        = useState(false)

  // تحميل الجلسات عند فتح البطاقة
  useEffect(() => {
    if (!expanded) return
    loadSessions()
  }, [expanded])

  const loadSessions = async () => {
    setLoadingSessions(true)
    try {
      const { data } = await api.get(`/live/rooms/${room.id}/sessions/`)
      const list = Array.isArray(data) ? data : (data.results || [])
      setSessions(list)
    } catch { /* أخطاء الشبكة تُعالج صامتةً */ }
    finally { setLoadingSessions(false) }
  }

  const handleDeleteSession = async (sessionId) => {
    await api.delete(`/live/rooms/${room.id}/sessions/${sessionId}/`)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
  }

  const handleSessionSaved = () => {
    setShowSessionForm(false)
    setEditSession(null)
    loadSessions()
  }

  const handleToggle = async () => {
    setToggling(true)
    try { await onToggle(room.id) }
    finally { setToggling(false) }
  }

  return (
    <div className={`glass-card border transition-all ${room.is_active ? "border-white/08" : "border-white/04 opacity-70"}`}>
      {/* Room Header */}
      <div className="flex items-center gap-4 p-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
          <Radio size={18} className="text-brand-blue" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-bold text-sm">{room.room_name}</p>
            <RoomTypeBadge type={room.room_type} />
            {!room.is_active && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/05 text-white/30 border border-white/08">
                معطّلة
              </span>
            )}
          </div>
          <p className="text-white/35 text-xs mt-0.5">
            {room.sessions_count || 0} جلسة
            {room.description && ` · ${room.description}`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Toggle active */}
          <button onClick={handleToggle} disabled={toggling}
            className="p-2 rounded-xl btn-ghost disabled:opacity-50"
            title={room.is_active ? "تعطيل الغرفة" : "تفعيل الغرفة"}>
            {toggling
              ? <Loader2 size={15} className="animate-spin text-white/40" />
              : room.is_active
              ? <ToggleRight size={18} className="text-neon-cyan" />
              : <ToggleLeft size={18} className="text-white/30" />
            }
          </button>
          <button onClick={() => onEditRoom(room)} className="p-2 rounded-xl btn-ghost">
            <Pencil size={14} className="text-white/40" />
          </button>
          <button onClick={() => onDeleteRoom(room.id, room.room_name)} className="p-2 rounded-xl btn-ghost">
            <Trash2 size={14} className="text-brand-red/50" />
          </button>
          <button onClick={() => setExpanded(e => !e)} className="p-2 rounded-xl btn-ghost">
            {expanded ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
          </button>
        </div>
      </div>

      {/* Sessions panel */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/04 pt-4">
          {/* Sessions header */}
          <div className="flex items-center justify-between">
            <p className="text-white/50 text-xs font-bold uppercase tracking-wider">الجلسات</p>
            <button
              onClick={() => { setEditSession(null); setShowSessionForm(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-blue/10 text-brand-blue text-xs font-semibold hover:bg-brand-blue/20 transition-colors">
              <Plus size={12} />
              إضافة جلسة
            </button>
          </div>

          {/* Sessions list */}
          {loadingSessions ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={20} className="animate-spin text-brand-blue" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-white/25 text-sm">
              <Play size={24} className="mx-auto mb-2 opacity-30" />
              <p>لا توجد جلسات بعد</p>
            </div>
          ) : (
            <div className="space-y-2">
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
      )}

      {/* Session Modal */}
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

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function LivePodcastPage() {
  const [rooms,     setRooms]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState("")
  const [showForm,  setShowForm]  = useState(false)
  const [editRoom,  setEditRoom]  = useState(null)

  // ── Fetch Rooms ────────────────────────────────────────────────────────────
  const fetchRooms = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const { data } = await api.get("/live/rooms/")
      setRooms(Array.isArray(data) ? data : (data.results || []))
    } catch {
      setError("تعذّر تحميل الغرف. يرجى المحاولة مجدداً.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRooms() }, [fetchRooms])

  // ── Toggle Room Active ─────────────────────────────────────────────────────
  const handleToggle = async (roomId) => {
    const { data } = await api.post(`/live/rooms/${roomId}/toggle-active/`)
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, is_active: data.is_active } : r))
  }

  // ── Delete Room ────────────────────────────────────────────────────────────
  const handleDeleteRoom = async (roomId, roomName) => {
    if (!window.confirm(`هل تريد حذف الغرفة «${roomName}» وجميع جلساتها؟ لا يمكن التراجع.`)) return
    try {
      await api.delete(`/live/rooms/${roomId}/`)
      setRooms(prev => prev.filter(r => r.id !== roomId))
    } catch {
      alert("تعذّر حذف الغرفة.")
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalSessions = rooms.reduce((acc, r) => acc + (r.sessions_count || 0), 0)
  const activeRooms   = rooms.filter(r => r.is_active).length

  return (
    <div className="max-w-4xl mx-auto space-y-6" dir="rtl">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-blue/15 flex items-center justify-center">
            <Radio size={20} className="text-brand-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-cairo">البث المباشر</h1>
            <p className="text-white/35 text-sm">إدارة غرف وجلسات البث المباشر</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchRooms} className="btn-ghost p-2 rounded-xl" title="تحديث">
            <RefreshCw size={15} className={loading ? "animate-spin text-brand-blue" : "text-white/40"} />
          </button>
          <button
            onClick={() => { setEditRoom(null); setShowForm(true) }}
            className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl">
            <Plus size={15} />
            <span className="text-sm font-semibold">غرفة جديدة</span>
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "إجمالي الغرف",    value: rooms.length,  color: "text-brand-blue"  },
          { label: "غرف نشطة",        value: activeRooms,   color: "text-neon-cyan"   },
          { label: "إجمالي الجلسات",  value: totalSessions, color: "text-purple-400"  },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-white/35 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={28} className="animate-spin text-brand-blue" />
          <p className="text-white/30 text-sm">جاري تحميل الغرف...</p>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-brand-red/10 text-brand-red border border-brand-red/20">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={fetchRooms} className="mr-auto text-xs underline">إعادة المحاولة</button>
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-blue/10 flex items-center justify-center">
            <Radio size={28} className="text-brand-blue/60" />
          </div>
          <div>
            <p className="text-white/80 font-bold text-lg">لا توجد غرف بث مباشر</p>
            <p className="text-white/40 text-sm mt-1.5 max-w-sm mx-auto">
              أنشئ غرفة جديدة ثم أضف داخلها جلسات البث المباشر (Zoom، Google Meet، إلخ)
            </p>
          </div>
          <button onClick={() => { setEditRoom(null); setShowForm(true) }}
            className="btn-primary flex items-center gap-2 mt-2 px-6 py-2.5 rounded-xl">
            <Plus size={16} />
            <span className="font-semibold">إنشاء غرفة</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {rooms.map(room => (
            <RoomCard
              key={room.id}
              room={room}
              onEditRoom={r => { setEditRoom(r); setShowForm(true) }}
              onDeleteRoom={handleDeleteRoom}
              onToggle={handleToggle}
              onRefresh={fetchRooms}
            />
          ))}
        </div>
      )}

      {/* ── Room Form Modal ── */}
      {showForm && (
        <RoomFormModal
          room={editRoom}
          onClose={() => { setShowForm(false); setEditRoom(null) }}
          onSaved={() => { setShowForm(false); setEditRoom(null); fetchRooms() }}
        />
      )}
    </div>
  )
}
