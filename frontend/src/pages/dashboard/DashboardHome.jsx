/**
 * pages/dashboard/DashboardHome.jsx
 * الصفحة الرئيسية للوحة التحكم — إحصائيات + روابط سريعة
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, GraduationCap, DollarSign, BookOpen,
  TrendingUp, UserCheck, Inbox, BarChart3,
  ArrowLeft, Loader2, AlertTriangle, CheckCircle,
  Clock, Star, Megaphone, Image, UserPlus
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axiosInstance'

/* ─ بطاقة إحصائية ─────────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, color, loading, href }) {
  const colorMap = {
    blue: 'from-brand-blue/20 to-brand-blue/5 border-brand-blue/20',
    red: 'from-brand-red/20 to-brand-red/5 border-brand-red/20',
    cyan: 'from-neon-cyan/15 to-neon-cyan/5 border-neon-cyan/20',
    amber: 'from-amber-500/15 to-amber-500/5 border-amber-500/20',
  }
  const iconColorMap = {
    blue: 'text-brand-blue bg-brand-blue/10',
    red: 'text-brand-red bg-brand-red/10',
    cyan: 'text-neon-cyan bg-neon-cyan/10',
    amber: 'text-amber-400 bg-amber-400/10',
  }

  const inner = (
    <div className={`glass-card p-5 bg-gradient-to-br ${colorMap[color]} flex items-center gap-4 group`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconColorMap[color]}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-white/50 text-xs mb-1">{label}</p>
        {loading
          ? <div className="skeleton h-6 w-16 rounded" />
          : <p className="font-cairo font-bold text-2xl text-white">{value ?? '—'}</p>
        }
      </div>
      {href && (
        <ArrowLeft size={16} className="text-white/20 group-hover:text-white/60 transition-colors mr-auto shrink-0" />
      )}
    </div>
  )

  return href ? <Link to={href}>{inner}</Link> : inner
}

/* ─ بطاقة ربط سريع ────────────────────────────────────────────── */
function QuickLink({ label, desc, icon: Icon, href, color = 'blue' }) {
  const c = {
    blue: 'text-brand-blue group-hover:bg-brand-blue/12',
    red: 'text-brand-red  group-hover:bg-brand-red/12',
    cyan: 'text-neon-cyan  group-hover:bg-neon-cyan/12',
  }
  return (
    <Link to={href} className={`glass-card p-4 flex items-center gap-3 group transition-all`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-white/5 ${c[color]} transition-colors shrink-0`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="font-medium text-white text-sm group-hover:text-brand-blue transition-colors">{label}</p>
        <p className="text-white/40 text-xs truncate">{desc}</p>
      </div>
      <ArrowLeft size={14} className="text-white/20 group-hover:text-white/50 transition-colors mr-auto shrink-0" />
    </Link>
  )
}

/* ─ واجهة إحصائيات الطالب ─────────────────────────────────────── */
function StudentDashboard() {
  const { user } = useAuth()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/academic/my-courses/')
      .then(({ data }) => setCourses(data.results || data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ترحيب */}
      <div className="glass-card p-6 bg-gradient-to-r from-brand-blue/10 to-brand-red/5 border-brand-blue/15">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-red/30 to-brand-blue/30 border border-white/10 flex items-center justify-center shrink-0">
            <Star size={24} className="text-white" />
          </div>
          <div>
            <h1 className="font-cairo font-bold text-white text-xl">
              أهلاً، {user?.full_name?.split(' ')[0] || 'طالب'} 👋
            </h1>
            <p className="text-white/50 text-sm mt-0.5">استمر في رحلتك التعليمية</p>
          </div>
        </div>
      </div>

      {/* إحصائيات الطالب */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="كورساتي" value={loading ? null : courses.length} icon={BookOpen} color="blue" loading={loading} href="/dashboard/my-courses" />
        <StatCard label="محاضرات مكتملة" value="—" icon={CheckCircle} color="cyan" />
        <StatCard label="التمارين" value="—" icon={BarChart3} color="amber" href="/dashboard/my-submissions" />
      </div>

      {/* الكورسات النشطة */}
      <div>
        <h2 className="font-cairo font-semibold text-white mb-4 flex items-center gap-2">
          <BookOpen size={18} className="text-brand-blue" /> كورساتي
        </h2>
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[1, 2].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
          </div>
        ) : courses.length === 0 ? (
          <div className="glass-card p-8 text-center text-white/40">
            <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد كورسات متاحة حتى الآن.</p>
            <p className="text-xs mt-1">تواصل مع الإدارة لتفعيل اشتراكك.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <Link key={course.id} to={`/dashboard/my-courses/${course.id}`}
                className="glass-card p-4 group">
                {course.thumbnail && (
                  <img src={`/media/${course.thumbnail}`} alt={course.name}
                    className="w-full h-28 object-cover rounded-xl mb-3" />
                )}
                <h3 className="font-cairo font-semibold text-white text-sm group-hover:text-brand-blue transition-colors">
                  {course.name}
                </h3>
                <p className="text-white/40 text-xs mt-1">{course.grade_name}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─ واجهة إحصائيات الإدارة ────────────────────────────────────── */
function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [staff, setStaff] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/finance/reports/summary/').catch(() => null),
      api.get('/public/staff/').catch(() => null),
      api.get('/public/announcements/').catch(() => null),
    ]).then(([summaryRes, staffRes, annRes]) => {
      setStats({ summary: summaryRes?.data || null })
      setStaff(staffRes?.data?.results || staffRes?.data || [])
      setAnnouncements(annRes?.data?.results || annRes?.data || [])
    }).finally(() => setLoading(false))
  }, [])

  const summary = stats?.summary

  return (
    <div className="space-y-6 animate-fade-in">
      {/* الرأس */}
      <div>
        <h1 className="font-cairo font-bold text-white text-2xl flex items-center gap-2">
          <BarChart3 size={22} className="text-brand-blue" />
          لوحة التحكم
        </h1>
        <p className="text-white/40 text-sm mt-0.5 flex items-center gap-1">
          <Clock size={12} /> {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* الإحصائيات المالية */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي المطلوب"
          value={summary ? `${Number(summary.total_required_sdg).toLocaleString()} ج.س` : null}
          icon={DollarSign} color="blue" loading={loading}
          href="/dashboard/finance"
        />
        <StatCard
          label="إجمالي المحصّل"
          value={summary ? `${Number(summary.total_paid_sdg).toLocaleString()} ج.س` : null}
          icon={TrendingUp} color="cyan" loading={loading}
          href="/dashboard/finance"
        />
        <StatCard
          label="المتبقي"
          value={summary ? `${Number(summary.total_balance_sdg).toLocaleString()} ج.س` : null}
          icon={AlertTriangle} color="amber" loading={loading}
        />
        <StatCard
          label="الطلاب المستوفون"
          value={summary ? `${summary.settled_count} / ${summary.students_count}` : null}
          icon={CheckCircle} color="red" loading={loading}
        />
      </div>

      {/* روابط سريعة */}
      <div>
        <h2 className="font-cairo font-semibold text-white/70 text-sm mb-3">وصول سريع</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickLink label="إدارة الطلاب" desc="تسجيل وعرض الطلاب" icon={Users} href="/dashboard/students" color="blue" />
          <QuickLink label="طلبات التسجيل" desc="الطلبات الواردة من النافذة العامة" icon={UserPlus} href="/dashboard/student-requests" color="cyan" />
          <QuickLink label="الملفات المالية" desc="دفعات وأقساط" icon={DollarSign} href="/dashboard/finance" color="cyan" />
          <QuickLink label=" المراحل والفصول" desc="الهيكل الأكاديمي" icon={BookOpen} href="/dashboard/academic/levels" color="blue" />

          <QuickLink label="  الكورسات والوحدات " desc="الهيكل الأكاديمي" icon={BookOpen} href="/dashboard/academic/courses" color="blue" />
          <QuickLink label="الأساتذة" desc="إدارة هيئة التدريس" icon={GraduationCap} href="/dashboard/teachers" color="red" />
          <QuickLink label="المشرفات" desc="تقارير المشرفات" icon={UserCheck} href="/dashboard/supervisors" color="cyan" />
          <QuickLink label="صندوق الوارد" desc="رسائل الزوار" icon={Inbox} href="/dashboard/inbox" color="blue" />
          <QuickLink label="التقارير المالية" desc="يومي / شهري / سنوي" icon={BarChart3} href="/dashboard/reports" color="cyan" />
          <QuickLink label="الإعلانات" desc="إدارة Slider الصفحة" icon={GraduationCap} href="/dashboard/announcements" color="red" />
          <QuickLink label="إعدادات الموقع" desc="الهوية والرؤية" icon={GraduationCap} href="/dashboard/settings" color="blue" />
        </div>
      </div>

      {/* بطاقة المحصّل بالريال */}
      {summary && (
        <div className="glass-card p-5 bg-gradient-to-r from-brand-blue/10 to-transparent border-brand-blue/15">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={18} className="text-brand-blue" />
            <h3 className="font-cairo font-semibold text-white">المحصَّل بالريال السعودي</h3>
          </div>
          <p className="font-cairo font-bold text-3xl text-brand-blue glow-text-blue">
            {Number(summary.total_paid_sar).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ﷼
          </p>
          <p className="text-white/30 text-xs mt-1">
            محسوب بسعر الصرف المحفوظ لحظة كل دفع — دقيق تاريخياً
          </p>
        </div>
      )}

      {/* الإعلانات النشطة */}
      {announcements.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-cairo font-semibold text-white/70 text-sm flex items-center gap-2">
              <Megaphone size={16} className="text-brand-blue" /> الإعلانات النشطة
            </h2>
            <Link to="/dashboard/announcements" className="text-brand-blue text-xs hover:underline">الكل</Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {announcements.slice(0, 3).map((ann) => (
              <div key={ann.id} className="glass-card p-4">
                {ann.image ? (
                  <img src={ann.image.startsWith('http') ? ann.image : `/media/${ann.image}`} alt=""
                    className="w-full h-24 object-cover rounded-lg mb-3" />
                ) : (
                  <div className="w-full h-24 rounded-lg bg-white/5 flex items-center justify-center mb-3">
                    <Image size={24} className="text-white/20" />
                  </div>
                )}
                <h3 className="font-cairo font-semibold text-white text-sm truncate">{ann.title}</h3>
                {ann.body && <p className="text-white/40 text-xs mt-1 line-clamp-2">{ann.body}</p>}
                <span className="inline-block mt-2 badge badge-green text-xs">نشط</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* الكادر */}
      {staff.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-cairo font-semibold text-white/70 text-sm flex items-center gap-2">
              <Users size={16} className="text-brand-blue" /> الكادر المعروض
            </h2>
            <Link to="/dashboard/staff" className="text-brand-blue text-xs hover:underline">الكل</Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {staff.slice(0, 4).map((s) => (
              <div key={s.id} className="glass-card p-4 flex items-center gap-3">
                {s.display_photo ? (
                  <img src={s.display_photo} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
                    <GraduationCap size={18} className="text-brand-blue" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-medium text-white text-sm truncate">{s.display_name || s.name}</h3>
                  <p className="text-white/40 text-xs">{s.title || '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─ الصادر الرئيسي ────────────────────────────────────────────── */
export default function DashboardHome() {
  const { isStudent } = useAuth()
  return isStudent ? <StudentDashboard /> : <AdminDashboard />
}
