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

  const navLinks = [
    { label: 'الرئيسية',   href: '#hero' },
    { label: 'عن المؤسسة', href: '#about' },
    { label: 'الكادر',     href: '#staff' },
    { label: 'تواصل معنا', href: '#contact' },
  ]

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
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="relative px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 group"
                  style={{ color: 'var(--lp-text-secondary)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand-blue)'; e.currentTarget.style.background = 'var(--brand-blue-soft)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--lp-text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  {link.label}
                  <span
                    className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full scale-x-0 group-hover:scale-x-100 transition-transform origin-right duration-300"
                    style={{ background: 'var(--brand-red)' }}
                  />
                </a>
              </li>
            ))}
          </ul>

          {/* أزرار الهيدر */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              id="navbar-login-btn"
              className="lp-btn-primary hidden sm:inline-flex"
            >
              تسجيل الدخول
            </Link>
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
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center py-3 font-semibold text-sm transition-colors duration-200"
                style={{
                  color: 'var(--lp-text-secondary)',
                  borderBottom: '1px solid var(--lp-border)',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand-blue)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--lp-text-secondary)'; }}
              >
                {link.label}
              </a>
            ))}
            <Link
              to="/login"
              className="lp-btn-primary w-full justify-center mt-4"
              onClick={() => setMobileOpen(false)}
            >
              تسجيل الدخول
            </Link>
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
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-xs font-medium transition-colors duration-200"
                style={{ color: 'rgba(255,255,255,0.45)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
              >
                {link.label}
              </a>
            ))}
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
