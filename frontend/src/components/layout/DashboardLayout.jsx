/**
 * components/layout/DashboardLayout.jsx
 * لوحة التحكم — Sidebar + Header + Content
 * ─────────────────────────────────────────
 * الميزات:
 *  - Sidebar بقائمة مقسّمة إلى مجموعات منطقية (أقسام مع عناوين فاصلة)
 *  - قائمة تناسب كل دور: admin / manager / teacher / student
 *  - Bell notifications مع عدد غير مقروء، dropdown، وتحديث حالة الرسائل
 *  - Responsive على Mobile و Desktop
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { NavLink, useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard, Users, BookOpen, DollarSign, Settings,
  Megaphone, Inbox, UserCheck, BarChart3, GraduationCap,
  LogOut, Menu, X, Bell, User,
  BookMarked, ClipboardList, Link2, LayoutList, TrendingUp,
  Play, ShieldCheck, UserPlus, FileCheck, HardDrive,
  ChevronLeft, Mail, MailOpen, Loader2, Layers, UserCog,
  KeyRound, Radio, Store,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axiosInstance'

/* ══════════════════════════════════════════════════════════════════
   قوائم التنقل — مجمّعة منطقياً حسب الوظيفة
   ══════════════════════════════════════════════════════════════════ */

/**
 * كل مجموعة: { group: 'اسم القسم', items: [...] }
 * item: { label, icon, href }
 */
const ADMIN_NAV_GROUPS = [
  {
    group: 'الرئيسية',
    items: [
      { label: 'لوحة التحكم', icon: LayoutDashboard, href: '/np-panel' },
    ],
  },
  {
    group: 'إدارة الأشخاص',
    items: [
      { label: 'الطلاب',           icon: Users,         href: '/np-panel/students' },
      { label: 'طلبات التسجيل',    icon: UserPlus,       href: '/np-panel/student-requests' },
      { label: 'شروط التسجيل',    icon: ShieldCheck,    href: '/np-panel/registration-conditions' },
      { label: 'الأساتذة',         icon: GraduationCap,  href: '/np-panel/teachers' },
      { label: 'المشرفات',         icon: UserCheck,      href: '/np-panel/supervisors' },
      { label: 'مشرفو الكورسات',  icon: UserCog,        href: '/np-panel/lecture-supervisors' },
      { label: 'إدارة كلمات المرور', icon: KeyRound,       href: '/np-panel/password-management' },
      { label: 'بطاقات الكادر',    icon: LayoutList,     href: '/np-panel/staff' },
    ],
  },
  {
    group: 'الأكاديمية',
    items: [
      { label: 'المراحل والفصول',   icon: Layers,         href: '/np-panel/academic/levels' },
      { label: 'الكورسات',          icon: BookMarked,     href: '/np-panel/academic/courses' },
      { label: 'المحاضرات',         icon: Play,           href: '/np-panel/academic/lessons' },
      { label: 'البودكاست المباشر', icon: Radio,          href: '/np-panel/academic/live-podcast' },
      { label: 'التسليمات',         icon: ClipboardList,  href: '/np-panel/academic/submissions' },
      { label: 'الاختبارات',        icon: FileCheck,      href: '/np-panel/exams' },
      { label: 'وصول الكورسات',     icon: ShieldCheck,    href: '/np-panel/course-access' },
    ],
  },
  {
    group: 'المالية والتقارير',
    items: [
      { label: 'المالية',           icon: DollarSign,     href: '/np-panel/finance' },
      { label: 'سعر الصرف',        icon: TrendingUp,     href: '/np-panel/exchange-rates' },
      { label: 'التقارير',          icon: BarChart3,      href: '/np-panel/reports' },
    ],
  },
  {
    group: 'التواصل والموقع',
    items: [
      { label: 'الإعلانات',         icon: Megaphone,      href: '/np-panel/announcements' },
      { label: 'صندوق الوارد',      icon: Inbox,          href: '/np-panel/inbox' },
      { label: 'أدوات التواصل',     icon: Link2,          href: '/np-panel/contact-tools' },
      { label: 'إدارة المتجر',      icon: Store,          href: '/np-panel/store' },
    ],
  },
  {
    group: 'النظام',
    items: [
      { label: 'النسخ الاحتياطي',   icon: HardDrive,      href: '/np-panel/backups' },
      { label: 'إعدادات الموقع',    icon: Settings,       href: '/np-panel/settings' },
    ],
  },
]

const TEACHER_NAV_GROUPS = [
  {
    group: 'الرئيسية',
    items: [
      { label: 'لوحة التحكم', icon: LayoutDashboard, href: '/np-panel' },
    ],
  },
  {
    group: 'الأكاديمية',
    items: [
      { label: 'المراحل والفصول',  icon: Layers,        href: '/np-panel/academic/levels' },
      { label: 'الكورسات',         icon: BookMarked,    href: '/np-panel/academic/courses' },
      { label: 'المحاضرات',        icon: Play,          href: '/np-panel/academic/lessons' },
      { label: 'البودكاست المباشر',icon: Radio,         href: '/np-panel/academic/live-podcast' },
      { label: 'التسليمات',        icon: ClipboardList, href: '/np-panel/academic/submissions' },
      { label: 'الاختبارات',       icon: FileCheck,     href: '/np-panel/exams' },
    ],
  },
]

const COURSES_SUPERVISOR_NAV_GROUPS = [
  {
    group: 'الرئيسية',
    items: [
      { label: 'لوحة التحكم', icon: LayoutDashboard, href: '/np-panel' },
    ],
  },
  {
    group: 'الكورسات والمحاضرات',
    items: [
      { label: 'جميع الكورسات',     icon: BookMarked, href: '/np-panel/academic/courses' },
      { label: 'إدارة المحاضرات',  icon: Play,       href: '/np-panel/academic/lessons' },
      { label: 'البودكاست المباشر', icon: Radio,      href: '/np-panel/academic/live-podcast' },
    ],
  },
]

/* ══════════════════════════════════════════════════════════════════
   مكوّن NotificationBell — جلب صندوق الوارد وعرض الإشعارات
   ══════════════════════════════════════════════════════════════════ */
function NotificationBell() {
  const [open,     setOpen]     = useState(false)
  const [messages, setMessages] = useState([])
  const [loading,  setLoading]  = useState(false)
  const [unread,   setUnread]   = useState(0)
  const panelRef = useRef(null)

  // ── جلب الرسائل غير المقروءة (لعدد الشارة) ─────────────────
  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/inbox/', {
        params: { status: 'unread', page: 1 },
      })
      setUnread(data.count ?? (Array.isArray(data) ? data.length : 0))
    } catch {
      // صامت — الواجهة تعمل بدون أخطاء مرئية
    }
  }, [])

  // ── جلب آخر 8 رسائل للعرض في الـ dropdown ────────────────────
  const fetchMessages = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/inbox/', { params: { page: 1 } })
      const list = data.results ?? data
      setMessages(Array.isArray(list) ? list.slice(0, 8) : [])
    } catch {
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [])

  // ── تحديث دوري كل دقيقة ──────────────────────────────────────
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 60_000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // ── فتح / إغلاق الـ Dropdown ─────────────────────────────────
  const togglePanel = () => {
    if (!open) fetchMessages()
    setOpen((v) => !v)
  }

  // ── إغلاق عند الضغط خارج البانل ─────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // ── تحديد رسالة كـ "مفتوحة" عند الضغط عليها ─────────────────
  const markSeen = async (msg) => {
    if (msg.status === 'unread') {
      try {
        await api.patch(`/admin/inbox/${msg.id}/status/`, { status: 'seen' })
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, status: 'seen' } : m))
        )
        setUnread((c) => Math.max(0, c - 1))
      } catch { /* صامت */ }
    }
    setOpen(false)
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* ── زر الجرس ── */}
      <button
        onClick={togglePanel}
        className="btn-ghost p-2 relative rounded-xl transition-all duration-200 hover:bg-white/10"
        aria-label="الإشعارات"
        title="الإشعارات"
      >
        <Bell size={18} className={unread > 0 ? 'text-brand-blue' : 'text-white/60'} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-red text-white text-[10px] font-bold flex items-center justify-center leading-none border-2 border-dark-800 animate-pulse">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* ── Dropdown Panel ── */}
      {open && (
        <div
          className="absolute left-0 top-full mt-2 w-80 glass-card-strong shadow-2xl overflow-hidden z-[9999] border border-white/10 animate-slide-up"
          style={{ minWidth: '300px' }}
        >
          {/* رأس البانل */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-dark-700/50">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-brand-blue" />
              <span className="font-cairo font-semibold text-white text-sm">صندوق الوارد</span>
              {unread > 0 && (
                <span className="badge-red badge text-[10px] px-2 py-0.5">{unread} جديدة</span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="btn-ghost p-1 rounded-lg">
              <X size={14} />
            </button>
          </div>

          {/* قائمة الرسائل */}
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="py-8 flex justify-center">
                <Loader2 size={22} className="animate-spin text-brand-blue" />
              </div>
            ) : messages.length === 0 ? (
              <div className="py-8 text-center text-white/30 text-sm">
                <Inbox size={28} className="mx-auto mb-2 opacity-30" />
                لا توجد رسائل
              </div>
            ) : (
              messages.map((msg) => {
                const isUnread = msg.status === 'unread'
                return (
                  <button
                    key={msg.id}
                    onClick={() => markSeen(msg)}
                    className={`w-full text-right flex items-start gap-3 px-4 py-3 transition-all hover:bg-white/5 border-b border-white/5 last:border-0 ${
                      isUnread ? 'bg-brand-blue/5' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isUnread ? 'bg-brand-blue/20' : 'bg-white/5'
                    }`}>
                      {isUnread
                        ? <Mail size={14} className="text-brand-blue" />
                        : <MailOpen size={14} className="text-white/30" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-medium truncate ${isUnread ? 'text-white' : 'text-white/60'}`}>
                          {msg.sender_name}
                        </p>
                        {isUnread && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-blue shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-white/40 truncate mt-0.5">
                        {msg.subject || '(بدون موضوع)'}
                      </p>
                      <p className="text-[10px] text-white/25 mt-0.5">
                        {new Date(msg.received_at).toLocaleDateString('ar-SA')}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* تذييل — رابط صندوق الوارد الكامل */}
          <div className="border-t border-white/10 bg-dark-700/30">
            <Link
              to="/np-panel/inbox"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 py-2.5 text-xs text-brand-blue hover:text-white transition-colors font-medium"
            >
              عرض كل الرسائل
              <ChevronLeft size={13} />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   مكوّن SidebarNavGroup — عنوان قسم + روابطه
   ══════════════════════════════════════════════════════════════════ */
function SidebarNavGroup({ group, items, onLinkClick }) {
  return (
    <div className="mb-1">
      {/* عنوان القسم */}
      <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/25 select-none">
        {group}
      </p>
      {items.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end={item.href === '/np-panel'}
          className={({ isActive }) =>
            `sidebar-item ${isActive ? 'active' : ''}`
          }
          onClick={onLinkClick}
        >
          <item.icon size={16} className="shrink-0" />
          <span className="font-medium text-sm truncate">{item.label}</span>
        </NavLink>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   المكوّن الرئيسي — DashboardLayout
   ══════════════════════════════════════════════════════════════════ */
export default function DashboardLayout({ children }) {
  const { user, logout, isTeacher, canManage, isLectureSupervisor } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // اختر مجموعات القائمة حسب الدور (الطلاب لا يستخدمون لوحة التحكم الإلكترونية)
  const navGroups = isTeacher
    ? TEACHER_NAV_GROUPS
    : isLectureSupervisor
    ? COURSES_SUPERVISOR_NAV_GROUPS
    : ADMIN_NAV_GROUPS

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  /* ── محتوى الـ Sidebar (مشترك بين Desktop والـ Overlay) ── */
  const SidebarContent = () => (
    <div className="flex flex-col h-full">

      {/* ── الشعار ── */}
      <div className="px-5 py-4 border-b border-white/08">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-red to-brand-blue flex items-center justify-center shrink-0 shadow-lg">
            <GraduationCap size={17} className="text-white" />
          </div>
          <div>
            <p className="font-cairo font-bold text-white text-sm leading-tight">نمبر ون</p>
            <p className="text-white/30 text-[11px]">لوحة التحكم</p>
          </div>
        </div>
      </div>

      {/* ── القائمة ── */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto custom-scrollbar">
        {navGroups.map((grp) => (
          <SidebarNavGroup
            key={grp.group}
            group={grp.group}
            items={grp.items}
            onLinkClick={() => setSidebarOpen(false)}
          />
        ))}
      </nav>

        {/* معلومات المستخدم + تسجيل الخروج */}
        <div className="px-3 py-3 border-t border-white/08 space-y-2">
          {/* بطاقة المستخدم — قابلة للنقر للملف الشخصي */}
          {isLectureSupervisor ? (
            /* مشرف الكورسات: بطاقة غير قابلة للنقر (الملف للعرض فقط) */
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/04">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-red/30 to-brand-blue/30 flex items-center justify-center border border-white/10 shrink-0 overflow-hidden">
                {user?.avatar
                  ? <img src={`/media/${user.avatar}`} alt="" className="w-8 h-8 object-cover" />
                  : <span className="text-white text-xs font-bold">{user?.full_name?.charAt(0) || 'U'}</span>
                }
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-semibold truncate">{user?.full_name}</p>
                <p className="text-white/30 text-[11px] truncate">مشرف الكورسات</p>
              </div>
            </div>
          ) : (
            <NavLink
              to="/np-panel/profile"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2 py-2 rounded-xl transition-all ${
                  isActive ? 'bg-brand-blue/15 border border-brand-blue/20' : 'bg-white/04 hover:bg-white/08'
                }`
              }
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-red/30 to-brand-blue/30 flex items-center justify-center border border-white/10 shrink-0 overflow-hidden">
                {user?.avatar
                  ? <img src={`/media/${user.avatar}`} alt="" className="w-8 h-8 object-cover" />
                  : <span className="text-white text-xs font-bold">{user?.full_name?.charAt(0) || 'U'}</span>
                }
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-semibold truncate">{user?.full_name}</p>
                <p className="text-white/30 text-[11px] truncate">{user?.phone || user?.role}</p>
              </div>
              <User size={13} className="text-white/20 shrink-0" />
            </NavLink>
          )}

          {/* زر الخروج */}
          <button
            onClick={handleLogout}
            className="sidebar-item w-full text-brand-red/60 hover:text-brand-red hover:bg-brand-red/08 transition-all"
          >
            <LogOut size={15} />
            <span className="text-sm">تسجيل الخروج</span>
          </button>
        </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-dark-900 print:bg-white">

      {/* ── Sidebar Desktop ── */}
      <aside className="hidden lg:flex print:hidden flex-col w-60 bg-dark-800/60 border-l border-white/08 shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Sidebar Mobile Overlay ── */}
      {sidebarOpen && (
        <div className="lg:hidden print:hidden fixed inset-0 z-40 flex">
          {/* خلفية ضبابية */}
          <div
            className="absolute inset-0 bg-dark-900/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* الـ Drawer */}
          <aside className="relative z-50 w-64 bg-dark-800 border-l border-white/08 flex flex-col shadow-2xl animate-slide-up">
            {/* زر الإغلاق */}
            <button
              className="absolute top-3 left-3 z-10 btn-ghost p-1.5 rounded-lg text-white/50 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── المنطقة الرئيسية ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <header className="h-14 bg-dark-800/50 border-b border-white/08 flex items-center justify-between px-4 shrink-0 print:hidden backdrop-blur-md">

          {/* زر فتح القائمة على الموبايل */}
          <button
            className="lg:hidden btn-ghost p-2 rounded-xl"
            onClick={() => setSidebarOpen(true)}
            aria-label="القائمة الجانبية"
          >
            <Menu size={20} />
          </button>

          {/* فراغ مرن */}
          <div className="flex-1" />

          {/* أدوات الهيدر */}
          <div className="flex items-center gap-1.5">

            {/* Bell — للمشرفين والمديرين فقط (لديهم صندوق الوارد) */}
            {(canManage) && <NotificationBell />}

            {/* Divider */}
            <div className="w-px h-5 bg-white/10 mx-1" />

            {/* أفاتار المستخدم */}
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/05 transition-colors cursor-default">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-red/40 to-brand-blue/40 flex items-center justify-center border border-white/10 overflow-hidden shrink-0">
                {user?.avatar
                  ? <img src={`/media/${user.avatar}`} alt="" className="w-7 h-7 object-cover" />
                  : <span className="text-white text-xs font-bold">{user?.full_name?.charAt(0) || 'U'}</span>
                }
              </div>
              <div className="hidden sm:block">
                <p className="text-white text-xs font-semibold leading-tight max-w-[110px] truncate">
                  {user?.full_name}
                </p>
                <p className="text-white/30 text-[10px] leading-tight capitalize">
                  {user?.role === 'lecture_supervisor' ? 'مشرف الكورسات' : user?.role}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* ── المحتوى ── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
