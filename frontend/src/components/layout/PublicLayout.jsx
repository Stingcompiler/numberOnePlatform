/**
 * components/layout/PublicLayout.jsx
 * Navbar + Footer للصفحة العامة
 * ─────────────────────────────────────────────────────────────────
 * ألوان المؤسسة: أبيض (خلفية) + أحمر + أزرق (accent)
 */

import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, GraduationCap } from 'lucide-react'

export default function PublicLayout({ children, settings }) {
  const [scrolled,   setScrolled]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setMobileOpen(false), [pathname])

  // المراسي تعمل داخل صفحة الهبوط فقط. من صفحة أخرى (المتجر مثلاً) تُسبَق
  // بـ '/' كي تعود إلى الهبوط ثم تنتقل للقسم، بدل ألا تفعل شيئاً.
  const anchor = (hash) => (pathname === '/' ? hash : `/${hash}`)

  const navLinks = [
    { label: 'الرئيسية',   href: anchor('#hero') },
    { label: 'عن المؤسسة', href: anchor('#about') },
    { label: 'الكادر',     href: anchor('#staff') },
    { label: 'المتجر',     to:   '/store' },
    { label: 'تواصل معنا', href: anchor('#contact') },
  ]

  // رابط المتجر صفحة لا مرساة، فيُرسم بـ <Link>. البقية تبقى <a>.
  const navTag = (link) => (link.to ? Link : 'a')
  const navProps = (link) => (link.to ? { to: link.to } : { href: link.href })

  // الصفحات وحدها تحمل حالة نشطة؛ المراسي تنقل داخل صفحة واحدة فلا
  // تصلح لها. لم تكن الحاجة قائمة قبل أن يصير في الموقع أكثر من صفحة.
  const isActive = (link) => Boolean(link.to) && pathname.startsWith(link.to)

  // اللون الأساسي للرابط — تعيده معالجات المرور بدل افتراض لون واحد،
  // وإلا محا مرورُ الفأرة تمييزَ الصفحة النشطة.
  const restColor = (link) =>
    isActive(link) ? 'var(--brand-blue)' : 'var(--lp-text-secondary)'

  const logoSrc = settings?.logo
    ? (settings.logo.startsWith('http') ? settings.logo : `/media/${settings.logo}`)
    : null

  return (
    <div className="min-h-screen flex flex-col font-tajawal" style={{ background: 'var(--lp-bg)', color: 'var(--lp-text-primary)' }}>

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-400 ${
          scrolled
            ? 'bg-white/98 shadow-sm'
            : 'bg-white/90 backdrop-blur-md'
        }`}
        style={{
          borderBottom: scrolled
            ? '1px solid var(--lp-border)'
            : '1px solid transparent',
        }}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

          {/* اللوجو */}
          <Link to="/" className="flex items-center gap-3 group" aria-label="الصفحة الرئيسية">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt="الشعار"
                className="h-10 w-10 object-contain group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-300"
                style={{ background: 'linear-gradient(135deg, var(--brand-red), var(--brand-blue))' }}
              >
                <GraduationCap size={22} className="text-white" />
              </div>
            )}
            <div className="flex flex-col">
              <span
                className="font-cairo font-black text-lg line-clamp-1 transition-colors duration-200 group-hover:text-brand-red"
                style={{ color: 'var(--lp-text-primary)' }}
              >
                {settings?.institution_name || 'نمبر ون'}
              </span>
            </div>
          </Link>

          {/* قائمة Desktop */}
          <ul className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const Tag = navTag(link)
              return (
              <li key={link.to || link.href}>
                <Tag
                  {...navProps(link)}
                  aria-current={isActive(link) ? 'page' : undefined}
                  className="relative px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 group"
                  style={{
                    color: restColor(link),
                    background: isActive(link) ? 'var(--brand-blue-soft)' : 'transparent',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand-blue)'; e.currentTarget.style.background = 'var(--brand-blue-soft)'; }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = restColor(link)
                    e.currentTarget.style.background = isActive(link) ? 'var(--brand-blue-soft)' : 'transparent'
                  }}
                >
                  {link.label}
                  <span
                    className={`absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full transition-transform origin-right duration-300 ${
                      isActive(link) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                    }`}
                    style={{ background: 'var(--brand-red)' }}
                  />
                </Tag>
              </li>
              )
            })}
          </ul>

          {/* زر القائمة — على الهاتف وحده */}
          {/* أُزيل زر "تسجيل الدخول": لوحة التحكم مخصصة للطاقم، والطلاب
              يستخدمون تطبيق الهاتف. المسار غير معلن ويُدخل إليه مباشرةً.
              لذلك لم يبقَ في هذه الحاوية إلا زر القائمة، وهو للهاتف وحده. */}
          <div className="flex items-center md:hidden">
            <button
              id="navbar-mobile-toggle"
              className="md:hidden p-2 rounded-lg transition-all duration-200"
              style={{ color: 'var(--lp-text-secondary)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand-blue)'; e.currentTarget.style.background = 'var(--brand-blue-soft)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--lp-text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="القائمة"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>

        {/* قائمة Mobile */}
        {mobileOpen && (
          <div
            className="md:hidden px-5 pb-5 pt-2 animate-slide-up shadow-lg"
            style={{
              background: 'white',
              borderTop: '1px solid var(--lp-border)',
            }}
          >
            {navLinks.map((link, i) => {
              const Tag = navTag(link)
              const active = isActive(link)
              return (
              <Tag
                key={link.to || link.href}
                {...navProps(link)}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between py-3 font-semibold text-sm transition-colors duration-200"
                style={{
                  color: active ? 'var(--brand-blue)' : 'var(--lp-text-secondary)',
                  // آخر عنصر بلا حدّ سفلي: لم يعد تحته زر يفصله عنه.
                  borderBottom: i === navLinks.length - 1
                    ? 'none'
                    : '1px solid var(--lp-border)',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand-blue)'; }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = active ? 'var(--brand-blue)' : 'var(--lp-text-secondary)'
                }}
              >
                {link.label}
                {active && (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: 'var(--brand-red)' }}
                    aria-hidden="true"
                  />
                )}
              </Tag>
              )
            })}
          </div>
        )}
      </header>

      {/* ── المحتوى الرئيسي ───────────────────────────────────────── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer style={{ background: 'var(--lp-text-primary)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-7xl mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-6">

          {/* Brand */}
          <div className="flex items-center gap-3">
            {logoSrc ? (
              <img src={logoSrc} alt="" className="h-8 w-8 object-contain opacity-80" />
            ) : (
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, var(--brand-red), var(--brand-blue))' }}
              >
                <GraduationCap size={16} className="text-white" />
              </div>
            )}
            <span className="font-cairo font-bold text-sm" style={{ color: 'rgba(255,255,255,0.80)' }}>
              {settings?.institution_name || 'مدارس ومعاهد نمبر ون'}
            </span>
          </div>

          {/* Nav links */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {navLinks.map((link) => {
              const Tag = navTag(link)
              return (
              <Tag
                key={link.to || link.href}
                {...navProps(link)}
                className="text-xs font-medium transition-colors duration-200"
                style={{ color: 'rgba(255,255,255,0.45)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
              >
                {link.label}
              </Tag>
              )
            })}
          </div>

          {/* Copyright */}
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
            © {new Date().getFullYear()} — جميع الحقوق محفوظة
          </p>
        </div>
      </footer>
    </div>
  )
}
