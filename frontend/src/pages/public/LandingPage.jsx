/**
 * pages/public/LandingPage.jsx
 * ─────────────────────────────────────────────────────────────────
 * صفحة الهبوط الديناميكية الكاملة — تستمد بياناتها من /api/public/site-data/
 *
 * الأقسام:
 *  1. Hero & CTA
 *  2. Announcements Slider
 *  3. About (Vision / Mission / Objectives / History)
 *  4. Staff Cards  (Teaching & Administrative)
 *  5. Contact Tools + Contact Form
 */

import { useEffect, useState, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  GraduationCap, ChevronLeft, ChevronRight, Eye, Target,
  BookOpen, Users, Phone, Mail, Send, MapPin,
  MessageSquare, CheckCircle, AlertCircle, Loader2,
  Sparkles, ArrowLeft, Star, Instagram, Youtube,
  Facebook, Twitter, Globe,
  User, UserPlus,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../../api/axiosInstance'
import PublicLayout from '../../components/layout/PublicLayout'

/* ─── خريطة أيقونات التواصل ──────────────────────────────────── */
const TOOL_ICONS = {
  whatsapp: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.464 3.488" />
    </svg>
  ),
  telegram: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>,
  facebook: () => <Facebook size={20} />,
  instagram: () => <Instagram size={20} />,
  twitter: () => <Twitter size={20} />,
  youtube: () => <Youtube size={20} />,
  phone: () => <Phone size={20} />,
  email: () => <Mail size={20} />,
  website: () => <Globe size={20} />,
  other: () => <Globe size={20} />,
}

/* ─── مكون الـ Slider ────────────────────────────────────────── */
function AnnouncementSlider({ announcements }) {
  const [idx, setIdx] = useState(0)
  const timerRef = useRef(null)

  const next = () => setIdx((i) => (i + 1) % announcements.length)
  const prev = () => setIdx((i) => (i - 1 + announcements.length) % announcements.length)

  useEffect(() => {
    if (announcements.length <= 1) return
    timerRef.current = setInterval(next, 5000)
    return () => clearInterval(timerRef.current)
  }, [announcements.length])

  if (!announcements.length) return null
  const ann = announcements[idx]

  return (
    <div id="announcements" className="relative overflow-hidden rounded-2xl h-[300px] md:h-[400px] group" style={{boxShadow:'0 4px 24px rgba(0,0,0,0.10)'}}>
      {/* الصورة الخلفية */}
      {ann.image ? (
        <img
          src={ann.image.startsWith('http') ? ann.image : `/media/${ann.image}`}
          alt={ann.title}
          className="absolute inset-0 w-full h-full object-cover transition-all duration-700"
        />
      ) : (
        <div className="absolute inset-0" style={{background:'linear-gradient(135deg, var(--lp-text-primary), var(--brand-blue))'}} />
      )}

      {/* تدرج علوي */}
      <div className="absolute inset-0 bg-gradient-to-t from-dark-900/90 via-dark-900/40 to-transparent" />

      {/* المحتوى */}
      <div className="absolute bottom-0 inset-x-0 p-6 md:p-8 animate-slide-up">
        <h3 className="font-cairo font-bold text-xl md:text-2xl text-white mb-2">
          {ann.title}
        </h3>
        {ann.body && (
          <p className="text-white/70 text-sm md:text-base line-clamp-2">{ann.body}</p>
        )}
        {ann.link && (
          <a href={ann.link} target="_blank" rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm hover:underline" style={{color:'var(--brand-blue-light)'}}>
            <ArrowLeft size={14} /> اقرأ المزيد
          </a>
        )}
      </div>

      {/* أزرار التنقل */}
      {announcements.length > 1 && (
        <>
          <button onClick={prev}
            className="absolute right-3 top-1/2 -translate-y-1/2 light-card p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight size={18} />
          </button>
          <button onClick={next}
            className="absolute left-3 top-1/2 -translate-y-1/2 light-card p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronLeft size={18} />
          </button>

          {/* Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {announcements.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'w-6' : 'w-1.5 bg-white/40'}`}
                style={i === idx ? { background: 'var(--brand-blue)' } : {}}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ─── مكون بطاقة عضو الكادر ─────────────────────────────────── */
function StaffCard({ member }) {
  const photo = member.display_photo
    ? (member.display_photo.startsWith('http') ? member.display_photo : `/media/${member.display_photo}`)
    : null

  return (
    <div className="light-card p-5 text-center group cursor-default">
      {/* الصورة */}
      <div className="relative mx-auto w-20 h-20 mb-4">
        {photo ? (
          <img src={photo} alt={member.display_name} className="w-20 h-20 rounded-full object-cover transition-all" style={{outline:'2px solid rgba(26,86,219,0.25)',outlineOffset:'2px'}} />
        ) : (
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{background:'var(--lp-bg-muted)',outline:'2px solid rgba(26,86,219,0.15)',outlineOffset:'2px'}}>
            <Users size={32} style={{color:'rgba(26,86,219,0.40)'}} />
          </div>
        )}
        <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-white flex items-center justify-center" style={{boxShadow:'0 1px 4px rgba(0,0,0,0.12)'}}>
          <Star size={10} style={{color:'var(--brand-blue)',fill:'var(--brand-blue)'}} />
        </div>
      </div>

      <h3 className="font-cairo font-bold text-base transition-colors" style={{color:'var(--lp-text-primary)'}}>
        {member.display_name || member.name}
      </h3>

      {member.title && (
        <p className="text-xs mt-1" style={{color:'var(--lp-text-secondary)'}}>{member.title}</p>
      )}

      {member.bio && (
        <p className="text-xs mt-2 line-clamp-2 leading-relaxed" style={{color:'var(--lp-text-muted)'}}>{member.bio}</p>
      )}

      <div className="mt-3">
        <span className={`badge ${member.card_type === 'academic' ? 'badge-blue' : 'badge-red'} text-xs`}>
          {member.card_type_display}
        </span>
      </div>
    </div>
  )
}

/* ─── مكون نموذج التواصل ─────────────────────────────────────── */
function ContactForm() {
  const [form, setForm] = useState({ sender_name: '', sender_phone: '', sender_email: '', subject: '', message: '' })
  const [status, setStatus] = useState('idle')  // idle | loading | success | error
  const [errMsg, setErrMsg] = useState('')

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('loading')
    try {
      await api.post('/public/contact/', form)
      setStatus('success')
      setForm({ sender_name: '', sender_phone: '', sender_email: '', subject: '', message: '' })
    } catch (err) {
      setStatus('error')
      setErrMsg(err.response?.data?.detail || 'حدث خطأ. يرجى المحاولة مجدداً.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="light-card p-6 md:p-8 space-y-4">
      <h3 className="font-cairo font-bold text-dark-900 text-lg flex items-center gap-2">
        <MessageSquare size={20} className="text-brand-blue" />
        أرسل لنا رسالة
      </h3>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-dark-500 text-xs mb-1 block">الاسم *</label>
          <input name="sender_name" value={form.sender_name} onChange={handleChange}
            required placeholder="اسمك الكامل" className="input-light" />
        </div>
        <div>
          <label className="text-dark-500 text-xs mb-1 block">رقم الهاتف</label>
          <input name="sender_phone" value={form.sender_phone} onChange={handleChange}
            placeholder="+249..." className="input-light" />
        </div>
      </div>

      <div>
        <label className="text-dark-500 text-xs mb-1 block">البريد الإلكتروني</label>
        <input name="sender_email" value={form.sender_email} onChange={handleChange}
          type="email" placeholder="example@email.com" className="input-light" />
      </div>

      <div>
        <label className="text-dark-500 text-xs mb-1 block">الموضوع</label>
        <input name="subject" value={form.subject} onChange={handleChange}
          placeholder="موضوع رسالتك" className="input-light" />
      </div>

      <div>
        <label className="text-dark-500 text-xs mb-1 block">الرسالة *</label>
        <textarea name="message" value={form.message} onChange={handleChange}
          required rows={4} placeholder="اكتب رسالتك هنا..."
          className="input-light resize-none" />
      </div>

      {/* ردود الفعل */}
      {status === 'success' && (
        <div className="flex items-center gap-2 text-sm rounded-xl p-3" style={{color:'#059669',background:'rgba(5,150,105,0.08)',border:'1px solid rgba(5,150,105,0.20)'}}>
          <CheckCircle size={16} /> تم إرسال رسالتك بنجاح. سنتواصل معك قريباً!
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-brand-red text-sm bg-brand-red/10 rounded-xl p-3">
          <AlertCircle size={16} /> {errMsg}
        </div>
      )}

      <button type="submit" className="btn-primary w-full justify-center" disabled={status === 'loading'}>
        {status === 'loading'
          ? <><Loader2 size={16} className="animate-spin" /> جاري الإرسال...</>
          : <><Send size={16} /> إرسال الرسالة</>
        }
      </button>
    </form>
  )
}

/* ─── الصفحة الرئيسية ─────────────────────────────────────────── */
export default function LandingPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/public/site-data/')
      .then(({ data: d }) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const settings = data?.settings || {}
  const announcements = data?.announcements || []
  const contactTools = data?.contact_tools || []
  const staff = data?.staff || []

  const academicStaff = staff.filter((s) => s.card_type === 'academic')
  const adminStaff = staff.filter((s) => s.card_type === 'administrative')

  /* ── تحميل Skeleton ────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-red to-brand-blue flex items-center justify-center mx-auto animate-float">
            <GraduationCap size={32} className="text-white" />
          </div>
          <p className="text-dark-500 text-sm">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── SEO via react-helmet-async ──────────────────────────── */}
      <Helmet>
        <title>{settings.institution_name || 'مدارس ومعاهد نمبر ون'}</title>
        <meta name="description" content={settings.meta_description || 'منصة تعليمية متكاملة'} />
        <meta name="keywords" content={settings.meta_keywords || ''} />
        <meta property="og:title" content={settings.institution_name} />
        <meta property="og:description" content={settings.meta_description} />
        {settings.logo && <meta property="og:image" content={`/media/${settings.logo}`} />}
      </Helmet>

      <PublicLayout settings={settings}>
        {/* ════════════════════════════════════════════════════════
            1. HERO
            ════════════════════════════════════════════════════════ */}
        <section id="hero"
          className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">

          {/* ديكور خلفي */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse-slow" style={{background:'rgba(26,86,219,0.06)'}} />
            <div className="absolute bottom-1/4 left-1/4 w-80 h-80 rounded-full blur-3xl animate-pulse-slow" style={{background:'rgba(192,57,43,0.05)',animationDelay:'2s'}} />
          </div>

          <div className="relative max-w-4xl mx-auto px-4 text-center space-y-8 animate-fade-in">
            {/* الشعار */}
            <div className="flex justify-center">
              <div className="relative">
                {settings.logo ? (
                  <img
                    src={`/media/${settings.logo}`}
                    alt={settings.institution_name}
                    className="h-28 w-28 object-contain animate-float drop-shadow-2xl"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-3xl flex items-center justify-center animate-float" style={{background:'linear-gradient(135deg, var(--brand-red), var(--brand-blue))',boxShadow:'0 16px 48px rgba(26,86,219,0.18)'}}>
                    <GraduationCap size={48} className="text-white" />
                  </div>
                )}
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{background:'rgba(26,86,219,0.12)',border:'1px solid rgba(26,86,219,0.25)'}}>
                  <Sparkles size={10} style={{color:'var(--brand-blue)'}} />
                </div>
              </div>
            </div>

            {/* الاسم */}
            <div className="space-y-3">
              <h1 className="font-cairo font-black text-4xl sm:text-5xl md:text-6xl lg:text-7xl gradient-text leading-tight">
                {settings.institution_name || 'مدارس ومعاهد نمبر ون'}
              </h1>
              {settings.short_title && (
                <p className="font-tajawal text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{color:'var(--lp-text-secondary)'}}>
                  {settings.short_title}
                </p>
              )}
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register" className="lp-btn-primary text-base px-8 py-3.5">
                <User size={18} /> تسجيل طالب جديد
              </Link>
              <a href="#contact" className="lp-btn-outline-red text-base px-8 py-3.5">
                <Send size={18} /> تواصل معنا
              </a>
              <a href="#about" className="lp-btn-ghost text-base px-8 py-3.5">
                <BookOpen size={18} /> تعرّف علينا
              </a>
            </div>

            {/* خط نيون */}
            <div className="neon-line mx-auto max-w-2xl mt-4" />
          </div>

          {/* سهم التمرير */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="w-0.5 h-10 mx-auto" style={{background:'linear-gradient(to bottom, var(--brand-blue), transparent)'}} />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            2. الإعلانات
            ════════════════════════════════════════════════════════ */}
        {announcements.length > 0 && (
          <section className="py-16 px-4">
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="text-center">
                <span className="badge-blue mb-3">🔔 إعلانات</span>
                <h2 className="section-title">آخر الأخبار والإعلانات</h2>
              </div>
              <AnnouncementSlider announcements={announcements} />
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════
            3. عن المؤسسة
            ════════════════════════════════════════════════════════ */}
        {(settings.vision || settings.mission || settings.objectives || settings.history) && (
          <section id="about" className="py-20 px-4">
            <div className="max-w-6xl mx-auto">

              <div className="text-center mb-14">
                <span className="badge-blue mb-3">🎓 تعريف</span>
                <h2 className="section-title">عن المؤسسة</h2>
                <div className="neon-line mx-auto max-w-xs mt-4" />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {settings.vision && (
                  <div className="light-card p-6 group">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors" style={{background:'rgba(26,86,219,0.08)'}}>
                        <Eye size={20} style={{color:'var(--brand-blue)'}} />
                      </div>
                      <h3 className="font-cairo font-bold text-lg" style={{color:'var(--lp-text-primary)'}}>الرؤية</h3>
                    </div>
                    <p className="section-subtitle text-sm leading-loose">{settings.vision}</p>
                  </div>
                )}

                {settings.mission && (
                  <div className="light-card p-6 group">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors" style={{background:'rgba(192,57,43,0.08)'}}>
                        <Target size={20} style={{color:'var(--brand-red)'}} />
                      </div>
                      <h3 className="font-cairo font-bold text-lg" style={{color:'var(--lp-text-primary)'}}>الرسالة</h3>
                    </div>
                    <p className="section-subtitle text-sm leading-loose">{settings.mission}</p>
                  </div>
                )}

                {settings.objectives && (
                  <div className="light-card p-6 group">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors" style={{background:'rgba(26,86,219,0.08)'}}>
                        <CheckCircle size={20} style={{color:'var(--brand-blue)'}} />
                      </div>
                      <h3 className="font-cairo font-bold text-lg" style={{color:'var(--lp-text-primary)'}}>الأهداف</h3>
                    </div>
                    <ul className="space-y-2">
                      {settings.objectives.split('\n').filter(Boolean).map((obj, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm" style={{color:'var(--lp-text-secondary)'}}>
                          <span className="mt-0.5" style={{color:'var(--brand-blue)'}}>◆</span>
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {settings.history && (
                  <div className="light-card p-6 group">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors" style={{background:'rgba(26,86,219,0.08)'}}>
                        <BookOpen size={20} style={{color:'var(--brand-blue)'}} />
                      </div>
                      <h3 className="font-cairo font-bold text-lg" style={{color:'var(--lp-text-primary)'}}>التاريخ والقصة</h3>
                    </div>
                    <p className="section-subtitle text-sm leading-loose">{settings.history}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════════
            4. الكادر
            ════════════════════════════════════════════════════════ */}
        {staff.length > 0 && (
          <section id="staff" className="py-20 px-4" style={{background:'var(--lp-bg-subtle)'}}>
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-14">
                <span className="badge-blue mb-3">👥 الكادر</span>
                <h2 className="section-title">هيئة التدريس والإدارة</h2>
                <div className="neon-line mx-auto max-w-xs mt-4" />
              </div>


              {adminStaff.length > 0 && (
                <div className="mb-12">
                  <h3 className="font-cairo font-semibold mb-6 flex items-center gap-2" style={{color:'var(--brand-blue)'}}>
                    <Users size={18} /> هيئة الإدارة
                  </h3>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {adminStaff.map((m) => <StaffCard key={m.id} member={m} />)}
                  </div>
                </div>
              )}

              {academicStaff.length > 0 && (
                <div>
                  <h3 className="font-cairo font-semibold mb-6 flex items-center gap-2" style={{color:'var(--brand-red)'}}>
                    <GraduationCap size={18} /> هيئة التدريس
                  </h3>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {academicStaff.map((m) => <StaffCard key={m.id} member={m} />)}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}


        {/* ════════════════════════════════════════════════════════
            5. التواصل
            ════════════════════════════════════════════════════════ */}
        <section id="contact" className="py-20 px-4">
          <div className="max-w-6xl mx-auto">

            <div className="text-center mb-14">
              <span className="badge-blue mb-3">📞 تواصل</span>
              <h2 className="section-title">تواصل معنا</h2>
              <div className="neon-line mx-auto max-w-xs mt-4" />
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* أدوات التواصل */}
              <div className="space-y-4">
                <h3 className="font-cairo font-semibold mb-4" style={{color:'var(--lp-text-primary)'}}>قنوات التواصل السريع</h3>

                {settings.primary_phone && (
                  <a href={`tel:${settings.primary_phone}`}
                    className="light-card p-4 flex items-center gap-4 no-underline group">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'rgba(26,86,219,0.08)'}}>
                      <Phone size={18} style={{color:'var(--brand-blue)'}} />
                    </div>
                    <div>
                      <p className="text-xs" style={{color:'var(--lp-text-muted)'}}>الهاتف الرئيسي</p>
                      <p className="font-medium" style={{color:'var(--lp-text-primary)'}}>{settings.primary_phone}</p>
                    </div>
                  </a>
                )}

                {settings.primary_email && (
                  <a href={`mailto:${settings.primary_email}`}
                    className="light-card p-4 flex items-center gap-4 no-underline group">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'rgba(26,86,219,0.08)'}}>
                      <Mail size={18} style={{color:'var(--brand-blue)'}} />
                    </div>
                    <div>
                      <p className="text-xs" style={{color:'var(--lp-text-muted)'}}>البريد الإلكتروني</p>
                      <p className="font-medium" style={{color:'var(--lp-text-primary)'}}>{settings.primary_email}</p>
                    </div>
                  </a>
                )}

                {settings.address_text && (
                  <div className="light-card p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'rgba(192,57,43,0.08)'}}>
                      <MapPin size={18} style={{color:'var(--brand-red)'}} />
                    </div>
                    <div>
                      <p className="text-xs" style={{color:'var(--lp-text-muted)'}}>العنوان</p>
                      <p className="font-medium text-sm" style={{color:'var(--lp-text-primary)'}}>{settings.address_text}</p>
                    </div>
                  </div>
                )}

                {/* Social Links */}
                {contactTools.length > 0 && (
                  <div className="light-card p-4">
                    <p className="text-xs mb-3" style={{color:'var(--lp-text-muted)'}}>روابط التواصل الاجتماعي</p>
                    <div className="flex flex-wrap gap-3">
                      {contactTools.map((tool) => {
                        const Icon = TOOL_ICONS[tool.tool_type] || TOOL_ICONS.other
                        return (
                          <a
                            key={tool.id}
                            href={tool.value.startsWith('http') ? tool.value : `tel:${tool.value}`}
                            target="_blank" rel="noreferrer"
                            title={tool.label || tool.tool_type}
                            className="w-10 h-10 rounded-xl light-card flex items-center justify-center transition-all" style={{color:'var(--lp-text-secondary)'}}
                          >
                            <Icon size={18} />
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* نموذج المراسلة */}
              <ContactForm />
            </div>
          </div>
        </section>

      </PublicLayout>

      {/* ════════════════════════════════════════════════════════
          Floating CTA Widget
          ════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-[90] animate-fade-in flex justify-center sm:block pointer-events-none">
        <div className="glass-card p-2 sm:p-3 flex flex-row sm:flex-col gap-2 sm:gap-3 border border-white/60 bg-white/80 backdrop-blur-xl shadow-2xl rounded-2xl md:rounded-3xl transition-all duration-300 pointer-events-auto ring-1 ring-black/5">
          <Link 
            to="/register"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-brand-red text-white py-3 px-4 sm:px-6 rounded-xl shadow-lg shadow-brand-red/30 hover:bg-brand-red/90 hover:shadow-brand-red/50 hover:-translate-y-0.5 transition-all duration-300 font-cairo font-bold text-sm sm:text-base whitespace-nowrap group"
            aria-label="تسجيل طالب"
          >
            <UserPlus size={18} className="group-hover:scale-110 transition-transform" /> <span>سجل الآن</span>
          </Link>
          
          <a 
            href="#contact"
            onClick={(e) => {
              const el = document.getElementById('contact');
              if (el) {
                e.preventDefault();
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-brand-blue text-white py-3 px-4 sm:px-6 rounded-xl shadow-lg shadow-brand-blue/30 hover:bg-brand-blue/90 hover:shadow-brand-blue/50 hover:-translate-y-0.5 transition-all duration-300 font-cairo font-bold text-sm sm:text-base whitespace-nowrap group"
            aria-label="تواصل معنا"
          >
            <MessageSquare size={18} className="group-hover:scale-110 transition-transform" /> <span>تواصل معنا</span>
          </a>
        </div>
      </div>
    </>
  )
}
