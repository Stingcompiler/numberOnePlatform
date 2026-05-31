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
  const [allCourses, setAllCourses]   = useState([])
  const [toast, setToast]             = useState(null)
  const [editing, setEditing]         = useState(false)
  const [editForm, setEditForm]       = useState({})
  const [saving, setSaving]           = useState(false)
  const [toggling, setToggling]       = useState(false)
  const [showDelete, setShowDelete]   = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [courseSearch, setCourseSearch] = useState('')

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

  const fetchCourses = useCallback(async () => {
    try {
      const { data } = await api.get('/academic/courses/')
      setAllCourses(Array.isArray(data) ? data : data.results || [])
    } catch { /* صامت */ }
  }, [])

  useEffect(() => { fetchProfile(); fetchCourses() }, [fetchProfile, fetchCourses])

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
      setTimeout(() => navigate('/dashboard/lecture-supervisors'), 800)
    } catch { notify('فشل الحذف', 'error') }
    finally { setDeleting(false) }
  }

  /* ── إضافة / إزالة كورس ─────────────────────────────────── */
  const handleAssignCourse = async (courseId, assign) => {
    if (!profile) return
    const current = profile.assigned_courses || []
    const next = assign
      ? [...current, courseId]
      : current.filter(c => c !== courseId)
    try {
      await api.patch(`/lecture-supervisors/${id}/`, { assigned_courses: next })
      notify(assign ? 'تم تعيين الكورس ✓' : 'تم إلغاء تعيين الكورس')
      fetchProfile()
    } catch { notify('فشل تحديث الكورسات', 'error') }
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
  const assignedIds = profile.assigned_courses || []

  const filteredCourses = allCourses.filter(c =>
    c.name.toLowerCase().includes(courseSearch.toLowerCase())
  )

  return (
    <>
      <Helmet>
        <title>{user.full_name} — مشرف كورسات</title>
      </Helmet>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="space-y-6" dir="rtl">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate('/dashboard/lecture-supervisors')} className="btn-ghost p-2 rounded-xl">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── الملف الشخصي ── */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass-card p-5">
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
                <InfoRow icon={BookMarked} label="الكورسات المخصصة" value={`${assignedIds.length} كورس`} />
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

          {/* ── إدارة الكورسات ── */}
          <div className="lg:col-span-2">
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <BookOpen size={16} className="text-brand-blue" />
                  الكورسات المخصصة
                </h3>
                <span className="badge bg-brand-blue/15 text-brand-blue border border-brand-blue/25 text-xs px-2 py-0.5">{assignedIds.length} كورس</span>
              </div>

              {/* بحث */}
              <input
                type="text"
                placeholder="بحث في الكورسات..."
                value={courseSearch}
                onChange={e => setCourseSearch(e.target.value)}
                className="input-field w-full text-sm mb-4"
              />

              {/* قائمة الكورسات */}
              <div className="space-y-2 max-h-[480px] overflow-y-auto custom-scrollbar">
                {filteredCourses.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-6">لا توجد كورسات</p>
                ) : filteredCourses.map(course => {
                  const isAssigned = assignedIds.includes(course.id)
                  return (
                    <div
                      key={course.id}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${isAssigned ? 'bg-brand-blue/08 border-brand-blue/20' : 'bg-white/03 border-white/06 hover:bg-white/05'}`}
                    >
                      <div>
                        <p className={`text-sm font-medium ${isAssigned ? 'text-white' : 'text-white/70'}`}>{course.name}</p>
                        <p className="text-white/30 text-xs mt-0.5">{course.grade || '—'}</p>
                      </div>
                      <button
                        onClick={() => handleAssignCourse(course.id, !isAssigned)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${isAssigned ? 'bg-brand-red/10 hover:bg-brand-red/20 text-brand-red' : 'bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue'}`}
                      >
                        {isAssigned ? <><Minus size={12} /> إلغاء التعيين</> : <><Plus size={12} /> تعيين</>}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
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
