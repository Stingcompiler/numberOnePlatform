/**
 * pages/dashboard/StudentDetailsPage.jsx
 * صفحة تفاصيل الطالب الكاملة متضمنة الملف المالي والدفعات
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronRight, Printer, Loader2, DollarSign, Wallet,
  UserCheck, UserX, Smartphone, SmartphoneNfc, Phone, MapPin, CheckCircle, AlertTriangle, Edit, Trash2,
  BookMarked
} from 'lucide-react'
import api from '../../api/axiosInstance'
import { AddPaymentModal, UpdateFinanceProfileModal, EditPaymentModal } from './FinancePage'

export default function StudentDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [finance, setFinance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addPayment, setAddPayment] = useState(false)
  const [editFinance, setEditFinance] = useState(false)
  const [editPayment, setEditPayment] = useState(null)
  const [studentCourses, setStudentCourses] = useState([])

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه الدفعة نهائياً؟")) return
    try {
      await api.delete(`/finance/payments/${paymentId}/`)
      load()
    } catch (err) {
      alert("حدث خطأ أثناء الحذف.")
    }
  }

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get(`/students/${id}/`),
      api.get(`/finance/student/${id}/file/`).catch(() => ({ data: null })),
      api.get('/academic/access/', { params: { student: id, page_size: 500 } }).catch(() => ({ data: [] }))
    ]).then(([studentRes, financeRes, accessRes]) => {
      setStudent(studentRes.data)
      setFinance(financeRes.data)
      setStudentCourses(accessRes.data.results || accessRes.data)
    }).catch((err) => {
      setError('تعذر تحميل بيانات الطالب. قد يكون غير موجود.')
    }).finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  const handlePrint = () => {
    window.print()
  }

  const handleUnbind = async () => {
    if (!window.confirm('هل أنت متأكد من فك ارتباط الجهاز؟')) return
    try {
      await api.post(`/students/${id}/unbind-device/`, { confirm: true })
      load()
    } catch(err) {
      alert('حدث خطأ أثناء فك الارتباط')
    }
  }

  const handleToggleActive = async () => {
    const action = student.user?.is_active ? 'إيقاف' : 'تفعيل'
    if (!window.confirm(`هل أنت متأكد من ${action} حساب هذا الطالب؟`)) return
    try {
      await api.patch(`/students/${id}/`, {
        user: { is_active: !student.user?.is_active }
      })
      load()
    } catch(err) {
      alert(`حدث خطأ أثناء ${action} الحساب`)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 size={32} className="animate-spin text-brand-blue" />
      </div>
    )
  }

  if (error || !student) {
    return (
      <div className="p-12 text-center text-white/50">
        <AlertTriangle size={32} className="mx-auto mb-3 text-brand-red opacity-50" />
        <p>{error || 'الطالب غير موجود'}</p>
        <button onClick={() => navigate('/dashboard/students')} className="mt-4 text-brand-blue hover:underline">العودة للطلاب</button>
      </div>
    )
  }

  const basicInfo = [
    { label: 'الاسم الكامل', value: student.user?.full_name },
    { label: 'اسم المستخدم', value: student.user?.username, dir: 'ltr' },
    { label: 'رقم الهاتف', value: student.user?.phone || '—', dir: 'ltr' },
    { label: 'السكن', value: student.address || '—' },
  ];

  const academicInfo = [
    { label: 'نوع النظام', value: student.system_type_display },
    { label: 'الفصل الدراسي', value: student.enrolled_grade_name || '—' },
    { label: 'المشرفة', value: student.supervisor_name || '—' },
    { label: 'تاريخ التسجيل', value: new Date(student.registered_at).toLocaleDateString('ar-EG') },
  ];

  const parentInfo = [
    { label: 'اسم ولي الأمر', value: student.guardian_name },
    { label: 'هاتف ولي الأمر', value: student.guardian_phone || '—', dir: 'ltr' },
  ];

  const InfoSection = ({ title, data }) => (
    <div className="glass-card flex-1 p-5 border-white/5 bg-white/5 print:border-black/20 print:bg-transparent print:break-inside-avoid">
      <h3 className="font-cairo font-bold text-white/80 text-sm mb-4 pb-2 border-b border-white/10 print:text-black print:border-black/20">{title}</h3>
      <div className="space-y-4">
        {data.map((item, i) => (
          <div key={i} className="flex justify-between items-start gap-4">
            <span className="text-white/50 text-sm shrink-0 print:text-gray-600">{item.label}</span>
            <span className="text-white text-sm text-right font-medium print:text-black" dir={item.dir || 'rtl'}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const totReq = parseFloat(finance?.total_required || 0)
  const totPd = parseFloat(finance?.total_paid || 0)
  const bal = parseFloat(finance?.balance || 0)
  const settled = bal === 0 && totReq > 0

  return (
    <div className="space-y-5 animate-fade-in print:text-black print:bg-white max-w-5xl mx-auto">
      {/* Header Actions - Hidden in Print */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <button onClick={() => navigate('/dashboard/students')} className="btn-ghost p-2 text-white/60 hover:text-white flex items-center gap-2 pr-0 border-0">
          <ChevronRight size={18} /> العودة للطلاب
        </button>
        <button onClick={handlePrint} className="btn-primary py-2 px-5 bg-white/10 hover:bg-white/20 border-white/20">
          <Printer size={16} /> طباعة السجل
        </button>
      </div>

      {/* Main Profile Header - Hidden in Print */}
      <div className="glass-card p-6 flex flex-wrap md:flex-nowrap items-center justify-between gap-6 border-brand-blue/20 bg-brand-blue/5 print:hidden">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-brand-blue/20 flex flex-col items-center justify-center text-3xl font-bold text-brand-blue border-2 border-brand-blue/30 shrink-0">
            {student.user?.full_name?.charAt(0)}
          </div>
          <div>
            <h1 className="font-cairo font-black text-2xl text-white">{student.user?.full_name}</h1>
            <p className="text-white/50 text-sm mt-1">
              معرف النظام: {student.id} | {student.system_type_display}
            </p>
            <div className="flex gap-2 mt-2">
               {student.user?.is_active ? (
                 <span className="badge-green badge text-xs flex items-center gap-1">
                   <UserCheck size={12} /> حساب نشط
                 </span>
               ) : (
                 <span className="badge text-xs flex items-center gap-1 bg-brand-red/10 text-brand-red border border-brand-red/20">
                   <UserX size={12} /> حساب موقوف
                 </span>
               )}
               {student.device_id ? (
                 <span className="badge-green badge text-xs flex items-center gap-1">
                   <SmartphoneNfc size={12} /> الجهاز مربوط
                 </span>
               ) : (
                 <span className="text-white/40 text-xs flex items-center gap-1">
                   <Smartphone size={12} /> الجهاز غير مربوط
                 </span>
               )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 print:hidden">
          <button 
            onClick={handleToggleActive} 
            className={`btn-ghost py-2 ${student.user?.is_active ? 'text-brand-red hover:bg-brand-red/10 border-brand-red/20' : 'text-neon-cyan hover:bg-neon-cyan/10 border-neon-cyan/20'}`}
          >
            {student.user?.is_active ? 'إيقاف الحساب' : 'تفعيل الحساب'}
          </button>
          {student.device_id && (
            <button onClick={handleUnbind} className="btn-ghost text-brand-red hover:bg-brand-red/10 border-brand-red/20 py-2">
              فك ارتباط الجهاز
            </button>
          )}
        </div>
      </div>

      {/* Print Only Header */}
      <div className="hidden print:block mb-8 text-center border-b-2 border-black/20 pb-4">
        <h2 className="text-xl font-bold mb-1 text-gray-800">مدارس ومعاهد نمبر ون</h2>
        <h1 className="text-2xl font-bold mb-2 text-black">{student.user?.full_name}</h1>
        <p className="text-gray-600 text-lg">
          سجل المدفوعات | {student.enrolled_grade_name || 'غير محدد'} — {student.system_type_display}
        </p>
      </div>

      {/* Unified Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
        <div className="glass-card p-4 text-center">
           <p className="text-white/40 text-xs mb-1">إجمالي المطلوب</p>
           <p className="font-bold text-xl text-white">{totReq.toLocaleString('en-US')} ج.س</p>
        </div>
        <div className="glass-card p-4 text-center border-neon-cyan/20">
           <p className="text-white/40 text-xs mb-1">المدفوع</p>
           <p className="font-bold text-xl text-neon-cyan">{totPd.toLocaleString('en-US')} ج.س</p>
        </div>
        <div className={`glass-card p-4 text-center ${settled ? 'border-brand-green/20' : 'border-brand-red/20'}`}>
           <p className="text-white/40 text-xs mb-1">المتبقي الصافي</p>
           <p className={`font-bold text-xl ${settled ? 'text-white/40' : 'text-brand-red'}`}>{bal.toLocaleString('en-US')} ج.س</p>
        </div>
        <div className="glass-card p-4 text-center flex flex-col justify-center">
           <div className="flex flex-col gap-2">
             <button onClick={() => setAddPayment(true)} className="btn-primary py-1.5 px-3 text-xs justify-center">
               <DollarSign size={14} /> تسجيل دفعة
             </button>
             <button onClick={() => setEditFinance(true)} className="btn-secondary py-1.5 px-3 text-xs justify-center border-white/10 hover:bg-white/10">
               <Wallet size={14} /> تعديل المطلوب
             </button>
           </div>
        </div>
      </div>

      {/* Information Cards */}
      <div className="flex flex-col md:flex-row gap-5 print:hidden">
        <InfoSection title="المعلومات الشخصية" data={basicInfo} />
        <InfoSection title="المعلومات الأكاديمية" data={academicInfo} />
        <InfoSection title="معلومات ولي الأمر" data={parentInfo} />
      </div>

      {/* Phone / Device Data Card */}
      <div className="glass-card p-5 print:hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-cairo font-bold text-white flex items-center gap-2">
            <SmartphoneNfc size={18} className="text-brand-blue" /> بيانات الجهاز المرتبط
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/dashboard/students/${id}/phone`)}
              className="btn-ghost text-xs py-1.5 px-3 text-brand-blue hover:bg-brand-blue/10 border-brand-blue/20"
            >
              عرض التفاصيل
            </button>
            {student.device_id && (
              <button onClick={handleUnbind} className="btn-ghost text-xs py-1.5 px-3 text-brand-red hover:bg-brand-red/10 border-brand-red/20">
                فك الارتباط
              </button>
            )}
          </div>
        </div>
        {student.device_id ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-white/04">
              <p className="text-white/40 text-xs mb-0.5">معرّف الجهاز</p>
              <p className="text-white text-sm font-medium truncate" dir="ltr">{student.device_id}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/04">
              <p className="text-white/40 text-xs mb-0.5">نوع الجهاز</p>
              <p className="text-white text-sm font-medium">{student.device_type || '—'}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/04">
              <p className="text-white/40 text-xs mb-0.5">تاريخ الربط</p>
              <p className="text-white text-sm font-medium">{student.device_bound_at ? new Date(student.device_bound_at).toLocaleDateString('ar-SA') : '—'}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/04">
              <p className="text-white/40 text-xs mb-0.5">وقت الربط</p>
              <p className="text-white text-sm font-medium">{student.device_bound_at ? new Date(student.device_bound_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-white/30 text-sm">
            <Smartphone size={24} className="mx-auto mb-2 opacity-50" />
            لا يوجد جهاز مربوط حالياً
          </div>
        )}
      </div>

      {/* Student Courses Access */}
      {studentCourses.length > 0 && (
        <div className="glass-card overflow-hidden print:hidden">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-cairo font-bold text-white flex items-center gap-2">
              <BookMarked size={18} className="text-brand-blue" /> الكورسات المتاحة
            </h3>
            <span className="text-white/40 text-xs">{studentCourses.length} كورس</span>
          </div>
          <div className="p-5">
            <div className="flex flex-wrap gap-2">
              {studentCourses.map(c => (
                <span
                  key={c.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                    c.is_active
                      ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20'
                      : 'bg-white/5 text-white/40 border border-white/10'
                  }`}
                >
                  <BookMarked size={12} />
                  {c.course_name || '—'}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payments History */}
      <div className="glass-card overflow-hidden mt-6 print:border-black/20 print:bg-transparent">
        <div className="p-5 border-b border-white/5 flex items-center justify-between print:border-black/20">
          <h3 className="font-cairo font-bold text-white flex items-center gap-2 print:text-black">
             <DollarSign size={18} className="text-neon-cyan print:hidden" /> سجل الدفعات والمعاملات
          </h3>
          {settled && <span className="badge-green badge print:border-black/20 print:text-black"><CheckCircle size={14} /> السداد مكتمل</span>}
        </div>
        <div className="p-0">
          <table className="table-glass w-full text-sm print:text-black print:border-black/20">
            <thead>
              <tr className="print:border-b print:border-black/20 print:bg-gray-100">
                <th className="print:text-black">التاريخ</th>
                <th className="print:text-black">المبلغ (ج.س)</th>
                <th className="print:text-black">الريال (﷼)</th>
                <th className="print:text-black">الطريقة</th>
                <th className="print:text-black">الإيصال / المرجع</th>
                <th className="print:text-black print:hidden">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {finance?.payments?.map(p => {
                const amountSdg = parseFloat(p.amount_sdg || 0);
                const amountSar = parseFloat(p.amount_sar || 0);
                return (
                  <tr key={p.id} className="print:border-b print:border-black/10">
                    <td className="text-white/70 print:text-black" dir="ltr">{p.payment_date}</td>
                    <td className="text-neon-cyan font-bold print:text-black">{amountSdg.toLocaleString('en-US')} ج.س</td>
                    <td className="font-medium print:text-black">
                      {amountSar === 0 
                        ? <span className="text-amber-400 text-xs print:text-gray-600">— لا سعر ﷼</span> 
                        : <span className="text-brand-blue print:text-gray-800">{amountSar.toLocaleString('en-US')} ﷼</span>}
                    </td>
                    <td><span className="badge-blue badge text-xs print:border-black/20 print:text-black">{p.payment_method_display}</span></td>
                    <td className="text-white/50 text-xs print:text-gray-600">
                       <span className="block mb-0.5">المرجع: {p.receipt_number}</span>
                       {p.transaction_id && (
                         <span className="block">
                           معاملة: {p.transaction_id} ({p.bank_name})
                           {p.sender_account_number && ` — مُرسل: ${p.sender_account_number}`}
                         </span>
                       )}
                    </td>
                    <td className="print:hidden">
                       <div className="flex gap-2">
                         <button onClick={() => setEditPayment(p)} className="btn-ghost p-1.5 text-brand-blue" title="تعديل"><Edit size={14} /></button>
                         <button onClick={() => handleDeletePayment(p.id)} className="btn-ghost p-1.5 text-brand-red" title="حذف"><Trash2 size={14} /></button>
                       </div>
                    </td>
                  </tr>
                )
              })}
              {(!finance?.payments || finance.payments.length === 0) && (
                <tr>
                  <td colSpan={6} className="text-center text-white/40 py-8 print:text-gray-500">لا توجد أي دفعات مسجلة حتى الآن</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {addPayment && (
        <AddPaymentModal
          studentId={student.id}
          studentName={student.user?.full_name}
          balance={bal}
          onClose={() => setAddPayment(false)}
          onAdded={load}
        />
      )}
      {editFinance && (
        <UpdateFinanceProfileModal
          studentId={student.id}
          studentName={student.user?.full_name}
          currentRequired={finance?.total_required}
          currentNotes={finance?.notes}
          onClose={() => setEditFinance(false)}
          onUpdated={load}
        />
      )}
      {editPayment && (
        <EditPaymentModal
          payment={editPayment}
          studentName={student.user?.full_name}
          balance={bal}
          onClose={() => setEditPayment(null)}
          onUpdated={load}
        />
      )}
    </div>
  )
}
