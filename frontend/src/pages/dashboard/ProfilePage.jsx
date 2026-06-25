<<<<<<< Updated upstream
/**
 * pages/dashboard/ProfilePage.jsx
 * ─────────────────────────────────────────────────────────────────
 * صفحة الملف الشخصي الموحدة لجميع الأدوار
 * - المدير / الأستاذ: يعرض بياناته ويعدلها
 * - مشرف المحاضرات: يعرض بياناته والكورسات المخصصة له
 * - الطالب: يعرض بياناته الأساسية
 */

import { useState, useRef, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  User, Phone, Mail, Calendar, Edit3, Save, X,
  Lock, Eye, EyeOff, Loader2, CheckCircle, XCircle,
  BookOpen, ShieldCheck, Camera, Badge,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
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
function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-white/06 last:border-0">
      <div className="w-9 h-9 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-brand-blue/70" />
      </div>
      <div>
        <p className="text-white/30 text-[11px] leading-none mb-0.5">{label}</p>
        <p className="text-white text-sm font-medium">{value || '—'}</p>
      </div>
    </div>
  )
}

/* ── RoleBadge meta ──────────────────────────────────────── */
const ROLE_META = {
  admin:              { label: 'مدير النظام',   color: 'from-purple-500 to-brand-blue' },
  manager:            { label: 'مدير',           color: 'from-brand-blue to-cyan-500' },
  teacher:            { label: 'أستاذ',          color: 'from-amber-500 to-orange-500' },
  lecture_supervisor: { label: 'مشرف الكورسات', color: 'from-brand-blue to-purple-500' },
  student:            { label: 'طالب',           color: 'from-emerald-500 to-teal-500' },
}

/* ══════════════════════════════════════════════════════════
   الصفحة الرئيسية
   ══════════════════════════════════════════════════════════ */
export default function ProfilePage() {
  const { user, updateUser, isLectureSupervisor } = useAuth()

  const [toast, setToast]             = useState(null)
  const [editing, setEditing]         = useState(false)
  const [editForm, setEditForm]       = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })
  const [saving, setSaving]           = useState(false)
  const [lsProfile, setLsProfile]     = useState(null)
  const [lsLoading, setLsLoading]     = useState(false)

  // كلمة المرور
  const [changingPass, setChangingPass] = useState(false)
  const [passForm, setPassForm]         = useState({ old_password: '', new_password: '', confirm: '' })
  const [showPass, setShowPass]         = useState({ old: false, new: false, confirm: false })
  const [savingPass, setSavingPass]     = useState(false)

  // رفع الصورة
  const fileRef = useRef(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const notify = (msg, type = 'success') => setToast({ msg, type })
  const roleMeta = ROLE_META[user?.role] || { label: user?.role, color: 'from-white/60 to-white/30' }

  /* ── جلب ملف مشرف المحاضرات ──────────────────────────── */
  useEffect(() => {
    if (!isLectureSupervisor) return
    setLsLoading(true)
    api.get('/lecture-supervisors/me/')
      .then(({ data }) => setLsProfile(data))
      .catch(() => { /* صامت */ })
      .finally(() => setLsLoading(false))
  }, [isLectureSupervisor])

  /* ── حفظ البيانات الأساسية ───────────────────────────── */
  const handleSave = async () => {
    setSaving(true)
    try {
      const endpoint = isLectureSupervisor ? '/lecture-supervisors/me/' : '/auth/me/'
      const { data } = await api.patch(endpoint, editForm)
      updateUser(data)
      notify('تم الحفظ بنجاح ✓')
      setEditing(false)
    } catch { notify('فشل الحفظ', 'error') }
    finally { setSaving(false) }
  }

  /* ── تغيير كلمة المرور ───────────────────────────────── */
  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (passForm.new_password !== passForm.confirm) {
      notify('كلمتا المرور غير متطابقتين', 'error'); return
    }
    setSavingPass(true)
    try {
      await api.post('/auth/change-password/', {
        old_password: passForm.old_password,
        new_password: passForm.new_password,
      })
      notify('تم تغيير كلمة المرور ✓')
      setChangingPass(false)
      setPassForm({ old_password: '', new_password: '', confirm: '' })
    } catch (err) {
      notify(err.response?.data?.old_password?.[0] || 'فشل تغيير كلمة المرور', 'error')
    } finally { setSavingPass(false) }
  }

  /* ── رفع صورة الملف الشخصي ───────────────────────────── */
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('avatar', file)
    setUploadingAvatar(true)
    try {
      const { data } = await api.patch('/auth/me/', fd)
      updateUser({ avatar: data.avatar })
      notify('تم تحديث الصورة ✓')
    } catch { notify('فشل رفع الصورة', 'error') }
    finally { setUploadingAvatar(false) }
  }

  if (!user) return null

  return (
    <>
      <Helmet>
        <title>ملفي الشخصي — نمبر ون</title>
        <meta name="description" content="الملف الشخصي للمستخدم في نظام نمبر ون" />
      </Helmet>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-4xl mx-auto space-y-6" dir="rtl">

        {/* ── Header بطاقة الهوية ── */}
        <div className="glass-card p-6 relative overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${roleMeta.color} opacity-5 pointer-events-none`} />
          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* الصورة */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-brand-blue/30 to-purple-500/30 border-2 border-brand-blue/20 flex items-center justify-center text-white text-3xl font-bold overflow-hidden shadow-xl">
                {user.avatar
                  ? <img src={user.avatar.startsWith('http') ? user.avatar : `/media/${user.avatar}`} alt="" className="w-24 h-24 object-cover" />
                  : <span>{user.full_name?.charAt(0)}</span>
                }
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -left-1 w-8 h-8 bg-brand-blue rounded-xl flex items-center justify-center border-2 border-dark-800 shadow-lg hover:bg-brand-blue/80 transition-all"
                title="تغيير الصورة"
              >
                {uploadingAvatar ? <Loader2 size={13} className="animate-spin text-white" /> : <Camera size={13} className="text-white" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            {/* البيانات */}
            <div className="text-center sm:text-right flex-1">
              <h1 className="text-white font-cairo font-bold text-2xl">{user.full_name}</h1>
              <p className="text-white/40 text-sm mt-0.5">@{user.username}</p>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-brand-blue/10 border border-brand-blue/20 text-brand-blue/90 font-semibold text-sm rounded-full px-3 py-1">
                  <ShieldCheck size={13} />
                  {roleMeta.label}
                </span>
                <span className={`text-xs px-3 py-1 rounded-full font-medium border ${user.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-brand-red/10 text-brand-red border-brand-red/20'}`}>
                  {user.is_active ? 'حساب نشط' : 'حساب موقوف'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* ── البيانات الشخصية ── */}
          <div className="lg:col-span-3 glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <User size={15} className="text-brand-blue" /> البيانات الشخصية
              </h2>
              {/* مشرف الكورسات لا يملك زر التعديل */}
              {!editing && !isLectureSupervisor && (
                <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs text-brand-blue/70 hover:text-brand-blue transition-colors">
                  <Edit3 size={13} /> تعديل
                </button>
              )}
            </div>

            {/* عرض البيانات — دائماً للمشرف، أو عند عدم التعديل */}
            {(!editing || isLectureSupervisor) ? (
              <div>
                <InfoRow icon={User}     label="الاسم الكامل"        value={user.full_name} />
                <InfoRow icon={Badge}    label="اسم المستخدم"         value={`@${user.username}`} />
                <InfoRow icon={Phone}    label="رقم الهاتف"           value={user.phone} />
                <InfoRow icon={Mail}     label="البريد الإلكتروني"   value={user.email} />
                <InfoRow icon={Calendar} label="تاريخ الانضمام"      value={new Date(user.date_joined).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })} />
                {isLectureSupervisor && (
                  <div className="mt-4 flex items-start gap-3 px-3 py-3 rounded-xl bg-amber-500/05 border border-amber-500/15">
                    <ShieldCheck size={16} className="text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-amber-400/80 text-xs leading-relaxed">
                      حسابك مُدار من قِبَل مدير النظام. لتعديل بياناتك تواصل معه مباشرةً.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { key: 'full_name', label: 'الاسم الكامل',       type: 'text'  },
                  { key: 'email',     label: 'البريد الإلكتروني', type: 'email' },
                  { key: 'phone',     label: 'رقم الهاتف',          type: 'text'  },
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
                <div className="flex gap-3 pt-2">
                  <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                  </button>
                  <button onClick={() => setEditing(false)} className="btn-secondary flex-1 text-sm">إلغاء</button>
                </div>
              </div>
            )}
          </div>


          {/* ── اللوحة الجانبية ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* كلمة المرور — مخفية لمشرف الكورسات */}
            {!isLectureSupervisor && (
            <div className="glass-card p-5">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-4">
                <Lock size={14} className="text-brand-blue" /> الأمان وكلمة المرور
              </h3>
              {!changingPass ? (
                <button
                  onClick={() => setChangingPass(true)}
                  className="btn-secondary w-full text-sm flex items-center justify-center gap-2"
                >
                  <Lock size={13} /> تغيير كلمة المرور
                </button>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-3">
                  {[
                    { key: 'old_password', label: 'كلمة المرور الحالية', showKey: 'old' },
                    { key: 'new_password', label: 'كلمة المرور الجديدة', showKey: 'new' },
                    { key: 'confirm',      label: 'تأكيد كلمة المرور',   showKey: 'confirm' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="label-field">{f.label}</label>
                      <div className="relative">
                        <input
                          type={showPass[f.showKey] ? 'text' : 'password'}
                          required
                          value={passForm[f.key]}
                          onChange={e => setPassForm(p => ({ ...p, [f.key]: e.target.value }))}
                          className="input-field w-full text-sm pl-9"
                          minLength={f.key !== 'old_password' ? 6 : undefined}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(p => ({ ...p, [f.showKey]: !p[f.showKey] }))}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                        >
                          {showPass[f.showKey] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={savingPass} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
                      {savingPass ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      {savingPass ? 'جارٍ...' : 'حفظ'}
                    </button>
                    <button type="button" onClick={() => setChangingPass(false)} className="btn-secondary flex-1 text-sm">إلغاء</button>
                  </div>
                </form>
              )}
            </div>
            )}

            {/* مشرف المحاضرات: الكورسات المخصصة */}
            {isLectureSupervisor && (
              <div className="glass-card p-5">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-4">
                  <BookOpen size={14} className="text-brand-blue" /> كورساتي المخصصة
                </h3>
                {lsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 size={20} className="animate-spin text-brand-blue" />
                  </div>
                ) : (lsProfile?.assigned_courses_detail?.length || 0) === 0 ? (
                  <p className="text-white/30 text-xs text-center py-3">لا توجد كورسات مخصصة بعد</p>
                ) : (
                  <div className="space-y-2">
                    {lsProfile.assigned_courses_detail.map(c => (
                      <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-brand-blue/08 border border-brand-blue/15">
                        <BookOpen size={13} className="text-brand-blue/60 shrink-0" />
                        <div>
                          <p className="text-white/90 text-xs font-medium">{c.name}</p>
                          <p className="text-white/30 text-[11px]">{c.grade}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-white/20 text-[11px] mt-3 text-center">
                  يمنحك المدير صلاحية إدارة محاضرات هذه الكورسات فقط
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
=======
/**
 * pages/dashboard/ProfilePage.jsx
 * ─────────────────────────────────────────────────────────────────
 * صفحة الملف الشخصي الموحدة لجميع الأدوار
 * - المدير / الأستاذ: يعرض بياناته ويعدلها
 * - مشرف المحاضرات: يعرض بياناته والكورسات المخصصة له
 * - الطالب: يعرض بياناته الأساسية
 */

import { useState, useRef, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  User, Phone, Mail, Calendar, Edit3, Save, X,
  Lock, Eye, EyeOff, Loader2, CheckCircle, XCircle,
  BookOpen, ShieldCheck, Camera, Badge,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
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
function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-white/06 last:border-0">
      <div className="w-9 h-9 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-brand-blue/70" />
      </div>
      <div>
        <p className="text-white/30 text-[11px] leading-none mb-0.5">{label}</p>
        <p className="text-white text-sm font-medium">{value || '—'}</p>
      </div>
    </div>
  )
}

/* ── RoleBadge meta ──────────────────────────────────────── */
const ROLE_META = {
  admin: { label: 'مدير النظام', color: 'from-purple-500 to-brand-blue' },
  manager: { label: 'مدير', color: 'from-brand-blue to-cyan-500' },
  teacher: { label: 'أستاذ', color: 'from-amber-500 to-orange-500' },
  lecture_supervisor: { label: 'مشرف الكورسات', color: 'from-brand-blue to-purple-500' },
  student: { label: 'طالب', color: 'from-emerald-500 to-teal-500' },
}

/* ══════════════════════════════════════════════════════════
   الصفحة الرئيسية
   ══════════════════════════════════════════════════════════ */
export default function ProfilePage() {
  const { user, updateUser, isLectureSupervisor } = useAuth()

  const [toast, setToast] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })
  const [saving, setSaving] = useState(false)
  const [lsProfile, setLsProfile] = useState(null)
  const [lsLoading, setLsLoading] = useState(false)

  // كلمة المرور
  const [changingPass, setChangingPass] = useState(false)
  const [passForm, setPassForm] = useState({ old_password: '', new_password: '', confirm: '' })
  const [showPass, setShowPass] = useState({ old: false, new: false, confirm: false })
  const [savingPass, setSavingPass] = useState(false)

  // رفع الصورة
  const fileRef = useRef(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const notify = (msg, type = 'success') => setToast({ msg, type })
  const roleMeta = ROLE_META[user?.role] || { label: user?.role, color: 'from-white/60 to-white/30' }

  /* ── جلب ملف مشرف المحاضرات ──────────────────────────── */
  useEffect(() => {
    if (!isLectureSupervisor) return
    setLsLoading(true)
    api.get('/lecture-supervisors/me/')
      .then(({ data }) => setLsProfile(data))
      .catch(() => { /* صامت */ })
      .finally(() => setLsLoading(false))
  }, [isLectureSupervisor])

  /* ── حفظ البيانات الأساسية ───────────────────────────── */
  const handleSave = async () => {
    setSaving(true)
    try {
      const endpoint = isLectureSupervisor ? '/lecture-supervisors/me/' : '/auth/me/'
      const { data } = await api.patch(endpoint, editForm)
      updateUser(data)
      notify('تم الحفظ بنجاح ✓')
      setEditing(false)
    } catch { notify('فشل الحفظ', 'error') }
    finally { setSaving(false) }
  }

  /* ── تغيير كلمة المرور ───────────────────────────────── */
  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (passForm.new_password !== passForm.confirm) {
      notify('كلمتا المرور غير متطابقتين', 'error'); return
    }
    setSavingPass(true)
    try {
      await api.post('/auth/change-password/', {
        old_password: passForm.old_password,
        new_password: passForm.new_password,
      })
      notify('تم تغيير كلمة المرور ✓')
      setChangingPass(false)
      setPassForm({ old_password: '', new_password: '', confirm: '' })
    } catch (err) {
      notify(err.response?.data?.old_password?.[0] || 'فشل تغيير كلمة المرور', 'error')
    } finally { setSavingPass(false) }
  }

  /* ── رفع صورة الملف الشخصي ───────────────────────────── */
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('avatar', file)
    setUploadingAvatar(true)
    try {
      const { data } = await api.patch('/auth/me/', fd)
      updateUser({ avatar: data.avatar })
      notify('تم تحديث الصورة ✓')
    } catch { notify('فشل رفع الصورة', 'error') }
    finally { setUploadingAvatar(false) }
  }

  if (!user) return null

  return (
    <>
      <Helmet>
        <title>ملفي الشخصي — نمبر ون</title>
        <meta name="description" content="الملف الشخصي للمستخدم في نظام نمبر ون" />
      </Helmet>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-4xl mx-auto space-y-6" dir="rtl">

        {/* ── Header بطاقة الهوية ── */}
        <div className="glass-card p-6 relative overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${roleMeta.color} opacity-5 pointer-events-none`} />
          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* الصورة */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-brand-blue/30 to-purple-500/30 border-2 border-brand-blue/20 flex items-center justify-center text-white text-3xl font-bold overflow-hidden shadow-xl">
                {user.avatar
                  ? <img src={user.avatar.startsWith('http') ? user.avatar : `/media/${user.avatar}`} alt="" className="w-24 h-24 object-cover" />
                  : <span>{user.full_name?.charAt(0)}</span>
                }
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -left-1 w-8 h-8 bg-brand-blue rounded-xl flex items-center justify-center border-2 border-dark-800 shadow-lg hover:bg-brand-blue/80 transition-all"
                title="تغيير الصورة"
              >
                {uploadingAvatar ? <Loader2 size={13} className="animate-spin text-white" /> : <Camera size={13} className="text-white" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            {/* البيانات */}
            <div className="text-center sm:text-right flex-1">
              <h1 className="text-white font-cairo font-bold text-2xl">{user.full_name}</h1>
              <p className="text-white/40 text-sm mt-0.5">@{user.username}</p>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-brand-blue/10 border border-brand-blue/20 text-brand-blue/90 font-semibold text-sm rounded-full px-3 py-1">
                  <ShieldCheck size={13} />
                  {roleMeta.label}
                </span>
                <span className={`text-xs px-3 py-1 rounded-full font-medium border ${user.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-brand-red/10 text-brand-red border-brand-red/20'}`}>
                  {user.is_active ? 'حساب نشط' : 'حساب موقوف'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* ── البيانات الشخصية ── */}
          <div className="lg:col-span-3 glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <User size={15} className="text-brand-blue" /> البيانات الشخصية
              </h2>
              {/* مشرف الكورسات لا يملك زر التعديل */}
              {!editing && !isLectureSupervisor && (
                <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs text-brand-blue/70 hover:text-brand-blue transition-colors">
                  <Edit3 size={13} /> تعديل
                </button>
              )}
            </div>

            {/* عرض البيانات — دائماً للمشرف، أو عند عدم التعديل */}
            {(!editing || isLectureSupervisor) ? (
              <div>
                <InfoRow icon={User} label="الاسم الكامل" value={user.full_name} />
                <InfoRow icon={Badge} label="اسم المستخدم" value={`@${user.username}`} />
                <InfoRow icon={Phone} label="رقم الهاتف" value={user.phone} />
                <InfoRow icon={Mail} label="البريد الإلكتروني" value={user.email} />
                <InfoRow icon={Calendar} label="تاريخ الانضمام" value={new Date(user.date_joined).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })} />
                {isLectureSupervisor && (
                  <div className="mt-4 flex items-start gap-3 px-3 py-3 rounded-xl bg-amber-500/05 border border-amber-500/15">
                    <ShieldCheck size={16} className="text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-amber-400/80 text-xs leading-relaxed">
                      حسابك مُدار من قِبَل مدير النظام. لتعديل بياناتك تواصل معه مباشرةً.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { key: 'full_name', label: 'الاسم الكامل', type: 'text' },
                  { key: 'email', label: 'البريد الإلكتروني', type: 'email' },
                  { key: 'phone', label: 'رقم الهاتف', type: 'text' },
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
                <div className="flex gap-3 pt-2">
                  <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                  </button>
                  <button onClick={() => setEditing(false)} className="btn-secondary flex-1 text-sm">إلغاء</button>
                </div>
              </div>
            )}
          </div>


          {/* ── اللوحة الجانبية ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* كلمة المرور — مخفية لمشرف الكورسات */}
            {!isLectureSupervisor && (
              <div className="glass-card p-5">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-4">
                  <Lock size={14} className="text-brand-blue" /> الأمان وكلمة المرور
                </h3>
                {!changingPass ? (
                  <button
                    onClick={() => setChangingPass(true)}
                    className="btn-secondary w-full text-sm flex items-center justify-center gap-2"
                  >
                    <Lock size={13} /> تغيير كلمة المرور
                  </button>
                ) : (
                  <form onSubmit={handleChangePassword} className="space-y-3">
                    {[
                      { key: 'old_password', label: 'كلمة المرور الحالية', showKey: 'old' },
                      { key: 'new_password', label: 'كلمة المرور الجديدة', showKey: 'new' },
                      { key: 'confirm', label: 'تأكيد كلمة المرور', showKey: 'confirm' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="label-field">{f.label}</label>
                        <div className="relative">
                          <input
                            type={showPass[f.showKey] ? 'text' : 'password'}
                            required
                            value={passForm[f.key]}
                            onChange={e => setPassForm(p => ({ ...p, [f.key]: e.target.value }))}
                            className="input-field w-full text-sm pl-9"
                            minLength={f.key !== 'old_password' ? 6 : undefined}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPass(p => ({ ...p, [f.showKey]: !p[f.showKey] }))}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                          >
                            {showPass[f.showKey] ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <button type="submit" disabled={savingPass} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
                        {savingPass ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        {savingPass ? 'جارٍ...' : 'حفظ'}
                      </button>
                      <button type="button" onClick={() => setChangingPass(false)} className="btn-secondary flex-1 text-sm">إلغاء</button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* مشرف المحاضرات: الكورسات المخصصة */}
            {isLectureSupervisor && (
              <div className="glass-card p-5">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-4">
                  <BookOpen size={14} className="text-brand-blue" /> كورساتي المخصصة
                </h3>
                {lsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 size={20} className="animate-spin text-brand-blue" />
                  </div>
                ) : (lsProfile?.assigned_courses_detail?.length || 0) === 0 ? (
                  <p className="text-white/30 text-xs text-center py-3">لا توجد كورسات مخصصة بعد</p>
                ) : (
                  <div className="space-y-2">
                    {lsProfile.assigned_courses_detail.map(c => (
                      <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-brand-blue/08 border border-brand-blue/15">
                        <BookOpen size={13} className="text-brand-blue/60 shrink-0" />
                        <div>
                          <p className="text-white/90 text-xs font-medium">{c.name}</p>
                          <p className="text-white/30 text-[11px]">{c.grade}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-white/20 text-[11px] mt-3 text-center">
                  يمنحك المدير صلاحية إدارة محاضرات هذه الكورسات فقط
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
>>>>>>> Stashed changes
