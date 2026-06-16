/**
 * pages/dashboard/LectureSupervisorsPage.jsx
 * ─────────────────────────────────────────────────────────────────
 * صفحة إدارة مشرفي المحاضرات — للمدير فقط
 * تتيح: عرض القائمة، البحث، الإنشاء، التفعيل/التعطيل، الحذف
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  UserCog, Plus, Search, Trash2, ToggleLeft, ToggleRight,
  Eye, Loader2, ChevronRight, BookOpen, X, CheckCircle, XCircle,
  AlertTriangle, Users, ShieldCheck, ShieldOff,
} from 'lucide-react'
import api from '../../api/axiosInstance'

/* ── helpers ───────────────────────────────────────────── */
const ROLE_LABEL = { lecture_supervisor: 'مشرف كورسات' }

const INITIAL_FORM = {
  username: '', full_name: '', password: '', email: '', phone: '',
  notes: '', assigned_courses: [],
}

/* ── مكوّن Toast بسيط ──────────────────────────────────── */
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

/* ── مكوّن بطاقة المشرف ────────────────────────────────── */
function SupervisorCard({ profile, onToggle, onDelete, onView }) {
  const user = profile.user
  const courses = profile.assigned_courses_detail || []
  const isActive = user.is_active

  return (
    <div className={`glass-card p-5 flex flex-col gap-4 transition-all duration-300 border ${isActive ? 'border-white/08' : 'border-brand-red/20 opacity-70'}`}>
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-blue/30 to-purple-500/30 flex items-center justify-center border border-brand-blue/20 shrink-0 text-white font-bold text-lg">
          {user.avatar
            ? <img src={user.avatar.startsWith('http') ? user.avatar : `/media/${user.avatar}`} alt="" className="w-12 h-12 rounded-2xl object-cover" />
            : user.full_name?.charAt(0)
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold text-base truncate">{user.full_name}</h3>
            <span className={`badge text-[11px] px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-brand-red/15 text-brand-red border border-brand-red/20'}`}>
              {isActive ? 'نشط' : 'موقوف'}
            </span>
          </div>
          <p className="text-white/40 text-xs mt-0.5">@{user.username}</p>
          {user.email && <p className="text-white/30 text-xs mt-0.5">{user.email}</p>}
          {user.phone && <p className="text-brand-blue/70 text-xs mt-0.5">{user.phone}</p>}
        </div>
      </div>


      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-white/06">
        <button
          onClick={() => onView(profile.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue text-xs font-medium transition-all"
        >
          <Eye size={13} /> عرض الملف
        </button>
        <button
          onClick={() => onToggle(profile)}
          title={isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}
          className={`p-2 rounded-xl transition-all ${isActive ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'}`}
        >
          {isActive ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
        </button>
        <button
          onClick={() => onDelete(profile)}
          title="حذف الحساب"
          className="p-2 rounded-xl bg-brand-red/10 hover:bg-brand-red/20 text-brand-red transition-all"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   الصفحة الرئيسية
   ══════════════════════════════════════════════════════════ */
export default function LectureSupervisorsPage() {
  const navigate = useNavigate()
  const [profiles, setProfiles]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('all') // all | active | inactive
  const [toast, setToast]         = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]           = useState(INITIAL_FORM)
  const [creating, setCreating]   = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]   = useState(false)

  const notify = (msg, type = 'success') => setToast({ msg, type })

  /* ── جلب البيانات ──────────────────────────────────────── */
  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (filter === 'active') params.is_active = 'true'
      if (filter === 'inactive') params.is_active = 'false'
      const { data } = await api.get('/lecture-supervisors/', { params })
      setProfiles(Array.isArray(data) ? data : data.results || [])
    } catch { notify('فشل تحميل البيانات', 'error') }
    finally { setLoading(false) }
  }, [search, filter])

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  /* ── إنشاء مشرف جديد ────────────────────────────────────── */
  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post('/lecture-supervisors/', {
        ...form,
        assigned_courses: [],
      })
      notify('تم إنشاء الحساب بنجاح ✓')
      setShowCreate(false)
      setForm(INITIAL_FORM)
      fetchProfiles()
    } catch (err) {
      const msg = err.response?.data?.username?.[0] || err.response?.data?.detail || 'فشل إنشاء الحساب'
      notify(msg, 'error')
    } finally { setCreating(false) }
  }

  /* ── تفعيل/تعطيل ────────────────────────────────────────── */
  const handleToggle = async (profile) => {
    try {
      const { data } = await api.post(`/lecture-supervisors/${profile.id}/toggle-active/`)
      notify(data.detail)
      setProfiles(prev => prev.map(p =>
        p.id === profile.id ? { ...p, user: { ...p.user, is_active: data.is_active } } : p
      ))
    } catch { notify('فشل تغيير الحالة', 'error') }
  }

  /* ── حذف ────────────────────────────────────────────────── */
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/lecture-supervisors/${deleteTarget.id}/`)
      notify('تم حذف الحساب')
      setProfiles(prev => prev.filter(p => p.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch { notify('فشل الحذف', 'error') }
    finally { setDeleting(false) }
  }



  const stats = {
    total: profiles.length,
    active: profiles.filter(p => p.user.is_active).length,
    inactive: profiles.filter(p => !p.user.is_active).length,
  }

  return (
    <>
      <Helmet>
        <title>مشرفو الكورسات — نمبر ون</title>
        <meta name="description" content="إدارة حسابات مشرفي الكورسات في النظام" />
      </Helmet>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="space-y-6" dir="rtl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-blue to-purple-500 flex items-center justify-center shadow-lg">
              <UserCog size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-cairo font-bold text-xl">مشرفو الكورسات</h1>
              <p className="text-white/40 text-xs">إدارة حسابات مشرفي الكورسات</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus size={15} /> إضافة مشرف
          </button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'إجمالي المشرفين', value: stats.total, color: 'brand-blue' },
            { label: 'نشطون', value: stats.active, color: 'emerald' },
            { label: 'موقوفون', value: stats.inactive, color: 'brand-red' },
          ].map(s => (
            <div key={s.label} className="glass-card p-4 text-center">
              <p className={`text-2xl font-bold text-${s.color}-400`}>{s.value}</p>
              <p className="text-white/40 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="glass-card p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="بحث بالاسم أو اسم المستخدم أو البريد..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pr-9 text-sm w-full"
            />
          </div>
          <div className="flex gap-2">
            {[['all', 'الكل'], ['active', 'النشطون'], ['inactive', 'الموقوفون']].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${filter === v ? 'bg-brand-blue text-white' : 'glass-card-strong text-white/60 hover:text-white'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-brand-blue" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Users size={40} className="mx-auto text-white/20 mb-3" />
            <p className="text-white/40 font-medium">لا يوجد مشرفو كورسات</p>
            <p className="text-white/20 text-sm mt-1">اضغط على "إضافة مشرف" لإنشاء أول حساب</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map(p => (
              <SupervisorCard
                key={p.id}
                profile={p}
                onView={id => navigate(`/dashboard/lecture-supervisors/${id}`)}
                onToggle={handleToggle}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* ══ Modal: إنشاء مشرف ══════════════════════════════════ */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/85 backdrop-blur-md" dir="rtl">
          <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto custom-scrollbar rounded-2xl shadow-2xl border border-white/10"
            style={{ background: 'rgba(13,17,23,0.97)', backdropFilter: 'blur(32px)' }}>

            {/* ── رأس الـ Modal ── */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/08"
              style={{ background: 'rgba(13,17,23,0.95)', backdropFilter: 'blur(20px)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-blue to-purple-600 flex items-center justify-center shadow-lg">
                  <UserCog size={17} className="text-white" />
                </div>
                <div>
                  <h2 className="text-white font-cairo font-bold text-base">إضافة مشرف كورسات</h2>
                  <p className="text-white/30 text-[11px]">سيُنشأ حساب جديد بصلاحيات محدودة</p>
                </div>
              </div>
              <button onClick={() => { setShowCreate(false); setForm(INITIAL_FORM) }}
                className="w-8 h-8 rounded-xl bg-white/05 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-6">

              {/* ── قسم 1: معلومات الحساب ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1 h-4 rounded-full bg-brand-blue" />
                  <span className="text-white/50 text-xs font-semibold uppercase tracking-widest">معلومات الحساب</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-field">الاسم الكامل <span className="text-brand-red/70">*</span></label>
                    <input required value={form.full_name}
                      onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                      className="input-field" placeholder="أحمد محمد علي" />
                  </div>
                  <div>
                    <label className="label-field">اسم المستخدم <span className="text-brand-red/70">*</span></label>
                    <input required value={form.username}
                      onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                      className="input-field" placeholder="ahmed.ali" dir="ltr" />
                  </div>
                </div>
                <div>
                  <label className="label-field">كلمة المرور <span className="text-brand-red/70">*</span></label>
                  <input required type="password" value={form.password} minLength={6}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    className="input-field" placeholder="6 أحرف على الأقل" />
                </div>
              </div>

              {/* ── فاصل ── */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/08 to-transparent" />

              {/* ── قسم 2: بيانات التواصل ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1 h-4 rounded-full bg-purple-500" />
                  <span className="text-white/50 text-xs font-semibold uppercase tracking-widest">بيانات التواصل</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-field">البريد الإلكتروني</label>
                    <input type="email" value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      className="input-field" placeholder="example@mail.com" dir="ltr" />
                  </div>
                  <div>
                    <label className="label-field">رقم الهاتف</label>
                    <input value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      className="input-field" placeholder="07xx ..." />
                  </div>
                </div>
                <div>
                  <label className="label-field">ملاحظات</label>
                  <textarea value={form.notes} rows={2}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    className="input-field resize-none" placeholder="ملاحظات اختيارية..." />
                </div>
              </div>

              {/* ── فاصل ── */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/08 to-transparent" />

              {/* ── أزرار ── */}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={creating}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: creating ? 'rgba(192,57,43,0.5)' : 'linear-gradient(135deg,#C0392B,#a93226)', boxShadow: creating ? 'none' : '0 4px 20px rgba(192,57,43,0.35)' }}>
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {creating ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}
                </button>
                <button type="button" onClick={() => { setShowCreate(false); setForm(INITIAL_FORM) }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.6)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.09)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ Modal: تأكيد الحذف ═════════════════════════════════ */}
      {deleteTarget && (
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
              سيتم حذف حساب <span className="text-white font-semibold">{deleteTarget.user?.full_name}</span> نهائياً مع جميع بياناته.
            </p>
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={deleting} className="flex-1 btn-danger flex items-center justify-center gap-2 text-sm">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? 'جارٍ الحذف...' : 'تأكيد الحذف'}
              </button>
              <button onClick={() => setDeleteTarget(null)} className="flex-1 btn-secondary text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
