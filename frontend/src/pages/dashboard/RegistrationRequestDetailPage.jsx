/**
 * RegistrationRequestDetailPage.jsx — تفاصيل طلب تسجيل جديد
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowRight, Loader2, User, Phone, MapPin, Calendar, Shield, Users,
  FileText, Download, CheckCircle, XCircle, Clock, Eye, Save,
} from 'lucide-react'
import api from '../../api/axiosInstance'

const STATUS_MAP = {
  new:      { label: 'جديد',        color: 'bg-blue-500/15 text-blue-400',   icon: Clock },
  reviewed: { label: 'تمت المراجعة', color: 'bg-yellow-500/15 text-yellow-400', icon: Eye },
  accepted: { label: 'مقبول',       color: 'bg-emerald-500/15 text-emerald-400', icon: CheckCircle },
  rejected: { label: 'مرفوض',       color: 'bg-red-500/15 text-red-400',     icon: XCircle },
}

function InfoItem({ label, value }) {
  return (
    <div className="p-3 rounded-xl bg-white/04">
      <p className="text-white/40 text-xs mb-0.5">{label}</p>
      <p className="text-white text-sm font-medium">{value || '—'}</p>
    </div>
  )
}

function ImagePreview({ label, url }) {
  if (!url) return null
  const full = url.startsWith('http') ? url : `/media/${url.replace(/^\/?(media\/)?/, '')}`
  return (
    <div className="rounded-xl overflow-hidden border border-white/10">
      <div className="px-3 py-2 bg-white/05 border-b border-white/10">
        <p className="text-white/60 text-xs">{label}</p>
      </div>
      <a href={full} target="_blank" rel="noreferrer" className="block">
        <img src={full} alt={label} className="w-full h-44 object-cover hover:opacity-80 transition-opacity" />
      </a>
      <a href={full} download className="flex items-center justify-center gap-2 px-3 py-2 text-xs text-brand-blue hover:bg-white/05 transition-colors border-t border-white/10">
        <Download size={13} /> تحميل
      </a>
    </div>
  )
}

export default function RegistrationRequestDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')
  const [statusVal, setStatusVal] = useState('')

  useEffect(() => {
    api.get(`/student-registration/${id}/`)
      .then(r => { setData(r.data); setNotes(r.data.admin_notes || ''); setStatusVal(r.data.status) })
      .catch(() => navigate('/dashboard/student-requests'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: updated } = await api.patch(`/student-registration/${id}/`, { status: statusVal, admin_notes: notes })
      setData(updated)
    } catch { /* silent */ }
    setSaving(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={28} className="animate-spin text-brand-blue" /></div>
  if (!data) return null

  const st = STATUS_MAP[data.status] || STATUS_MAP.new
  const StIcon = st.icon

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard/student-requests')} className="btn-ghost p-2 rounded-xl"><ArrowRight size={18} /></button>
          <div>
            <h1 className="font-cairo font-bold text-xl text-white">تفاصيل طلب التسجيل</h1>
            <p className="text-white/40 text-sm mt-0.5">#{data.id} — {data.student_full_name}</p>
          </div>
        </div>
        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${st.color}`}>
          <StIcon size={14} /> {st.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Student */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 text-brand-blue mb-4"><User size={16} /><span className="font-cairo font-bold text-white text-sm">بيانات الطالب</span></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <InfoItem label="الاسم الكامل" value={data.student_full_name} />
              <InfoItem label="الرقم الوطني" value={data.national_id} />
              <InfoItem label="المرحلة" value={data.level_display} />
              <InfoItem label="الصف" value={data.grade_display} />
              <InfoItem label="الجنس" value={data.gender_display} />
              <InfoItem label="حالة الطالب" value={data.student_status_display} />
              <InfoItem label="تاريخ الميلاد" value={data.date_of_birth} />
              <InfoItem label="رقم الهاتف" value={data.student_phone} />
              <InfoItem label="مكان الإقامة" value={data.residence} />
            </div>
          </div>

          {/* Guardian */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 text-brand-blue mb-4"><Shield size={16} /><span className="font-cairo font-bold text-white text-sm">بيانات ولي الأمر</span></div>
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label="اسم ولي الأمر" value={data.guardian_name} />
              <InfoItem label="هاتف ولي الأمر" value={data.guardian_phone} />
              <InfoItem label="إقامة ولي الأمر" value={data.guardian_residence} />
              <InfoItem label="اسم الأم" value={data.mother_full_name} />
            </div>
          </div>

          {/* Siblings */}
          {data.has_siblings && data.siblings_info?.length > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 text-brand-blue mb-4"><Users size={16} /><span className="font-cairo font-bold text-white text-sm">الأشقاء</span></div>
              <div className="space-y-2">
                {data.siblings_info.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/04">
                    <span className="w-6 h-6 rounded-full bg-brand-blue/15 text-brand-blue text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-white text-sm">{s.name}</span>
                    <span className="text-white/40 text-xs mr-auto">الصف: {s.grade}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 text-brand-blue mb-4"><FileText size={16} /><span className="font-cairo font-bold text-white text-sm">المستندات المرفقة</span></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <ImagePreview label="النتيجة الدراسية" url={data.academic_result_image} />
              <ImagePreview label="شهادة الميلاد" url={data.birth_certificate_image} />
              <ImagePreview label="صورة شخصية" url={data.personal_photo} />
              <ImagePreview label="بطاقة الأب" url={data.father_id_image} />
              <ImagePreview label="بطاقة الأم" url={data.mother_id_image} />
              <ImagePreview label="إيصال الدفع" url={data.payment_receipt_image} />
            </div>
            {!data.academic_result_image && !data.birth_certificate_image && !data.personal_photo &&
             !data.father_id_image && !data.mother_id_image && !data.payment_receipt_image && (
              <p className="text-white/30 text-sm text-center py-6">لا توجد مستندات مرفقة</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-cairo font-bold text-white text-sm mb-4">إدارة الطلب</h3>
            <div className="space-y-4">
              <div>
                <label className="text-white/60 text-xs block mb-1.5">حالة الطلب</label>
                <select value={statusVal} onChange={e => setStatusVal(e.target.value)}
                  className="w-full bg-dark-700 border border-white/15 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-blue/50 transition-colors">
                  <option value="new" className="bg-dark-700 text-white">جديد</option>
                  <option value="reviewed" className="bg-dark-700 text-white">تمت المراجعة</option>
                  <option value="accepted" className="bg-dark-700 text-white">مقبول</option>
                  <option value="rejected" className="bg-dark-700 text-white">مرفوض</option>
                </select>
              </div>
              <div>
                <label className="text-white/60 text-xs block mb-1.5">ملاحظات الإدارة</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
                  className="w-full bg-dark-700 border border-white/15 text-white rounded-xl px-3 py-2.5 text-sm resize-none placeholder:text-white/30 focus:outline-none focus:border-brand-blue/50 transition-colors"
                  placeholder="أضف ملاحظاتك..." />
              </div>
              <button onClick={handleSave} disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-blue text-white text-sm font-bold transition-all hover:opacity-90">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} حفظ التغييرات
              </button>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-cairo font-bold text-white text-sm mb-3">معلومات إضافية</h3>
            <div className="space-y-3">
              <InfoItem label="المشرفة" value={data.supervisor_name} />
              <InfoItem label="تاريخ الإرسال" value={data.submitted_at ? new Date(data.submitted_at).toLocaleDateString('ar-SA') : '—'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
