/**
 * pages/dashboard/LivePodcastPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * إدارة البث المباشر — نظام الغرف (الصفحة الرئيسية)
 *
 * يعرض قائمة الغرف، ويسمح بإنشائها وتعديلها. عند النقر على "إدارة الجلسات"، 
 * ينتقل إلى صفحة تفاصيل الغرفة LiveRoomDetailsPage.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  Radio, Plus, Pencil, Trash2, X, Check, Loader2,
  AlertCircle, RefreshCw, ToggleLeft, ToggleRight,
  ArrowLeft
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

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

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
              className="w-full input-glass resize-none"
              dir="rtl"
              placeholder="وصف اختياري للغرفة..."
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
// Room Card
// ─────────────────────────────────────────────────────────────────────────────

function RoomCard({ room, onEditRoom, onDeleteRoom, onToggle, onRefresh }) {
  const navigate = useNavigate()
  const [toggling, setToggling] = useState(false)

  const handleToggle = async () => {
    setToggling(true)
    try { await onToggle(room.id) }
    finally { setToggling(false) }
  }

  return (
    <div className={`glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${room.is_active ? "border-white/08" : "border-white/04 opacity-70"}`}>
      {/* Info */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
          <Radio size={20} className="text-brand-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-bold text-base">{room.room_name}</p>
            <RoomTypeBadge type={room.room_type} />
            {!room.is_active && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/05 text-white/30 border border-white/08">
                معطّلة
              </span>
            )}
          </div>
          <p className="text-white/35 text-xs mt-1 truncate">
            {room.sessions_count || 0} جلسة مجدولة
            {room.description && ` · ${room.description}`}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={handleToggle} disabled={toggling}
          className="p-2.5 rounded-xl btn-ghost disabled:opacity-50"
          title={room.is_active ? "تعطيل الغرفة" : "تفعيل الغرفة"}>
          {toggling
            ? <Loader2 size={18} className="animate-spin text-white/40" />
            : room.is_active
            ? <ToggleRight size={20} className="text-neon-cyan" />
            : <ToggleLeft size={20} className="text-white/30" />
          }
        </button>
        <button onClick={() => onEditRoom(room)} className="p-2.5 rounded-xl btn-ghost" title="تعديل الغرفة">
          <Pencil size={16} className="text-white/40" />
        </button>
        <button onClick={() => onDeleteRoom(room.id, room.room_name)} className="p-2.5 rounded-xl btn-ghost" title="حذف الغرفة">
          <Trash2 size={16} className="text-brand-red/50" />
        </button>
        
        {/* Navigation to details */}
        <button 
          onClick={() => navigate(`/dashboard/academic/live-podcast/rooms/${room.id}`)} 
          className="ml-2 px-4 py-2 rounded-xl bg-brand-blue/10 text-brand-blue font-semibold text-sm hover:bg-brand-blue/20 transition-colors flex items-center gap-2">
          إدارة الجلسات
          <ArrowLeft size={14} />
        </button>
      </div>
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

  const handleToggle = async (roomId) => {
    const { data } = await api.post(`/live/rooms/${roomId}/toggle-active/`)
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, is_active: data.is_active } : r))
  }

  const handleDeleteRoom = async (roomId, roomName) => {
    if (!window.confirm(`هل تريد حذف الغرفة «${roomName}» وجميع جلساتها؟ لا يمكن التراجع.`)) return
    try {
      await api.delete(`/live/rooms/${roomId}/`)
      setRooms(prev => prev.filter(r => r.id !== roomId))
    } catch {
      alert("تعذّر حذف الغرفة.")
    }
  }

  const totalSessions = rooms.reduce((acc, r) => acc + (r.sessions_count || 0), 0)
  const activeRooms   = rooms.filter(r => r.is_active).length

  return (
    <div className="max-w-5xl mx-auto space-y-6" dir="rtl">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-blue/15 flex items-center justify-center">
            <Radio size={20} className="text-brand-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-cairo">الغرف التنظيمية</h1>
            <p className="text-white/35 text-sm">إدارة غرف البث المباشر</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchRooms} className="btn-ghost p-2 rounded-xl" title="تحديث">
            <RefreshCw size={15} className={loading ? "animate-spin text-brand-blue" : "text-white/40"} />
          </button>
          <button
            onClick={() => { setEditRoom(null); setShowForm(true) }}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl">
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
              أنشئ غرفة جديدة ثم ادخل إليها لإضافة جلسات البث المباشر للطلاب.
            </p>
          </div>
          <button onClick={() => { setEditRoom(null); setShowForm(true) }}
            className="btn-primary flex items-center gap-2 mt-2 px-6 py-2.5 rounded-xl">
            <Plus size={16} />
            <span className="font-semibold">إنشاء غرفتك الأولى</span>
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
