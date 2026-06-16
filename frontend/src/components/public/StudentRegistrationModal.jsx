import { useState } from 'react'
import {
  X, Send, User, Phone, MapPin, Loader2, CheckCircle,
  AlertCircle, BookOpen, GraduationCap, Layers, Calendar,
} from 'lucide-react'
import api from '../../api/axiosInstance'

const INITIAL_FORM = {
  student_name: '',
  guardian_name: '',
  guardian_phone: '',
  address: '',
  system_type: '',
  year_of_study: '',
  level: '',
  notes: '',
}

export default function StudentRegistrationModal({ isOpen, onClose }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [errMsg, setErrMsg] = useState('')

  if (!isOpen) return null

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Basic client-side validation for required fields
    const required = ['student_name', 'guardian_name', 'guardian_phone', 'address', 'system_type', 'level']
    for (const key of required) {
      if (!form[key].trim()) {
        setStatus('error')
        setErrMsg('يرجى تعبئة جميع الحقول الإلزامية.')
        return
      }
    }

    setStatus('loading')
    try {
      await api.post('/student-requests/public/', form)
      setStatus('success')
      setForm(INITIAL_FORM)
    } catch (err) {
      setStatus('error')
      const detail = err?.response?.data?.detail || err?.response?.data
      setErrMsg(
        typeof detail === 'string'
          ? detail
          : 'حدث خطأ. يرجى التحقق من البيانات والمحاولة مجدداً.'
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ direction: 'rtl', background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
    >
      <div className="w-full max-w-xl overflow-hidden relative shadow-2xl animate-slide-up rounded-2xl" style={{ background: 'white', border: '1px solid var(--lp-border)' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--lp-border)', background: 'var(--lp-bg-subtle)' }}>
          <h3 className="font-cairo font-bold text-lg flex items-center gap-2" style={{ color: 'var(--lp-text-primary)' }}>
            <BookOpen size={20} style={{ color: 'var(--brand-blue)' }} />
            طلب تسجيل طالب جديد
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all" style={{ color: 'var(--lp-text-muted)' }}
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {status === 'success' ? (
            /* ── Success State ── */
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(5,150,105,0.12)', color: '#059669' }}>
                <CheckCircle size={32} />
              </div>
              <h4 className="font-cairo font-bold text-xl" style={{ color: 'var(--lp-text-primary)' }}>تم إرسال الطلب بنجاح!</h4>
              <p className="text-sm" style={{ color: 'var(--lp-text-secondary)' }}>
                شكراً لك، ستقوم الإدارة بالتواصل معك في أقرب وقت.
              </p>
              <button type="button" onClick={onClose} className="btn-primary mt-2 w-full justify-center">
                إغلاق
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              {/* Error Banner */}
              {status === 'error' && (
                <div className="flex items-start gap-2 text-brand-red text-sm bg-brand-red/10 rounded-xl p-3 border border-brand-red/20">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{errMsg}</span>
                </div>
              )}

              {/* ── Row 1: Student Name + Guardian Name ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Student Name */}
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>
                    اسم الطالب <span style={{ color: 'var(--brand-red)' }}>*</span>
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--lp-text-muted)' }} />
                    <input
                      required
                      name="student_name"
                      value={form.student_name}
                      onChange={handleChange}
                      className="input-light pl-3 pr-9"
                      placeholder="الاسم الرباعي"
                    />
                  </div>
                </div>

                {/* Guardian Name */}
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>
                    اسم ولي الأمر <span style={{ color: 'var(--brand-red)' }}>*</span>
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--lp-text-muted)' }} />
                    <input
                      required
                      name="guardian_name"
                      value={form.guardian_name}
                      onChange={handleChange}
                      className="input-light pl-3 pr-9"
                      placeholder="اسم ولي الأمر"
                    />
                  </div>
                </div>
              </div>

              {/* ── Guardian Phone + Address ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Guardian Phone */}
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>
                    هاتف ولي الأمر <span style={{ color: 'var(--brand-red)' }}>*</span>
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--lp-text-muted)' }} />
                    <input
                      required
                      type="tel"
                      name="guardian_phone"
                      value={form.guardian_phone}
                      onChange={handleChange}
                      className="input-light pl-3 pr-9"
                      placeholder="0912345678"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>
                    العنوان <span style={{ color: 'var(--brand-red)' }}>*</span>
                  </label>
                  <div className="relative">
                    <MapPin size={15} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--lp-text-muted)' }} />
                    <input
                      required
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      className="input-light pl-3 pr-9"
                      placeholder="المدينة، الحي..."
                    />
                  </div>
                </div>
              </div>

              {/* ── System Type + Level ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* System Type */}
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>
                    نوع النظام الدراسي <span style={{ color: 'var(--brand-red)' }}>*</span>
                  </label>
                  <div className="relative">
                    <GraduationCap size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none z-10" />
                    <select
                      required
                      name="system_type"
                      value={form.system_type}
                      onChange={handleChange}
                      className="input-light pl-3 pr-9 appearance-none cursor-pointer"
                    >
                      <option value="" disabled>اختر النظام</option>
                      <option value="online">Online (أونلاين)</option>
                      <option value="flash">Flash Course (فلاش كورس)</option>
                    </select>
                  </div>
                </div>

                {/* Level */}
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>
                    المرحلة الدراسية <span style={{ color: 'var(--brand-red)' }}>*</span>
                  </label>
                  <div className="relative">
                    <Layers size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none z-10" />
                    <select
                      required
                      name="level"
                      value={form.level}
                      onChange={handleChange}
                      className="input-light pl-3 pr-9 appearance-none cursor-pointer"
                    >
                      <option value="" disabled>اختر المرحلة</option>
                      <option value="primary">Primary (ابتدائي)</option>
                      <option value="intermediate">Intermediate (متوسط)</option>
                      <option value="secondary">Secondary (ثانوي)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Year of Study ── */}
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>
                  السنة الدراسية
                </label>
                <div className="relative">
                  <Calendar size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none" />
                  <input
                    name="year_of_study"
                    value={form.year_of_study}
                    onChange={handleChange}
                    className="input-light pl-3 pr-9"
                    placeholder="مثال: الأول، الثاني، Grade 5..."
                  />
                </div>
              </div>

              {/* ── Notes ── */}
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>
                  ملاحظات <span className="opacity-50 text-xs">(اختياري)</span>
                </label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={3}
                  className="input-light resize-none"
                  placeholder="أي استفسار إضافي أو ملاحظات..."
                />
              </div>

              {/* ── Submit ── */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="btn-primary w-full justify-center"
                >
                  {status === 'loading' ? (
                    <><Loader2 size={18} className="animate-spin" /> جاري الإرسال...</>
                  ) : (
                    <><Send size={18} /> إرسال الطلب</>
                  )}
                </button>
              </div>

              {/* Required note */}
              <p className="text-xs text-center " style={{ color: 'var(--lp-text-muted)' }}>
                الحقول المشار إليها بـ <span className="text-brand-red">*</span> إلزامية
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
