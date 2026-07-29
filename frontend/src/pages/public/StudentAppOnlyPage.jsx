/**
 * pages/public/StudentAppOnlyPage.jsx
 * ─────────────────────────────────────────────────────────────────
 * صفحة تُعرض للطلاب عند محاولة الوصول للوحة التحكم عبر المتصفح.
 * المنصة متاحة للطالب من تطبيق الهاتف فقط، ولوحة التحكم على الويب
 * مخصّصة للإدارة والمشرفين والمعلمين.
 */

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  Smartphone, MonitorX, GraduationCap, ArrowRight, Home, Loader2,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function StudentAppOnlyPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [leaving, setLeaving] = useState(false)

  // إنهاء جلسة المتصفح ثم العودة للصفحة الرئيسية
  // (لا يؤثر على جلسة تطبيق الهاتف — لكلٍّ منهما توكن مستقل)
  const backToLogin = async () => {
    setLeaving(true)
    try {
      if (user) await logout()
    } finally {
      // الطالب لا يستخدم لوحة الويب — نعيده للصفحة الرئيسية بدل صفحة الدخول
      navigate('/', { replace: true })
    }
  }

  return (
    <>
      <Helmet>
        <title>الوصول غير متاح عبر المتصفح — مدارس ومعاهد نمبر ون</title>
      </Helmet>

      <div className="min-h-screen bg-dark-900 bg-grid flex items-center justify-center px-4 py-12 sm:py-16">
        {/* ديكور خلفي */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/4 right-1/3 w-80 h-80 rounded-full bg-brand-blue/6 blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 left-1/3 w-72 h-72 rounded-full bg-brand-red/5 blur-3xl animate-pulse-slow" style={{ animationDelay: '3s' }} />
        </div>

        <div className="relative w-full max-w-lg animate-slide-up">
          <div className="glass-card-strong p-6 sm:p-10 text-center">

            {/* الأيقونة */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6">
              <div className="w-full h-full rounded-2xl bg-gradient-to-br from-brand-red to-brand-blue flex items-center justify-center shadow-neon-blue">
                <MonitorX size={40} className="text-white" />
              </div>
              <div className="absolute -bottom-2 -left-2 w-11 h-11 rounded-xl bg-dark-800 border border-white/10 flex items-center justify-center shadow-glass">
                <Smartphone size={20} className="text-brand-blue" />
              </div>
            </div>

            {/* العنوان */}
            <h1 className="font-cairo font-bold text-xl sm:text-2xl text-white leading-snug">
              الوصول غير متاح عبر المتصفح
            </h1>

            <div className="neon-line my-5 sm:my-6 opacity-40" />

            {/* الرسالة */}
            <p className="text-white/60 text-sm sm:text-base leading-relaxed">
              يمكن للطلاب استخدام المنصة من خلال
              <span className="text-white font-medium"> تطبيق الهاتف المحمول </span>
              فقط، بينما لوحة التحكم على الويب مخصصة
              <span className="text-white font-medium"> للإدارة والمشرفين والمعلمين</span>.
            </p>

            {/* تلميح التطبيق */}
            <div className="glass-card mt-6 p-4 flex items-center gap-3 text-right">
              <div className="w-10 h-10 rounded-xl bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center shrink-0">
                <GraduationCap size={18} className="text-brand-blue" />
              </div>
              <p className="text-white/50 text-xs sm:text-sm leading-relaxed">
                حمّل تطبيق <span className="text-white/80 font-medium">نمبر ون</span> على هاتفك
                للوصول إلى محاضراتك وواجباتك واختباراتك.
              </p>
            </div>

            {/* الأزرار */}
            <div className="flex flex-col sm:flex-row gap-3 mt-7">
              <button
                type="button"
                onClick={backToLogin}
                disabled={leaving}
                className="btn-primary flex-1 justify-center py-3"
              >
                {leaving
                  ? <><Loader2 size={16} className="animate-spin" /> جاري الخروج...</>
                  : <><ArrowRight size={16} /> إنهاء الجلسة والخروج</>
                }
              </button>
              <Link to="/" className="btn-secondary flex-1 justify-center py-3">
                <Home size={16} /> الصفحة الرئيسية
              </Link>
            </div>
          </div>

          <div className="neon-line mt-6 opacity-30" />
        </div>
      </div>
    </>
  )
}
