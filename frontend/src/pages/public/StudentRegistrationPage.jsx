/**
 * StudentRegistrationPage.jsx — صفحة تسجيل طالب جديد (عامة)
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Send, User, Phone, MapPin, Loader2, CheckCircle, AlertCircle,
  GraduationCap, Calendar, Upload, FileText, Camera, CreditCard,
  Users, Baby, Shield, ChevronDown, Info,
} from 'lucide-react'
import api from '../../api/axiosInstance'

const GENDERS = [
  { value: 'male', label: 'ذكر' },
  { value: 'female', label: 'أنثى' },
]
const STUDENT_STATUSES = [
  { value: 'returning', label: 'عائد لنفس السنه' },
  { value: 'new_year', label: 'عام دراسي جديد' },
]

const INITIAL = {
  student_full_name: '', national_id: '', level: '', grade: '', gender: '',
  student_status: '', has_siblings: false, siblings_info: [],
  residence: '', date_of_birth: '', student_phone: '',
  guardian_name: '', guardian_phone: '', guardian_residence: '', mother_full_name: '',
  supervisor: '',
}

/* ── File Input ── */
function FileInput({ label, name, icon: Icon, onChange, file, required }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--lp-text-secondary)' }}>
          {label}
        </label>
        {required && (
          <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
            إجباري *
          </span>
        )}
      </div>

      <div className="relative">
        <label
          className="flex items-center gap-3 cursor-pointer rounded-xl border-2 border-dashed px-4 py-3 transition-all hover:border-red-400 overflow-hidden"
          style={{
            borderColor: file ? '#22c55e' : (required ? '#ef4444' : 'var(--lp-border)'),
            background: file ? 'rgba(34,197,94,0.04)' : (required ? 'rgba(239,68,68,0.03)' : 'var(--lp-bg-subtle)'),
          }}
        >
          <Icon size={18} style={{ color: file ? '#22c55e' : (required ? '#dc2626' : 'var(--lp-text-muted)') }} />
          <span className="flex-1 text-sm truncate font-medium" style={{ color: file ? '#15803d' : (required ? '#991b1b' : 'var(--lp-text-muted)') }}>
            {file ? file.name : 'اضغط لاختيار ملف...'}
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={e => onChange(name, e.target.files[0])} />
          {file && <CheckCircle size={16} style={{ color: '#22c55e' }} />}
        </label>

        {/* Solid Red Line under the input container */}
        {required && (
          <div
            className="w-full h-[3px] rounded-b-xl transition-all"
            style={{
              background: file ? '#22c55e' : '#dc2626',
              marginTop: '-3px',
              position: 'relative',
              zIndex: 10,
            }}
          />
        )}
      </div>

      {required && (
        <span className="text-[11px] font-bold text-red-600 mt-1.5 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block"></span>
          هذا الحقل مطلوب وإجباري *
        </span>
      )}
    </div>
  )
}

/* ── Section Header ── */
function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 pb-3 mb-4" style={{ borderBottom: '1px solid var(--lp-border)' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.1)' }}>
        <Icon size={18} style={{ color: '#2563eb' }} />
      </div>
      <div>
        <h3 className="font-cairo font-bold text-base" style={{ color: 'var(--lp-text-primary)' }}>{title}</h3>
        {subtitle && <p className="text-xs" style={{ color: 'var(--lp-text-muted)' }}>{subtitle}</p>}
      </div>
    </div>
  )
}

export default function StudentRegistrationPage() {
  const [form, setForm] = useState(INITIAL)
  const [files, setFiles] = useState({})
  const [conditions, setConditions] = useState([])
  const [supervisors, setSupervisors] = useState([])
  const [status, setStatus] = useState('idle')
  const [errMsg, setErrMsg] = useState('')

  const [grades, setGrades] = useState([])
  const [levels, setLevels] = useState([])
  const [gradesLoading, setGradesLoading] = useState(false)

  // րր تحميل البيانات الثابتة عند التحميل (conditions + supervisors + levels) րր
  useEffect(() => {
    api.get('/registration-conditions/public/').then(r => setConditions(r.data.results || r.data)).catch(() => { })
    api.get('/supervisors/public/').then(r => setSupervisors(r.data.results || r.data)).catch(() => { })

    // جلب المراحل من النقطة العامة (بدون مصادقة)
    api.get('/academic/levels/public/?system_type=online')
      .then(r => setLevels(r.data.results || r.data))
      .catch(() => { })
  }, [])

  // րր إعادة جلب الصفوف كلما تغيّرت المرحلة المختارة րր
  useEffect(() => {
    setForm(f => ({ ...f, grade: '' }))   // صفر الصف عند تغيير المرحلة
    if (!form.level) {
      setGrades([])
      return
    }
    setGradesLoading(true)
    api.get(`/academic/grades/public/?system_type=online&level=${form.level}`)
      .then(r => setGrades(r.data.results || r.data))
      .catch(() => setGrades([]))
      .finally(() => setGradesLoading(false))
  }, [form.level])

  const handleChange = e => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleFile = (name, file) => setFiles(f => ({ ...f, [name]: file }))

  const addSibling = () => setForm(f =>
    ({ ...f, siblings_info: [...f.siblings_info, { name: '', grade: '' }] }))
  const updateSibling = (idx, key, val) => {
    setForm(f => {
      const updated = [...f.siblings_info]
      updated[idx] = { ...updated[idx], [key]: val }
      return { ...f, siblings_info: updated }
    })
  }
  const removeSibling = idx => setForm(f =>
    ({ ...f, siblings_info: f.siblings_info.filter((_, i) => i !== idx) }))

  const handleSubmit = async e => {
    e.preventDefault()
    const requiredText = [
      'student_full_name',
      'national_id',
      'level',
      'grade',
      'gender',
      'student_status',
      'residence',
      'date_of_birth',
      'guardian_name',
      'guardian_phone',
      'guardian_residence',
      'mother_full_name',
    ]

    for (const key of requiredText) {
      if (!form[key]?.toString().trim()) {
        setStatus('error'); setErrMsg('يرجى تعبئة جميع الحقول النصية الإلزامية.'); return
      }
    }

    if (form.has_siblings && form.siblings_info.length > 0) {
      for (const sib of form.siblings_info) {
        if (!sib.name.trim() || !sib.grade.trim()) {
          setStatus('error'); setErrMsg('يرجى استكمال بيانات الأشقاء أو حذف الحقول الفارغة.'); return
        }
      }
    }

    // المستندات السبعة كلها إلزامية. كان إشعار السداد وحده خارج هذه القائمة
    // وخارج شرط الموديل، فكان الطلب يُرسَل بستّة.
    const requiredFiles = [
      'academic_result_image',
      'birth_certificate_image',
      'personal_photo',
      'student_id_image',
      'father_id_image',
      'mother_id_image',
      'payment_receipt_image',
    ]

    for (const key of requiredFiles) {
      if (!files[key]) {
        setStatus('error'); setErrMsg('يرجى رفع جميع المستندات الإلزامية.'); return
      }
    }
    setStatus('loading')
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'siblings_info') fd.append(k, JSON.stringify(v))
        else if (k === 'has_siblings') fd.append(k, v ? 'true' : 'false')
        else fd.append(k, v)
      })
      Object.entries(files).forEach(([k, v]) => { if (v) fd.append(k, v) })
      await api.post('/student-registration/public/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setStatus('success')
    }
    catch (err) {
      console.log(err)
      setStatus('error')
      const d = err?.response?.data
      console.log(d)
      if (typeof d === 'object' && d) {
        const msgs = []
        Object.entries(d).forEach(([k, v]) => msgs.push(`${k}: ${Array.isArray(v) ? v.join(' ') : v}`))
        setErrMsg(msgs.join('\n') || 'حدث خطأ.')
      } else setErrMsg('حدث خطأ. يرجى التحقق من البيانات.')
    }
  }

  const inputClass = "input-light pl-3 pr-9"
  const selectClass = "input-light pl-3 pr-9 appearance-none cursor-pointer"

  return (
    <div style={{ direction: 'rtl', minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }}>
      {/* Top Bar */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--lp-border)', padding: '12px 24px' }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #dc2626, #2563eb)' }}>
            <GraduationCap size={17} className="text-white" />
          </div>
          <span className="font-cairo font-bold" style={{ color: 'var(--lp-text-primary)' }}>مدارس ومعاهد نمبر ون</span>
        </div>
        <Link to="/" className="text-sm font-medium" style={{ color: '#2563eb' }}>العودة للرئيسية</Link>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Conditions */}
        {conditions.length > 0 && (
          <div className="rounded-2xl overflow-hidden mb-8 shadow-sm" style={{ background: 'white', border: '1px solid var(--lp-border)' }}>
            <div className="px-6 py-4" style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)', color: 'white' }}>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={18} />
                <h2 className="font-cairo font-bold text-lg">شروط التسجيل الإلكتروني</h2>
              </div>
              <p className="text-white/80 text-xs">يرجى قراءة الشروط بعناية قبل البدء في التسجيل</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              {conditions.map((c, i) => (
                <div key={c.id} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>{i + 1}</span>
                  <div>
                    <h4 className="font-cairo font-bold text-sm mb-1" style={{ color: 'var(--lp-text-primary)' }}>{c.title}</h4>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--lp-text-secondary)' }}>{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {status === 'success' ? (
          <div className="rounded-2xl shadow-sm text-center py-16 px-8" style={{ background: 'white', border: '1px solid var(--lp-border)' }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>
              <CheckCircle size={40} />
            </div>
            <h2 className="font-cairo font-bold text-2xl mb-2" style={{ color: 'var(--lp-text-primary)' }}>تم إرسال طلب التسجيل بنجاح!</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--lp-text-secondary)' }}>شكراً لك. ستقوم الإدارة بمراجعة الطلب والتواصل معك في أقرب وقت.</p>
            <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white" style={{ background: '#2563eb' }}>العودة للرئيسية</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div className="text-center mb-4">
              <h1 className="font-cairo font-black text-2xl" style={{ color: 'var(--lp-text-primary)' }}>استمارة تسجيل طالب جديد</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--lp-text-muted)' }}>العام الدراسي 2025 - 2026</p>
            </div>

            {status === 'error' && (
              <div className="flex items-start gap-2 text-sm rounded-xl p-4" style={{ background: 'rgba(220,38,38,0.06)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.15)' }}>
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span className="whitespace-pre-wrap">{errMsg}</span>
              </div>
            )}

            {/* Section 1: Student Info */}
            <div className="rounded-2xl p-6 shadow-sm" style={{ background: 'white', border: '1px solid var(--lp-border)' }}>
              <SectionHeader icon={User} title="بيانات الطالب" subtitle="المعلومات الأساسية للطالب" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>اسم الطالب رباعي <span className="text-red-500">*</span></label>
                  <input required name="student_full_name" value={form.student_full_name} onChange={handleChange} className={inputClass} placeholder="اسم الطالب رباعي " />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>  الرقم الوطني للطالب  <span className="text-red-500">*</span></label>
                  <input required name="national_id" value={form.national_id} onChange={handleChange} className={inputClass} placeholder="الرقم الوطني للطالب  " />
                </div>
                <div>

                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>اختيار المرحلة المراد الالتحاق به <span className="text-red-500">*</span></label>
                  <select required name="level" value={form.level} onChange={handleChange} className={selectClass}>
                    <option value="" disabled>  اخترالمرحلة   المراد الالتحاق به   </option>
                    {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>الصف <span className="text-red-500">*</span></label>
                  <select required name="grade" value={form.grade} onChange={handleChange} className={selectClass}
                    disabled={!form.level || gradesLoading}>
                    <option value="" disabled>
                      {!form.level ? 'اختر المرحلة أولاً' : gradesLoading ? 'جاري التحميل...' : 'اختر الصف'}
                    </option>
                    {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>جنس الطالب <span className="text-red-500">*</span></label>
                  <select required name="gender" value={form.gender} onChange={handleChange} className={selectClass}>
                    <option value="" disabled>  اختر جنس الطالب   </option>
                    {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>حالة الطالب <span className="text-red-500">*</span></label>
                  <select required name="student_status" value={form.student_status} onChange={handleChange} className={selectClass}>
                    <option value="" disabled>اختر الحالة</option>
                    {STUDENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}> تاريخ ميلاد الطالب <span className="text-red-500">*</span></label>
                  <input required type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>رقم هاتف الطالب</label>
                  <input name="student_phone" value={form.student_phone} onChange={handleChange} className={inputClass} placeholder="0912345678" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>مكان الإقامة الحالي <span className="text-red-500">*</span></label>
                  <input required name="residence" value={form.residence} onChange={handleChange} className={inputClass} placeholder="المدينة، الحي..." />
                </div>
              </div>
            </div>

            {/* Section 2: Siblings */}
            <div className="rounded-2xl p-6 shadow-sm" style={{ background: 'white', border: '1px solid var(--lp-border)' }}>
              <SectionHeader icon={Users} title="بيانات الأشقاء" subtitle="هل للطالب أشقاء في مدرسة نمبر ون؟" />
              <div className="flex items-center gap-3 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="has_siblings" checked={form.has_siblings} onChange={handleChange} className="w-4 h-4 rounded accent-blue-600" />
                  <span className="text-sm font-medium" style={{ color: 'var(--lp-text-primary)' }}>نعم، لديه أشقاء</span>
                </label>
              </div>
              {form.has_siblings && (
                <div className="space-y-3">
                  {form.siblings_info.map((s, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <input value={s.name} onChange={e => updateSibling(i, 'name', e.target.value)} className="input-light flex-1" placeholder={`اسم الشقيق ${i + 1}`} />
                      <select value={s.grade} onChange={e => updateSibling(i, 'grade', e.target.value)} className="input-light w-32 cursor-pointer">
                        <option value="" disabled>الصف</option>
                        {grades.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                      </select>
                      <button type="button" onClick={() => removeSibling(i)} className="text-red-500 text-sm hover:underline">حذف</button>
                    </div>
                  ))}
                  <button type="button" onClick={addSibling} className="text-sm font-medium" style={{ color: '#2563eb' }}>+ إضافة شقيق</button>
                </div>
              )}
            </div>

            {/* Section 3: Guardian */}
            <div className="rounded-2xl p-6 shadow-sm" style={{ background: 'white', border: '1px solid var(--lp-border)' }}>
              <SectionHeader icon={Shield} title="بيانات ولي الأمر" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>اسم ولي الأمر رباعي<span className="text-red-500">*</span></label>
                  <input required name="guardian_name" value={form.guardian_name} onChange={handleChange} className={inputClass} placeholder="اسم ولي الأمر رباعي" />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>هاتف ولي الأمر <span className="text-red-500">*</span></label>
                  <input required name="guardian_phone" value={form.guardian_phone} onChange={handleChange} className={inputClass} placeholder="0912345678" />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>مكان إقامة ولي الأمر <span className="text-red-500">*</span></label>
                  <input required name="guardian_residence" value={form.guardian_residence} onChange={handleChange} className={inputClass} placeholder="المدينة، الحي..." />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--lp-text-secondary)' }}>  اسم والدة الطالب رباعي <span className="text-red-500">*</span></label>
                  <input required name="mother_full_name" value={form.mother_full_name} onChange={handleChange} className={inputClass} placeholder="  اسم والدة الطالب رباعي" />
                </div>
              </div>
            </div>

            {/* Section 4: Supervisor */}
            {supervisors.length > 0 && (
              <div className="rounded-2xl p-6 shadow-sm" style={{ background: 'white', border: '1px solid var(--lp-border)' }}>
                <SectionHeader icon={GraduationCap} title="المشرفة" />
                <select name="supervisor" value={form.supervisor} onChange={handleChange} className={selectClass}>
                  <option value=""> اسم المشرفة التي تم عن طريقها التسجيل</option>
                  {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {/* Section 5: Files */}
            <div className="rounded-2xl p-6 shadow-sm" style={{ background: 'white', border: '1px solid var(--lp-border)' }}>
              <SectionHeader icon={Upload} title="المستندات والمرفقات" subtitle="يرجى رفع المستندات المطلوبة" />

              {/* ⚠️  Alert — تنبيه رفع المستندات */}
              <div
                className="mb-5 rounded-xl p-4 text-sm"
                style={{
                  background: 'rgba(220,38,38,0.06)',
                  border: '1.5px solid rgba(220,38,38,0.3)',
                  color: '#b91c1c',
                  direction: 'rtl',
                }}
              >
                <div className="flex items-center gap-2 mb-2 font-bold text-base" style={{ color: '#991b1b' }}>
                  <AlertCircle size={18} className="shrink-0" />
                  <span>تنبيه هام — المستندات إلزامية</span>
                </div>
                <ul className="list-disc list-inside space-y-1.5 leading-relaxed" style={{ paddingInlineStart: '0.25rem' }}>
                  <li>رفع <strong>جميع</strong> المستندات المطلوبة إلزامي وليس اختيارياً.</li>
                  <li>لا يمكن إتمام عملية التسجيل دون رفع جميع المستندات المطلوبة.</li>
                  <li>أي مستند ناقص سيؤدي إلى تعليق الطلب أو رفضه حتى استكمال الناقص.</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FileInput required={true} label="   تحميل اخر نتيجة دراسية للطالب" name="academic_result_image" icon={FileText} onChange={handleFile} file={files.academic_result_image} />
                <FileInput required={true} label="  تحميل شهادة ميلاد الطالب" name="birth_certificate_image" icon={FileText} onChange={handleFile} file={files.birth_certificate_image} />
                <FileInput required={true} label="تحميل الرقم الوطني للطالب  " name="student_id_image" icon={Camera} onChange={handleFile} file={files.student_id_image} />
                <FileInput required={true} label="  صورة شخصية للطالب / باسبورت" name="personal_photo" icon={Camera} onChange={handleFile} file={files.personal_photo} />
                <FileInput required={true} label="تحميل الرقم الوطني للأب  " name="father_id_image" icon={CreditCard} onChange={handleFile} file={files.father_id_image} />
                <FileInput required={true} label="تحميل الرقم الوطني للأم   " name="mother_id_image" icon={CreditCard} onChange={handleFile} file={files.mother_id_image} />
                <FileInput required={true} label="  تحميل اشعار سداد الرسوم / اشعار بنكك " name="payment_receipt_image" icon={CreditCard} onChange={handleFile} file={files.payment_receipt_image} />
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={status === 'loading'} className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white text-base transition-all"
              style={{ background: status === 'loading' ? '#94a3b8' : 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 15px rgba(37,99,235,0.3)' }}>
              {status === 'loading' ? <><Loader2 size={20} className="animate-spin" /> جاري الإرسال...</> : <><Send size={20} /> إرسال البيانات   </>}
            </button>
            <p className="text-xs text-center" style={{ color: 'var(--lp-text-muted)' }}>الحقول المشار إليها بـ <span className="text-red-500">*</span> إلزامية</p>
          </form>
        )}
      </div>
    </div>
  )
}
