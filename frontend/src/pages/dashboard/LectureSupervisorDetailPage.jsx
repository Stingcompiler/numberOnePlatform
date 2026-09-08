/**
 * pages/dashboard/LectureSupervisorDetailPage.jsx
 * ─────────────────────────────────────────────────────────────────
 * صفحة الملف الشخصي التفصيلي لمشرف محاضرات محدد — للمدير فقط
 * تتيح: تعديل البيانات، إدارة الكورسات المخصصة، تفعيل/تعطيل، حذف
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  ArrowRight, UserCog, Edit3, Save, X, BookOpen, ShieldCheck,
  ShieldOff, Trash2, Loader2, CheckCircle, XCircle, AlertTriangle,
  Phone, Mail, User, Calendar, BookMarked, Plus, Minus,
} from 'lucide-react'
import api from '../../api/axiosInstance'
import fetchAll from '../../api/fetchAll'

/* ── Toast ─────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  const colors = { success: 'bg-emerald-500', error: 'bg-brand-red' }
  return (
    <div className={`fixed bottom-6 left-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-2xl text-white text-sm font-medium shadow-2xl animate-slide-up ${colors[type] || 'bg-dark-600'}`}>
      {type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
      {msg}
      <button onClick={onClose} className="opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}

/* ── InfoRow ─────────────────────────────────────────────── */
function InfoRow({ icon: Icon, label, value, className = '' }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/06 last:border-0">
      <div className="w-8 h-8 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
        <Icon size={14} className="text-brand-blue/70" />
      </div>
      <div>
        <p className="text-white/30 text-[11px]">{label}</p>
        <p className={`text-white text-sm font-medium ${className}`}>{value || '—'}</p>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   الصفحة الرئيسية
   ══════════════════════════════════════════════════════════ */
export default function LectureSupervisorDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [profile, setProfile]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [toast, setToast]             = useState(null)
  const [editing, setEditing]         = useState(false)
  const [editForm, setEditForm]       = useState({})
  const [saving, setSaving]           = useState(false)
  const [toggling, setToggling]       = useState(false)
  const [showDelete, setShowDelete]   = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [courses, setCourses]         = useState([])
  const [assigning, setAssigning]     = useState(null)   // معرّف الكورس الجاري تغييره

  const notify = (msg, type = 'success') => setToast({ msg, type })

  /* ── جلب البيانات ──────────────────────────────────────── */
  const fetchProfile = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/lecture-supervisors/${id}/`)
      setProfile(data)
      setEditForm({
        full_name: data.user.full_name,
        email: data.user.email || '',
        phone: data.user.phone || '',
        notes: data.notes || '',
      })
    } catch { notify('فشل تحميل البيانات', 'error') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  // كل الكورسات لاختيار ما يُخصَّص منها. غير مُجزَّأة عبر fetchAll وإلا
  // ظهرت أول عشرة فقط.
  useEffect(() => {
    fetchAll('/academic/courses/').then(setCourses).catch(() => {})
  }, [])

  /* ── تخصيص الكورسات ─────────────────────────────────────── */
  // الحصر في الباك إند يقرأ assigned_courses. مشرف بلا تخصيص لا يرى
  // محاضرة واحدة — ولم تكن هناك واجهة لملئها إطلاقاً.
  const assignedIds = (profile?.assigned_courses_detail || []).map(c => c.id)

  const setAssigned = async (ids, courseId) => {
    setAssigning(courseId)
    try {
      const { data } = await api.patch(
        `/lecture-supervisors/${id}/`, { assigned_courses: ids },
      )
      setProfile(data)
    } catch (e) {
      notify(e?.response?.data?.detail || 'فشل تحديث الكورسات', 'error')
    }
    finally { setAssigning(null) }
  }

  const addCourse    = (courseId) => setAssigned([...assignedIds, courseId], courseId)
  const removeCourse = (courseId) => setAssigned(assignedIds.filter(i => i !== courseId), courseId)

  /* ── حفظ التعديلات ──────────────────────────────────────── */
  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch(`/lecture-supervisors/${id}/`, { user: editForm, notes: editForm.notes })
      notify('تم الحفظ بنجاح ✓')
      fetchProfile()
      setEditing(false)
    } catch { notify('فشل الحفظ', 'error') }
    finally { setSaving(false) }
  }

  /* ── تفعيل/تعطيل ────────────────────────────────────────── */
  const handleToggle = async () => {
    setToggling(true)
    try {
      const { data } = await api.post(`/lecture-supervisors/${id}/toggle-active/`)
      notify(data.detail)
      setProfile(prev => ({ ...prev, user: { ...prev.user, is_active: data.is_active } }))
    } catch { notify('فشل تغيير الحالة', 'error') }
    finally { setToggling(false) }
  }

  /* ── حذف ────────────────────────────────────────────────── */
  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/lecture-supervisors/${id}/`)
      notify('تم الحذف')
      setTimeout(() => navigate('/np-panel/lecture-supervisors'), 800)
    } catch { notify('فشل الحذف', 'error') }
    finally { setDeleting(false) }
  }


  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 size={32} className="animate-spin text-brand-blue" />
    </div>
  )

  if (!profile) return (
    <div className="glass-card p-8 text-center text-white/40">
      <AlertTriangle size={28} className="mx-auto mb-2 text-brand-red/50" />
      المشرف غير موجود
    </div>
  )

  const user = profile.user
  const isActive = user.is_active

  return (
    <>
      <Helmet>
        <title>{user.full_name} — مشرف كورسات</title>
      </Helmet>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="space-y-6" dir="rtl">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate('/np-panel/lecture-supervisors')} className="btn-ghost p-2 rounded-xl">
            <ArrowRight size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-blue to-purple-500 flex items-center justify-center shadow-lg">
              <UserCog size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-cairo font-bold text-xl">{user.full_name}</h1>
              <p className="text-white/40 text-xs">ملف مشرف الكورسات</p>
            </div>
          </div>
          <div className="mr-auto flex items-center gap-2 flex-wrap">
            <span className={`badge text-xs px-3 py-1 rounded-full font-medium ${isActive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-brand-red/15 text-brand-red border border-brand-red/25'}`}>
              {isActive ? '● نشط' : '● موقوف'}
            </span>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${isActive ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'}`}
            >
              {toggling ? <Loader2 size={13} className="animate-spin" /> : isActive ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
              {isActive ? 'تعطيل' : 'تفعيل'}
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-brand-red/10 hover:bg-brand-red/20 text-brand-red transition-all"
            >
              <Trash2 size={13} /> حذف الحساب
            </button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto w-full space-y-4">
          <div className="glass-card p-6">
            {/* صورة + اسم */}
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-blue/30 to-purple-500/30 border-2 border-brand-blue/20 flex items-center justify-center text-white text-3xl font-bold mb-3 overflow-hidden">
                {user.avatar
                  ? <img src={user.avatar.startsWith('http') ? user.avatar : `/media/${user.avatar}`} alt="" className="w-20 h-20 object-cover" />
                  : user.full_name?.charAt(0)
                }
              </div>
              <h2 className="text-white font-bold text-lg">{user.full_name}</h2>
              <p className="text-white/40 text-sm">@{user.username}</p>
              <span className="mt-2 bg-brand-blue/15 border border-brand-blue/25 text-brand-blue text-xs px-3 py-1 rounded-full">مشرف كورسات</span>
            </div>

            {/* البيانات */}
            <div>
              <InfoRow icon={User} label="اسم المستخدم" value={user.username} />
              <InfoRow icon={Phone} label="الهاتف" value={user.phone} />
              <InfoRow icon={Mail} label="البريد الإلكتروني" value={user.email} />
              <InfoRow icon={Calendar} label="تاريخ الانضمام" value={new Date(user.date_joined).toLocaleDateString('ar-SA')} />
            </div>

            {/* تعديل */}
            <div className="mt-4 pt-4 border-t border-white/08">
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
                >
                  <Edit3 size={14} /> تعديل البيانات
                </button>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-white/60 text-xs font-medium">تعديل البيانات</h4>
                  {[
                    { key: 'full_name', label: 'الاسم الكامل', type: 'text' },
                    { key: 'email', label: 'البريد الإلكتروني', type: 'email' },
                    { key: 'phone', label: 'الهاتف', type: 'text' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="label-field">{f.label}</label>
                      <input
                        type={f.type}
                        value={editForm[f.key] || ''}
                        onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                        className="input-field w-full text-sm"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="label-field">ملاحظات</label>
                    <textarea
                      value={editForm.notes || ''}
                      onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                      className="input-field w-full text-sm resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm">
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      {saving ? 'حفظ...' : 'حفظ'}
                    </button>
                    <button onClick={() => setEditing(false)} className="btn-secondary flex-1 text-sm">إلغاء</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══ الكورسات المخصصة ═══════════════════════════════════ */}
      <div className="glass-card p-5 mt-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <BookMarked size={15} className="text-brand-blue" /> الكورسات المخصصة
          </h3>
          <span className="text-white/40 text-xs">{assignedIds.length} كورس</span>
        </div>
        <p className="text-white/30 text-[11px] mb-4">
          يدير المشرف محاضرات هذه الكورسات وحدها. بلا تخصيص لا يرى أي محاضرة.
        </p>

        {assignedIds.length === 0 && (
          <div className="flex items-start gap-2 px-3 py-2.5 mb-4 rounded-xl bg-amber-500/05 border border-amber-500/15">
            <AlertTriangle size={15} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-amber-400/80 text-xs leading-relaxed">
              لا كورسات مخصصة — هذا المشرف لا يستطيع الوصول إلى أي محاضرة حالياً.
            </p>
          </div>
        )}

        {courses.length === 0 ? (
          <p className="text-white/25 text-xs text-center py-4">لا توجد كورسات في النظام.</p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {courses.map(c => {
              const on = assignedIds.includes(c.id)
              const busy = assigning === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={busy}
                  onClick={() => (on ? removeCourse(c.id) : addCourse(c.id))}
                  aria-pressed={on}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-right transition-colors disabled:opacity-50 ${
                    on
                      ? 'bg-brand-blue/08 border-brand-blue/25'
                      : 'bg-white/02 border-white/06 hover:border-white/12'
                  }`}
                >
                  <span className="shrink-0">
                    {busy
                      ? <Loader2 size={14} className="animate-spin text-brand-blue" />
                      : on
                        ? <Minus size={14} className="text-brand-blue" />
                        : <Plus size={14} className="text-white/30" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xs font-medium truncate ${on ? 'text-white' : 'text-white/70'}`}>
                      {c.name}
                    </span>
                    {c.grade_name && (
                      <span className="block text-white/30 text-[11px] truncate">{c.grade_name}</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ══ Modal: تأكيد الحذف ═════════════════════════════════ */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm" dir="rtl">
          <div className="glass-card-strong w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-brand-red/15 flex items-center justify-center">
                <AlertTriangle size={18} className="text-brand-red" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-base">تأكيد الحذف</h3>
                <p className="text-white/40 text-xs">هذا الإجراء لا يمكن التراجع عنه</p>
              </div>
            </div>
            <p className="text-white/70 text-sm mb-6">
              سيتم حذف حساب <span className="text-white font-semibold">{user.full_name}</span> نهائياً.
            </p>
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={deleting} className="flex-1 btn-danger flex items-center justify-center gap-2 text-sm">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? 'جارٍ الحذف...' : 'تأكيد الحذف'}
              </button>
              <button onClick={() => setShowDelete(false)} className="flex-1 btn-secondary text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
