/**
 * pages/dashboard/StudentsPage.jsx
 * إدارة الطلاب — جدول + إنشاء + تفاصيل
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Edit, Trash, Plus, Search, X, Loader2, ChevronLeft, ChevronRight,
  Phone, MapPin, Smartphone, SmartphoneNfc, Eye, Trash2,
  UserCheck, PrinterCheck, Filter, DollarSign, Wallet,
} from 'lucide-react'
import api from '../../api/axiosInstance'
import { AddPaymentModal, UpdateFinanceProfileModal } from './FinancePage'

/* ─ نافذة إنشاء طالب ──────────────────────────────────────────── */
function CreateStudentModal({ grades, supervisors, onClose, onCreated }) {
  const [form, setForm] = useState({
    username: '', phone: '', full_name: '', password: '', guardian_name: '',
    guardian_phone: '', address: '', system_type: 'online',
    enrolled_grade: '', supervisor: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setError('')
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form }
      if (!payload.enrolled_grade) delete payload.enrolled_grade
      if (!payload.supervisor) delete payload.supervisor
      await api.post('/students/', payload)
      onCreated()
      onClose()
    } catch (err) {
      const d = err.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'حدث خطأ.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
      <div className="glass-card-strong w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-cairo font-bold text-white text-lg flex items-center gap-2">
            <Plus size={18} className="text-brand-blue" /> طالب جديد
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-white/50 text-xs mb-1 block">اسم المستخدم *</label>
              <input name="username" value={form.username} onChange={handleChange} required placeholder="اسم مستخدم فريد للدخول" className="input-glass" dir="ltr" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">الاسم الكامل *</label>
              <input name="full_name" value={form.full_name} onChange={handleChange} required placeholder="الاسم ثلاثياً" className="input-glass" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">رقم الهاتف</label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="+249..." className="input-glass" dir="ltr" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">كلمة المرور *</label>
              <input name="password" value={form.password} onChange={handleChange} required type="password" placeholder="6 أحرف+" className="input-glass" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">نوع النظام *</label>
              <select name="system_type" value={form.system_type} onChange={handleChange} className="input-glass">
                <option value="online">أونلاين</option>
                <option value="flash">فلاش</option>
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">اسم ولي الأمر *</label>
              <input name="guardian_name" value={form.guardian_name} onChange={handleChange} required placeholder="اسم الوالد/الولي" className="input-glass" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">هاتف ولي الأمر</label>
              <input name="guardian_phone" value={form.guardian_phone} onChange={handleChange} placeholder="+249..." className="input-glass" dir="ltr" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">الفصل المسجّل فيه</label>
              <select name="enrolled_grade" value={form.enrolled_grade} onChange={handleChange} className="input-glass">
                <option value="">— اختر فصلاً —</option>
                {grades.map((g) => <option key={g.id} value={g.id}>{g.level_name} — {g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">المشرفة</label>
              <select name="supervisor" value={form.supervisor} onChange={handleChange} className="input-glass">
                <option value="">— بدون مشرفة —</option>
                {supervisors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">السكن</label>
            <input name="address" value={form.address} onChange={handleChange} placeholder="المدينة / الحي" className="input-glass" />
          </div>

          {error && <p className="text-brand-red text-xs bg-brand-red/10 rounded-xl p-3">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {saving ? 'جاري الحفظ...' : 'حفظ الطالب'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-6">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  )
}



/* ─ نافذة تعديل طالب ──────────────────────────────────────────── */
function EditStudentModal({ student, grades, supervisors, onClose, onUpdated }) {
  const [form, setForm] = useState({
    username: student.user?.username || '',
    phone: student.user?.phone || '',
    full_name: student.user?.full_name || '',
    guardian_name: student.guardian_name || '',
    guardian_phone: student.guardian_phone || '',
    address: student.address || '',
    system_type: student.system_type || 'online',
    enrolled_grade: student.enrolled_grade || '',
    supervisor: student.supervisor || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        user: {
          username: form.username,
          full_name: form.full_name,
          phone: form.phone,
        },
        guardian_name: form.guardian_name,
        guardian_phone: form.guardian_phone,
        address: form.address,
        system_type: form.system_type,
        enrolled_grade: form.enrolled_grade || null,
        supervisor: form.supervisor || null,
      }
      await api.patch(`/students/${student.id}/`, payload)
      onUpdated()
      onClose()
    } catch (err) {
      const d = err.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'حدث خطأ.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
      <div className="glass-card-strong w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-cairo font-bold text-white text-lg flex items-center gap-2">
            <Edit size={18} className="text-brand-blue" /> تعديل بيانات الطالب
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-white/50 text-xs mb-1 block">اسم المستخدم *</label>
              <input name="username" value={form.username} onChange={handleChange} required className="input-glass" dir="ltr" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">الاسم الكامل *</label>
              <input name="full_name" value={form.full_name} onChange={handleChange} required className="input-glass" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">رقم الهاتف</label>
              <input name="phone" value={form.phone} onChange={handleChange} className="input-glass" dir="ltr" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">نوع النظام *</label>
              <select name="system_type" value={form.system_type} onChange={handleChange} className="input-glass">
                <option value="online">أونلاين</option>
                <option value="flash">فلاش</option>
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">اسم ولي الأمر *</label>
              <input name="guardian_name" value={form.guardian_name} onChange={handleChange} required className="input-glass" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">هاتف ولي الأمر</label>
              <input name="guardian_phone" value={form.guardian_phone} onChange={handleChange} className="input-glass" dir="ltr" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">الفصل</label>
              <select name="enrolled_grade" value={form.enrolled_grade} onChange={handleChange} className="input-glass">
                <option value="">— اختر فصلاً —</option>
                {grades.map((g) => <option key={g.id} value={g.id}>{g.level_name} — {g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">المشرفة</label>
              <select name="supervisor" value={form.supervisor} onChange={handleChange} className="input-glass">
                <option value="">— بدون مشرفة —</option>
                {supervisors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">السكن</label>
            <input name="address" value={form.address} onChange={handleChange} className="input-glass" />
          </div>

          {error && <p className="text-brand-red text-xs bg-brand-red/10 rounded-xl p-3">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Edit size={16} />}
              {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-6">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─ نافذة حذف طالب ───────────────────────────────────────────── */
function DeleteStudentModal({ student, onClose, onDeleted }) {
  const [saving, setSaving] = useState(false)

  const handleDelete = async () => {
    setSaving(true)
    try {
      await api.delete(`/students/${student.id}/`)
      onDeleted()
      onClose()
    } catch (e) {
      alert("حدث خطأ أثناء الحذف.")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
      <div className="glass-card-strong w-full max-w-sm p-6 text-center animate-scale-in">
        <div className="w-14 h-14 rounded-full bg-brand-red/20 text-brand-red flex items-center justify-center mx-auto mb-4 border border-brand-red/30">
          <Trash size={28} />
        </div>
        <h3 className="font-cairo font-bold text-white text-lg mb-2">تأكيد الحذف</h3>
        <p className="text-white/60 text-sm mb-6">
          هل أنت متأكد أنك تريد حذف الطالب <span className="font-bold text-white">{student.user?.full_name}</span> بشكل نهائي؟
          هذا الإجراء سيحذف كافة سجّلاته ومعلوماته (بما فيها الملف المالي والدفعات).
        </p>
        <div className="flex gap-3">
          <button onClick={handleDelete} disabled={saving} className="btn-primary bg-brand-red hover:bg-red-600 flex-1 justify-center">
            {saving ? <Loader2 className="animate-spin" size={16} /> : 'نعم، احذف نهائياً'}
          </button>
          <button onClick={onClose} className="btn-secondary px-5">إلغاء</button>
        </div>
      </div>
    </div>
  )
}

/* ─ الصفحة الرئيسية ────────────────────────────────────────────── */
export default function StudentsPage() {
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [grades, setGrades] = useState([])
  const [supervisors, setSupervisors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [viewStudent, setViewStudent] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10
  const [levels, setLevels] = useState([])
  const [level, setLevel] = useState('')
  const [grade, setGrade] = useState('')
  const [editStudent, setEditStudent] = useState(null)
  const [delStudent, setDelStudent] = useState(null)
  const [addPayment, setAddPayment] = useState(null)
  const [editFinance, setEditFinance] = useState(null)
  const [systemType, setSystemType] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const params = { page, search, level, grade }
    if (systemType) params.system_type = systemType
    api.get('/students/', { params })
      .then(({ data }) => {
        setStudents(data.results || data)
        setTotal(data.count || (data.results ? data.count : data.length))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search, level, grade, systemType])

  useEffect(() => { load() }, [load])

  // خيارات المراحل والفصول والمشرفات
  useEffect(() => {
    Promise.all([
      api.get('/academic/levels/').catch(() => ({ data: [] })),
      api.get('/academic/grades/').catch(() => ({ data: [] })),
      api.get('/supervisors/').catch(() => ({ data: [] })),
    ]).then(([l, g, s]) => {
      setLevels(l.data.results || l.data)
      setGrades(g.data.results || g.data)
      setSupervisors(s.data.results || s.data)
    })
  }, [])

  const unbindDevice = async (id) => {
    if (!window.confirm('هل أنت متأكد من فك ارتباط الجهاز؟')) return
    await api.post(`/students/${id}/unbind-device/`, { confirm: true })
    load()
  }

  const printReport = (supervisorId, supervisorName) => {
    window.open(`/api/supervisors/${supervisorId}/report/?format=print`, '_blank')
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* الرأس */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
            <Users size={20} className="text-brand-blue" /> إدارة الطلاب
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            إجمالي: <span className="text-brand-blue font-medium">{total}</span> طالب
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={16} /> طالب جديد
        </button>
      </div>

      {/* شريط البحث والفلاتر */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="ابحث بالاسم أو الهاتف أو المستخدم..."
            className="input-glass pr-10 w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>

        <select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1) }} className="input-glass w-auto min-w-[120px]">
          <option value="">— كل المراحل —</option>
          {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>

        <select value={grade} onChange={(e) => { setGrade(e.target.value); setPage(1) }} className="input-glass w-auto min-w-[120px]">
          <option value="">— كل الفصول —</option>
          {grades
            .filter(g => !level || g.level == level || String(g.level?.id) == String(level))
            .map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <select value={systemType} onChange={(e) => { setSystemType(e.target.value); setPage(1) }} className="input-glass w-auto min-w-[120px]">
          <option value="">— كل الأنظمة —</option>
          <option value="online">أونلاين</option>
          <option value="flash">فلاش</option>
        </select>
      </div>

      {/* الجدول */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-white/40">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد نتائج.</p>
          </div>
        ) : (
          <table className="table-glass">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الهاتف</th>
                <th>النظام</th>
                <th>الفصل</th>
                <th>المشرفة</th>
                <th>الجهاز</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-dark-500 flex items-center justify-center text-xs font-bold text-brand-blue shrink-0">
                        {s.user?.full_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{s.user?.full_name}</p>
                        {s.address && <p className="text-white/30 text-xs flex items-center gap-1"><MapPin size={10} />{s.address}</p>}
                      </div>
                    </div>
                  </td>
                  <td dir="ltr" className="text-left">
                    <span className="text-white/70 text-sm flex items-center gap-1">
                      <Phone size={12} className="text-white/30" />{s.user?.phone}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${s.system_type === 'online' ? 'badge-blue' : 'badge-red'}`}>
                      {s.system_type_display}
                    </span>
                  </td>
                  <td className="text-white/60 text-sm">{s.enrolled_grade_name || '—'}</td>
                  <td className="text-white/60 text-sm">{s.supervisor_name || '—'}</td>
                  <td>
                    {s.device_id ? (
                      <div className="flex items-center gap-1">
                        <span className="badge-green badge text-xs">مربوط</span>
                        <button
                          onClick={() => unbindDevice(s.id)}
                          title="فك الارتباط"
                          className="btn-ghost p-1 text-brand-red flex items-center gap-1 text-xs"
                        >
                          <SmartphoneNfc size={12} /> إعادة ضبط
                        </button>
                      </div>
                    ) : (
                      <span className="text-white/25 text-xs flex items-center gap-1">
                        <Smartphone size={12} /> غير مربوط
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setAddPayment({ id: s.id, name: s.user?.full_name, balance: s.balance || 0 })} title="إضافة دفعة" className="btn-ghost p-1.5 text-neon-cyan hover:bg-neon-cyan/10 rounded-lg">
                        <DollarSign size={15} />
                      </button>
                      <button onClick={() => setEditFinance({ id: s.id, name: s.user?.full_name })} title="الملف المالي (المطلوب)" className="btn-ghost p-1.5 text-brand-blue hover:bg-brand-blue/10 rounded-lg">
                        <Wallet size={15} />
                      </button>
                      <button onClick={() => navigate(`/dashboard/students/${s.id}`)} title="تفاصيل كاملة" className="btn-ghost p-1.5 text-brand-blue hover:bg-brand-blue/10 rounded-lg">
                        <Eye size={15} />
                      </button>
                      <button onClick={() => setEditStudent(s)} title="تعديل" className="btn-ghost p-1.5 text-amber-400 hover:bg-amber-400/10 rounded-lg">
                        <Edit size={15} />
                      </button>
                      <button onClick={() => setDelStudent(s)} title="حذف" className="btn-ghost p-1.5 text-brand-red hover:bg-brand-red/10 rounded-lg">
                        <Trash size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/05">
            <p className="text-white/40 text-xs">صفحة {page} من {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}
                className="btn-ghost p-1.5 disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
              <button disabled={page === totalPages} onClick={() => setPage(page + 1)}
                className="btn-ghost p-1.5 disabled:opacity-30">
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* نافذة إنشاء طالب */}
      {showCreate && (
        <CreateStudentModal
          grades={grades}
          supervisors={supervisors}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}

      {editStudent && (
        <EditStudentModal
          student={editStudent}
          grades={grades}
          supervisors={supervisors}
          onClose={() => setEditStudent(null)}
          onUpdated={load}
        />
      )}

      {delStudent && (
        <DeleteStudentModal
          student={delStudent}
          onClose={() => setDelStudent(null)}
          onDeleted={load}
        />
      )}

      {/* نافذة إضافة دفعة */}
      {addPayment && (
        <AddPaymentModal
          studentId={addPayment.id}
          studentName={addPayment.name}
          balance={addPayment.balance}
          onClose={() => setAddPayment(null)}
          onAdded={load}
        />
      )}

      {/* نافذة إنشاء/تعديل الملف المالي */}
      {editFinance && (
        <UpdateFinanceProfileModal
          studentId={editFinance.id}
          studentName={editFinance.name}
          onClose={() => setEditFinance(null)}
          onUpdated={load}
        />
      )}
    </div>
  )
}
