/**
 * pages/dashboard/PasswordManagementPage.jsx
 * ─────────────────────────────────────────────────────────────────
 * إدارة كلمات المرور — إعادة تعيين كلمة المرور للطلاب ومشرفي الكورسات
 * من قبل مدير النظام بدون الحاجة لكلمة المرور القديمة.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  KeyRound, Search, Users, UserCog, Loader2, X,
  Eye, EyeOff, CheckCircle, AlertTriangle, ShieldCheck, User,
} from 'lucide-react'
import api from '../../api/axiosInstance'

/* ═══════════════════════════════════════════════════════════════════
   المكوّن الرئيسي — PasswordManagementPage
   ═══════════════════════════════════════════════════════════════════ */
export default function PasswordManagementPage() {
  /* ── الحالة ──────────────────────────────────────────────────── */
  const [activeTab, setActiveTab]   = useState('students')       // 'students' | 'supervisors'
  const [users, setUsers]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [search, setSearch]         = useState('')
  const [selectedUser, setSelectedUser] = useState(null)        // المستخدم المراد تغيير كلمة مروره

  /* ── جلب المستخدمين حسب التبويب ─────────────────────────────── */
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const endpoint = activeTab === 'students'
        ? '/students/'
        : '/lecture-supervisors/'
      const params = search ? { search } : {}
      const { data } = await api.get(endpoint, { params })
      // الـ API يُعيد results (paginated) أو مصفوفة مباشرة
      const list = data.results ?? data
      setUsers(Array.isArray(list) ? list : [])
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [activeTab, search])

  useEffect(() => {
    const debounce = setTimeout(fetchUsers, 300)
    return () => clearTimeout(debounce)
  }, [fetchUsers])

  /* ── تبديل التبويب ─────────────────────────────────────────── */
  const switchTab = (tab) => {
    setActiveTab(tab)
    setSearch('')
    setSelectedUser(null)
  }

  /* ── استخراج اسم ومعرف المستخدم الحقيقي (nested user) ──────── */
  const getUserInfo = (item) => {
    if (item.user && typeof item.user === 'object') {
      return {
        id:       item.user.id,
        name:     item.user.full_name,
        username: item.user.username,
        phone:    item.user.phone,
        role:     item.user.role,
        avatar:   item.user.avatar,
      }
    }
    return {
      id:       item.id,
      name:     item.full_name,
      username: item.username,
      phone:    item.phone,
      role:     item.role,
      avatar:   item.avatar,
    }
  }

  /* ── الواجهة ─────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">

      {/* ── العنوان ── */}
      <div>
        <h1 className="font-cairo font-bold text-white text-2xl flex items-center gap-2">
          <KeyRound size={22} className="text-brand-blue" />
          إدارة كلمات المرور
        </h1>
        <p className="text-white/40 text-sm mt-0.5">
          إعادة تعيين كلمات المرور للطلاب ومشرفي الكورسات
        </p>
      </div>

      {/* ── التبويبات ── */}
      <div className="flex gap-2">
        <button
          id="tab-students"
          onClick={() => switchTab('students')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
            activeTab === 'students'
              ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20'
              : 'glass-card-strong text-white/60 hover:text-white hover:bg-white/08'
          }`}
        >
          <Users size={16} />
          الطلاب
        </button>
        <button
          id="tab-supervisors"
          onClick={() => switchTab('supervisors')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
            activeTab === 'supervisors'
              ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20'
              : 'glass-card-strong text-white/60 hover:text-white hover:bg-white/08'
          }`}
        >
          <UserCog size={16} />
          مشرفو الكورسات
        </button>
      </div>

      {/* ── شريط البحث ── */}
      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        <input
          id="search-users"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={activeTab === 'students' ? 'ابحث بالاسم أو رقم الهاتف أو اسم المستخدم...' : 'ابحث باسم المشرف أو اسم المستخدم...'}
          className="w-full pr-10 pl-4 py-3 rounded-xl bg-dark-700/60 border border-white/10 text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-brand-blue/40 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── قائمة المستخدمين ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-brand-blue" />
        </div>
      ) : users.length === 0 ? (
        <div className="glass-card p-12 text-center text-white/40">
          <Users size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">لا يوجد مستخدمون مطابقون</p>
          {search && <p className="text-xs mt-1 text-white/25">جرّب تعديل كلمة البحث</p>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {users.map((item) => {
            const u = getUserInfo(item)
            return (
              <button
                key={u.id}
                id={`user-card-${u.id}`}
                onClick={() => setSelectedUser(u)}
                className="glass-card p-4 flex items-center gap-3 text-right group hover:border-brand-blue/30 transition-all duration-200 cursor-pointer"
              >
                {/* الأفاتار */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-red/20 to-brand-blue/20 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {u.avatar ? (
                    <img src={u.avatar.startsWith('http') ? u.avatar : `/media/${u.avatar}`} alt="" className="w-10 h-10 object-cover" />
                  ) : (
                    <span className="text-white/60 text-sm font-bold">{u.name?.charAt(0) || '?'}</span>
                  )}
                </div>

                {/* المعلومات */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate group-hover:text-brand-blue transition-colors">
                    {u.name}
                  </p>
                  <p className="text-white/35 text-xs truncate mt-0.5">
                    @{u.username}
                    {u.phone ? ` · ${u.phone}` : ''}
                  </p>
                </div>

                {/* أيقونة */}
                <KeyRound size={14} className="text-white/15 group-hover:text-brand-blue/60 transition-colors shrink-0" />
              </button>
            )
          })}
        </div>
      )}

      {/* ── نافذة إعادة تعيين كلمة المرور ── */}
      {selectedUser && (
        <ResetPasswordModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════════════
   نافذة إعادة تعيين كلمة المرور (Modal)
   ═══════════════════════════════════════════════════════════════════ */
function ResetPasswordModal({ user, onClose }) {
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew]                 = useState(false)
  const [showConfirm, setShowConfirm]         = useState(false)
  const [submitting, setSubmitting]           = useState(false)
  const [result, setResult]                   = useState(null)  // { type: 'success'|'error', message }

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword
  const tooShort       = newPassword.length > 0 && newPassword.length < 6
  const canSubmit      = passwordsMatch && !tooShort && !submitting

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setResult(null)

    try {
      const { data } = await api.post('/admin/reset-password/', {
        user_id: user.id,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      setResult({ type: 'success', message: data.detail || 'تم إعادة تعيين كلمة المرور بنجاح.' })
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.new_password?.[0] ||
        err.response?.data?.confirm_password?.[0] ||
        err.response?.data?.user_id?.[0] ||
        'حدث خطأ أثناء إعادة تعيين كلمة المرور.'
      setResult({ type: 'error', message: msg })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* الخلفية الضبابية */}
      <div className="absolute inset-0 bg-dark-900/80 backdrop-blur-sm" onClick={onClose} />

      {/* المحتوى */}
      <div className="relative z-10 w-full max-w-md glass-card-strong border border-white/10 shadow-2xl animate-slide-up overflow-hidden">

        {/* رأس النافذة */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-dark-700/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-blue/15 flex items-center justify-center">
              <KeyRound size={18} className="text-brand-blue" />
            </div>
            <div>
              <h3 className="font-cairo font-bold text-white text-sm">إعادة تعيين كلمة المرور</h3>
              <p className="text-white/40 text-xs mt-0.5">بدون الحاجة لكلمة المرور القديمة</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg text-white/40 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* بطاقة المستخدم المحدد */}
        <div className="px-6 py-4 bg-dark-700/20 border-b border-white/05">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-red/25 to-brand-blue/25 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
              {user.avatar ? (
                <img src={user.avatar.startsWith('http') ? user.avatar : `/media/${user.avatar}`} alt="" className="w-11 h-11 object-cover" />
              ) : (
                <User size={20} className="text-white/50" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-cairo font-semibold text-white text-sm truncate">{user.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-white/35 text-xs">@{user.username}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium ${
                  user.role === 'student'
                    ? 'bg-neon-cyan/10 text-neon-cyan'
                    : 'bg-purple-500/10 text-purple-400'
                }`}>
                  {user.role === 'student' ? 'طالب' : 'مشرف الكورسات'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* نموذج كلمة المرور */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* كلمة المرور الجديدة */}
          <div>
            <label className="block text-white/50 text-xs mb-1.5 font-medium">كلمة المرور الجديدة</label>
            <div className="relative">
              <input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الجديدة (6 أحرف على الأقل)"
                className="w-full pr-4 pl-10 py-2.5 rounded-xl bg-dark-700/60 border border-white/10 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-brand-blue/40 transition-colors"
                autoComplete="new-password"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                tabIndex={-1}
              >
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {tooShort && (
              <p className="text-brand-red text-[11px] mt-1 flex items-center gap-1">
                <AlertTriangle size={11} /> يجب أن تكون 6 أحرف على الأقل
              </p>
            )}
          </div>

          {/* تأكيد كلمة المرور */}
          <div>
            <label className="block text-white/50 text-xs mb-1.5 font-medium">تأكيد كلمة المرور</label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="أعد إدخال كلمة المرور"
                className={`w-full pr-4 pl-10 py-2.5 rounded-xl bg-dark-700/60 border text-white placeholder:text-white/20 text-sm focus:outline-none transition-colors ${
                  confirmPassword && !passwordsMatch
                    ? 'border-brand-red/40 focus:border-brand-red/60'
                    : 'border-white/10 focus:border-brand-blue/40'
                }`}
                autoComplete="new-password"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-brand-red text-[11px] mt-1 flex items-center gap-1">
                <AlertTriangle size={11} /> كلمتا المرور غير متطابقتين
              </p>
            )}
            {passwordsMatch && (
              <p className="text-emerald-400 text-[11px] mt-1 flex items-center gap-1">
                <CheckCircle size={11} /> كلمتا المرور متطابقتان
              </p>
            )}
          </div>

          {/* رسالة النتيجة */}
          {result && (
            <div className={`flex items-start gap-2 p-3 rounded-xl text-sm ${
              result.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-brand-red/10 border border-brand-red/20 text-brand-red'
            }`}>
              {result.type === 'success'
                ? <CheckCircle size={16} className="shrink-0 mt-0.5" />
                : <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              }
              <p className="text-xs leading-relaxed">{result.message}</p>
            </div>
          )}

          {/* أزرار الإجراء */}
          <div className="flex gap-3 pt-1">
            <button
              id="btn-reset-password"
              type="submit"
              disabled={!canSubmit}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                canSubmit
                  ? 'bg-brand-blue text-white hover:bg-brand-blue/90 shadow-lg shadow-brand-blue/20'
                  : 'bg-white/05 text-white/25 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ShieldCheck size={16} />
              )}
              {submitting ? 'جاري التحديث...' : 'تعيين كلمة المرور'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium glass-card-strong text-white/60 hover:text-white hover:bg-white/08 transition-all"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
