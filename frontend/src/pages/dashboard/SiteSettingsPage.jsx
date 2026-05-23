/**
 * pages/dashboard/SiteSettingsPage.jsx
 * إعدادات الموقع — تعديل Singleton + معاينة مباشرة
 */

import { useEffect, useState } from 'react'
import {
  Settings, Save, Loader2, CheckCircle, AlertCircle,
  Globe, Phone, Mail, MapPin, Eye, FileText,
  Image, Upload,
} from 'lucide-react'
import api from '../../api/axiosInstance'

const SECTIONS = [
  { id: 'identity',  label: 'الهوية والأساسيات', icon: Globe    },
  { id: 'content',   label: 'المحتوى التعريفي',   icon: FileText },
  { id: 'contact',   label: 'معلومات التواصل',    icon: Phone    },
  { id: 'seo',       label: 'SEO والبحث',         icon: Eye      },
]

export default function SiteSettingsPage() {
  const [form,    setForm]    = useState(null)
  const [section, setSection] = useState('identity')
  const [saving,  setSaving]  = useState(false)
  const [status,  setStatus]  = useState(null)  // null | 'success' | 'error'
  const [logoFile, setLogoFile] = useState(null)
  const [faviconFile, setFaviconFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [faviconPreview, setFaviconPreview] = useState(null)

  useEffect(() => {
    api.get('/admin/settings/')
      .then(({ data }) => {
        setForm(data)
        if (data.logo) setLogoPreview(data.logo.startsWith('http') ? data.logo : `/media/${data.logo}`)
        if (data.favicon) setFaviconPreview(data.favicon.startsWith('http') ? data.favicon : `/media/${data.favicon}`)
      })
      .catch(console.error)
  }, [])

  const handleChange = (e) => {
    setStatus(null)
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (file) { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)) }
  }

  const handleFaviconChange = (e) => {
    const file = e.target.files[0]
    if (file) { setFaviconFile(file); setFaviconPreview(URL.createObjectURL(file)) }
  }

  const handleSave = async () => {
    setSaving(true)
    setStatus(null)
    try {
      let payload
      if (logoFile || faviconFile) {
        payload = new FormData()
        Object.entries(form).forEach(([k, v]) => {
          if (v != null && k !== 'logo' && k !== 'favicon') payload.append(k, v)
        })
        if (logoFile) payload.append('logo', logoFile)
        if (faviconFile) payload.append('favicon', faviconFile)
      } else {
        payload = form
      }
      const { data } = await api.patch('/admin/settings/', payload)
      setForm(data)
      if (data.logo) setLogoPreview(data.logo.startsWith('http') ? data.logo : `/media/${data.logo}`)
      if (data.favicon) setFaviconPreview(data.favicon.startsWith('http') ? data.favicon : `/media/${data.favicon}`)
      setStatus('success')
      setLogoFile(null)
      setFaviconFile(null)
    } catch {
      setStatus('error')
    } finally { setSaving(false) }
  }

  if (!form) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-brand-blue" />
      </div>
    )
  }

  const Field = ({ label, name, type = 'text', placeholder = '', hint = '' }) => (
    <div>
      <label className="text-white/50 text-xs mb-1 block">{label}</label>
      <input
        name={name} value={form[name] || ''} onChange={handleChange}
        type={type} placeholder={placeholder}
        className="input-glass"
        dir={type === 'email' || name === 'primary_phone' ? 'ltr' : undefined}
      />
      {hint && <p className="text-white/25 text-xs mt-1">{hint}</p>}
    </div>
  )

  const TextArea = ({ label, name, rows = 4, placeholder = '', hint = '' }) => (
    <div>
      <label className="text-white/50 text-xs mb-1 block">{label}</label>
      <textarea
        name={name} value={form[name] || ''} onChange={handleChange}
        rows={rows} placeholder={placeholder}
        className="input-glass resize-none"
      />
      {hint && <p className="text-white/25 text-xs mt-1">{hint}</p>}
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      {/* الرأس */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
          <Settings size={20} className="text-brand-blue" /> إعدادات الموقع
        </h1>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving
            ? <><Loader2 size={16} className="animate-spin" /> جاري الحفظ...</>
            : <><Save size={16} /> حفظ التغييرات</>
          }
        </button>
      </div>

      {/* Feedback */}
      {status === 'success' && (
        <div className="flex items-center gap-2 text-neon-cyan text-sm bg-neon-cyan/10 rounded-xl p-3 border border-neon-cyan/20">
          <CheckCircle size={16} /> تم حفظ الإعدادات بنجاح!
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-brand-red text-sm bg-brand-red/10 rounded-xl p-3 border border-brand-red/20">
          <AlertCircle size={16} /> حدث خطأ أثناء الحفظ.
        </div>
      )}

      <div className="flex gap-6 flex-col md:flex-row">
        {/* Sidebar القسم */}
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible md:w-48 shrink-0">
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all ${
                section === s.id
                  ? 'bg-brand-blue/15 text-brand-blue border border-brand-blue/25'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}>
              <s.icon size={15} />
              {s.label}
            </button>
          ))}
        </nav>

        {/* حقول القسم */}
        <div className="flex-1 glass-card p-6 space-y-5">

          {section === 'identity' && (
            <>
              <Field label="اسم المؤسسة *" name="institution_name" placeholder="مدارس ومعاهد نمبر ون" />
              <Field label="الاسم المختصر" name="short_title" placeholder="نمبر ون — التميز في التعليم" />

              {/* شعار الموقع */}
              <div>
                <label className="text-white/50 text-xs mb-1 block">شعار الموقع (Logo)</label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <img src={logoPreview} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/10" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-dark-600 flex items-center justify-center border border-white/10">
                      <Image size={24} className="text-white/20" />
                    </div>
                  )}
                  <label className="cursor-pointer flex-1">
                    <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                    <span className="inline-block px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors text-center w-full">
                      {logoFile ? logoFile.name : 'اختيار صورة الشعار...'}
                    </span>
                  </label>
                </div>
              </div>

              {/* فافيكون */}
              <div>
                <label className="text-white/50 text-xs mb-1 block">أيقونة الموقع (Favicon)</label>
                <div className="flex items-center gap-4">
                  {faviconPreview ? (
                    <img src={faviconPreview} alt="" className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-dark-600 flex items-center justify-center border border-white/10">
                      <Image size={20} className="text-white/20" />
                    </div>
                  )}
                  <label className="cursor-pointer flex-1">
                    <input type="file" accept="image/*" onChange={handleFaviconChange} className="hidden" />
                    <span className="inline-block px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors text-center w-full">
                      {faviconFile ? faviconFile.name : 'اختيار أيقونة الموقع...'}
                    </span>
                  </label>
                </div>
              </div>
            </>
          )}

          {section === 'content' && (
            <>
              <TextArea label="الرؤية"    name="vision"      rows={3} placeholder="رؤيتنا المستقبلية..." />
              <TextArea label="الرسالة"   name="mission"     rows={3} placeholder="رسالتنا التعليمية..." />
              <TextArea label="الأهداف"   name="objectives"  rows={4}
                hint="ضع كل هدف في سطر منفصل — ستظهر كقائمة نقطية"
                placeholder={"الهدف الأول\nالهدف الثاني\nالهدف الثالث"} />
              <TextArea label="قصة المؤسسة" name="history"  rows={4} placeholder="تاريخ وقصة نشأة المؤسسة..." />
            </>
          )}

          {section === 'contact' && (
            <>
              <Field label="البريد الإلكتروني الرئيسي" name="primary_email"
                type="email" placeholder="admin@numberone.edu.sd" />
              <Field label="رقم الهاتف الرئيسي" name="primary_phone"
                placeholder="+249..." />
              <TextArea label="العنوان" name="address_text" rows={2}
                placeholder="الخرطوم، السودان" />
            </>
          )}

          {section === 'seo' && (
            <>
              <TextArea label="وصف الموقع (Meta Description)" name="meta_description" rows={3}
                hint="يظهر في نتائج محركات البحث — 120-160 حرف مثالي"
                placeholder="منصة تعليمية متكاملة تقدم..." />
              <Field label="الكلمات المفتاحية (Keywords)" name="meta_keywords"
                placeholder="تعليم, سودان, مدارس, نمبر ون"
                hint="مفصولة بفواصل" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
