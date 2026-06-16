/**
 * StudentPhoneDataPage.jsx — صفحة بيانات جهاز الطالب المرتبط
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Smartphone, ArrowRight, Clock, Calendar, MapPin, Cpu, Loader2, Unlink } from 'lucide-react'
import api from '../../api/axiosInstance'

export default function StudentPhoneDataPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/students/${id}/`)
      .then(r => setStudent(r.data))
      .catch(() => navigate('/dashboard/students'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="animate-spin text-brand-blue" />
    </div>
  )
  if (!student) return null

  const boundAt = student.device_bound_at ? new Date(student.device_bound_at) : null

  const items = [
    {
      icon: Clock,
      label: 'وقت تسجيل الدخول',
      value: boundAt ? boundAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—',
    },
    {
      icon: Calendar,
      label: 'تاريخ تسجيل الدخول',
      value: boundAt ? boundAt.toLocaleDateString('ar-SA') : '—',
    },
    {
      icon: Cpu,
      label: 'نوع الجهاز',
      value: student.device_type || '—',
    },
    {
      icon: MapPin,
      label: 'عنوان الجهاز (Device ID)',
      value: student.device_id || 'لا يوجد جهاز مربوط',
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/dashboard/students/${id}`)} className="btn-ghost p-2 rounded-xl">
          <ArrowRight size={18} />
        </button>
        <div>
          <h1 className="font-cairo font-bold text-xl text-white">بيانات الجهاز المرتبط</h1>
          <p className="text-white/40 text-sm mt-0.5">{student.user?.full_name}</p>
        </div>
      </div>

      {/* Card */}
      <div className="glass-card p-6 max-w-lg">
        <div className="flex items-center gap-3 pb-4 mb-5 border-b border-white/10">
          <div className="w-11 h-11 rounded-xl bg-brand-blue/15 flex items-center justify-center">
            <Smartphone size={20} className="text-brand-blue" />
          </div>
          <div>
            <h2 className="font-cairo font-bold text-white">معلومات الجهاز</h2>
            <p className="text-white/40 text-xs">{student.device_id ? 'جهاز مرتبط' : 'لا يوجد جهاز'}</p>
          </div>
        </div>

        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/04">
              <div className="w-9 h-9 rounded-lg bg-white/06 flex items-center justify-center shrink-0">
                <item.icon size={16} className="text-brand-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/40 text-xs">{item.label}</p>
                <p className="text-white font-medium text-sm mt-0.5 truncate">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
