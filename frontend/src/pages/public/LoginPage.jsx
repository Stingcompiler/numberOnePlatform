/**
 * pages/public/LoginPage.jsx
 * شاشة تسجيل الدخول — Glassmorphism
 */

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { GraduationCap, User, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState({ username: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setError('')
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور.')
      return
    }
    setLoading(true)
    try {
      const user = await login(form.username, form.password)
      // توجيه بحسب الدور — الطلاب يستخدمون تطبيق الهاتف فقط
      if (user.role === 'student') navigate('/student-app-only', { replace: true })
      else navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data
      if (typeof msg === 'object') {
        setError(Object.values(msg).flat().join(' '))
      } else {
        setError('بيانات الدخول غير صحيحة. يرجى المحاولة مرة أخرى.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>تسجيل الدخول — مدارس ومعاهد نمبر ون</title>
      </Helmet>

      <div className="min-h-screen bg-dark-900 bg-grid flex items-center justify-center px-4 py-16">
        {/* ديكور خلفي */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/4 right-1/3 w-80 h-80 rounded-full bg-brand-blue/6 blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 left-1/3 w-72 h-72 rounded-full bg-brand-red/5 blur-3xl animate-pulse-slow" style={{ animationDelay: '3s' }} />
        </div>

        <div className="relative w-full max-w-md animate-slide-up">
          {/* البطاقة الرئيسية */}
          <div className="glass-card-strong p-8 md:p-10">

            {/* الرأس */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-red to-brand-blue flex items-center justify-center mx-auto mb-4 shadow-neon-blue">
                <GraduationCap size={32} className="text-white" />
              </div>
              <h1 className="font-cairo font-bold text-2xl text-white">تسجيل الدخول</h1>
              <p className="text-white/40 text-sm mt-1">مدارس ومعاهد نمبر ون</p>
            </div>

            {/* النموذج */}
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* اسم المستخدم */}
              <div>
                <label className="text-white/50 text-xs mb-1.5 block font-medium">اسم المستخدم</label>
                <div className="relative">
                  <User size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    type="text"
                    placeholder="admin"
                    required
                    autoComplete="username"
                    className="input-glass pr-10"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* كلمة المرور */}
              <div>
                <label className="text-white/50 text-xs mb-1.5 block font-medium">كلمة المرور</label>
                <div className="relative">
                  <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                    className="input-glass pr-10 pl-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* رسالة الخطأ */}
              {error && (
                <div className="flex items-center gap-2 text-brand-red text-xs bg-brand-red/10 rounded-xl p-3 border border-brand-red/20">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              {/* زر الدخول */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3.5 mt-2 text-base"
              >
                {loading
                  ? <><Loader2 size={18} className="animate-spin" /> جاري الدخول...</>
                  : 'دخول'
                }
              </button>
            </form>

            {/* رابط الرجوع */}
            <div className="mt-6 text-center">
              <Link to="/" className="text-white/30 text-xs hover:text-brand-blue transition-colors">
                ← العودة للصفحة الرئيسية
              </Link>
            </div>
          </div>

          {/* خط سفلي */}
          <div className="neon-line mt-6 opacity-30" />
        </div>
      </div>
    </>
  )
}
