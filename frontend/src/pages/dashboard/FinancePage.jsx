/**
 * pages/dashboard/FinancePage.jsx
 * الملفات المالية — عرض + إضافة دفعة + طباعة إيصال
 */

import { useEffect, useState, useCallback } from 'react'
import {
  DollarSign, Search, Plus, Loader2, X, Printer,
  ChevronLeft, ChevronRight, Receipt, TrendingUp,
  CheckCircle, AlertTriangle, Wallet, Trash2, Edit
} from 'lucide-react'
import api from '../../api/axiosInstance'

/* ─ نافذة إنشاء/تعديل الملف المالي ──────────────────────────────── */
export function UpdateFinanceProfileModal({ studentId, studentName, currentRequired, currentNotes, onClose, onUpdated }) {
  const [form, setForm] = useState({
    total_required: currentRequired || '',
    notes: currentNotes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.patch(`/finance/student/${studentId}/file/`, form)
      onUpdated()
      onClose()
    } catch (err) {
      const d = err.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'حدث خطأ.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
      <div className="glass-card-strong w-full max-w-sm p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-cairo font-bold text-white text-lg flex items-center gap-2">
            <DollarSign size={18} className="text-brand-blue" /> الملف المالي — {studentName}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-white/50 text-xs mb-1 block">إجمالي المطلوب من الطالب (جنيه سوداني)</label>
            <input
              name="total_required"
              value={form.total_required}
              onChange={handleChange}
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="مثال: 500000"
              className="input-glass"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">ملاحظات إدارية للصندوق</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              placeholder="اختياري"
              className="input-glass resize-none"
            />
          </div>
          {error && <p className="text-brand-red text-xs bg-brand-red/10 rounded-xl p-3">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {saving ? 'جاري الحفظ...' : 'حفظ الملف وحساب المتبقي'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─ نافذة إضافة دفعة ──────────────────────────────────────────── */
export function AddPaymentModal({ studentId, studentName, balance, onClose, onAdded }) {
  const [form, setForm] = useState({
    amount_sdg: '', payment_method: 'cash', bank_name: '', sender_account_number: '',
    transaction_id: '', payment_date: new Date().toISOString().split('T')[0], notes: '',
  })
  const [rate, setRate] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // parse the balance string/number prop into a plain float
  const remainingBalance = parseFloat(String(balance).replace(/,/g, '')) || 0

  useEffect(() => {
    api.get('/finance/exchange-rates/current/')
      .then(({ data }) => setRate(data.rate))
      .catch(() => { })
  }, [])

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const enteredAmount   = parseFloat(form.amount_sdg) || 0
  const isOverpayment   = enteredAmount > remainingBalance && remainingBalance > 0

  const handleSave = async (e) => {
    e.preventDefault()
    if (isOverpayment) return
    setSaving(true)
    try {
      await api.post(`/finance/student/${studentId}/payments/`, form)
      onAdded()
      onClose()
    } catch (err) {
      const d = err.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'حدث خطأ.')
    } finally { setSaving(false) }
  }

  const estimatedSAR = rate && form.amount_sdg
    ? (parseFloat(form.amount_sdg) / parseFloat(rate)).toFixed(2)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
      <div className="glass-card-strong w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-cairo font-bold text-white text-lg flex items-center gap-2">
            <Plus size={18} className="text-brand-blue" /> دفعة جديدة — {studentName}
            <span className="text-sm font-normal text-white/50 mr-auto">(المتبقي: {remainingBalance.toLocaleString('en-US')} ج.س)</span>
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-white/50 text-xs mb-1 block">المبلغ (جنيه سوداني) *</label>
            <input
              name="amount_sdg"
              value={form.amount_sdg}
              onChange={handleChange}
              required
              type="number"
              min="1"
              max={remainingBalance > 0 ? remainingBalance : undefined}
              step="0.01"
              placeholder="0.00"
              className={`input-glass ${isOverpayment ? 'border-brand-red ring-1 ring-brand-red' : ''}`}
            />
            {isOverpayment && (
              <p className="text-brand-red text-xs mt-1.5 flex items-center gap-1 bg-brand-red/10 rounded-lg px-3 py-2">
                <AlertTriangle size={12} />
                المبلغ يتجاوز المتبقي ({remainingBalance.toLocaleString('en-US')} ج.س). الحد الأقصى هو المبلغ المتبقي.
              </p>
            )}
            {!isOverpayment && estimatedSAR && (
              <p className="text-neon-cyan text-xs mt-1 flex items-center gap-1">
                <TrendingUp size={10} />
                ≈ {estimatedSAR} ريال سعودي (بسعر {rate} ج.س/ريال)
              </p>
            )}
          </div>

          <div>
            <label className="text-white/50 text-xs mb-1 block">طريقة الدفع</label>
            <select name="payment_method" value={form.payment_method} onChange={handleChange} className="input-glass">
              <option value="cash">نقداً</option>
              <option value="bank_transfer">تحويل بنكي</option>
            </select>
          </div>

          {form.payment_method === 'bank_transfer' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-white/50 text-xs mb-1 block">اسم البنك *</label>
                <input name="bank_name" value={form.bank_name} onChange={handleChange}
                  required placeholder="مثال: بنك الخرطوم" className="input-glass" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">رقم حساب المُرسل *</label>
                <input name="sender_account_number" value={form.sender_account_number} onChange={handleChange}
                  required placeholder="رقم الحساب الذي أرسل منه" className="input-glass" />
              </div>
              <div className="md:col-span-2">
                <label className="text-white/50 text-xs mb-1 block">رقم المعاملة / التحويل *</label>
                <input name="transaction_id" value={form.transaction_id} onChange={handleChange}
                  required placeholder="رقم التحويل" className="input-glass" />
              </div>
            </div>
          )}

          <div>
            <label className="text-white/50 text-xs mb-1 block">تاريخ الدفع</label>
            <input name="payment_date" value={form.payment_date} onChange={handleChange}
              type="date" className="input-glass" />
          </div>

          <div>
            <label className="text-white/50 text-xs mb-1 block">ملاحظات</label>
            <textarea name="notes" value={form.notes} onChange={handleChange}
              rows={2} placeholder="اختياري" className="input-glass resize-none" />
          </div>

          {error && <p className="text-brand-red text-xs bg-brand-red/10 rounded-xl p-3">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || isOverpayment}
              className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <><Loader2 size={16} className="animate-spin" /> جاري الحفظ...</> : <><Receipt size={16} /> تسجيل الدفعة</>}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-5">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─ نافذة تعديل دفعة ──────────────────────────────────────────── */
export function EditPaymentModal({ payment, studentName, balance, onClose, onUpdated }) {
  const [form, setForm] = useState({
    amount_sdg: payment.amount_sdg || '', payment_method: payment.payment_method || 'cash', 
    bank_name: payment.bank_name || '', sender_account_number: payment.sender_account_number || '',
    transaction_id: payment.transaction_id || '', payment_date: payment.payment_date || new Date().toISOString().split('T')[0], 
    notes: payment.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const remainingBalance = (parseFloat(String(balance).replace(/,/g, '')) || 0) + parseFloat(payment.amount_sdg || 0)

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const enteredAmount = parseFloat(form.amount_sdg) || 0
  const isOverpayment = enteredAmount > remainingBalance && remainingBalance > 0

  const handleSave = async (e) => {
    e.preventDefault()
    if (isOverpayment) return
    setSaving(true)
    try {
      await api.patch(`/finance/payments/${payment.id}/`, form)
      onUpdated()
      onClose()
    } catch (err) {
      const d = err.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'حدث خطأ.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
      <div className="glass-card-strong w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-cairo font-bold text-white text-lg flex items-center gap-2">
            <Edit size={18} className="text-brand-blue" /> تعديل دفعة — {studentName}
            <span className="text-sm font-normal text-white/50 mr-auto">(أقصى حد: {remainingBalance.toLocaleString('en-US')} ج.س)</span>
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-white/50 text-xs mb-1 block">المبلغ (جنيه سوداني) *</label>
            <input name="amount_sdg" value={form.amount_sdg} onChange={handleChange}
              required type="number" min="1" max={remainingBalance > 0 ? remainingBalance : undefined} step="0.01"
              placeholder="0.00" className={`input-glass ${isOverpayment ? 'border-brand-red ring-1 ring-brand-red' : ''}`} />
            {isOverpayment && (
              <p className="text-brand-red text-xs mt-1.5 flex items-center gap-1 bg-brand-red/10 rounded-lg px-3 py-2">
                <AlertTriangle size={12} />
                المبلغ يتجاوز المتبقي.
              </p>
            )}
          </div>

          <div>
            <label className="text-white/50 text-xs mb-1 block">طريقة الدفع</label>
            <select name="payment_method" value={form.payment_method} onChange={handleChange} className="input-glass">
              <option value="cash">نقداً</option>
              <option value="bank_transfer">تحويل بنكي</option>
            </select>
          </div>

          {form.payment_method === 'bank_transfer' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-white/50 text-xs mb-1 block">اسم البنك *</label>
                <input name="bank_name" value={form.bank_name} onChange={handleChange}
                  required placeholder="مثال: بنك الخرطوم" className="input-glass" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">رقم حساب المُرسل *</label>
                <input name="sender_account_number" value={form.sender_account_number} onChange={handleChange}
                  required placeholder="رقم الحساب" className="input-glass" />
              </div>
              <div className="md:col-span-2">
                <label className="text-white/50 text-xs mb-1 block">رقم المعاملة / التحويل *</label>
                <input name="transaction_id" value={form.transaction_id} onChange={handleChange}
                  required placeholder="رقم التحويل" className="input-glass" />
              </div>
            </div>
          )}

          <div>
            <label className="text-white/50 text-xs mb-1 block">تاريخ الدفع</label>
            <input name="payment_date" value={form.payment_date} onChange={handleChange} type="date" className="input-glass" />
          </div>

          <div>
            <label className="text-white/50 text-xs mb-1 block">ملاحظات</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} placeholder="اختياري" className="input-glass resize-none" />
          </div>

          {error && <p className="text-brand-red text-xs bg-brand-red/10 rounded-xl p-3">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving || isOverpayment} className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? <><Loader2 size={16} className="animate-spin" /> جاري الحفظ...</> : <><CheckCircle size={16} /> حفظ التعديلات</>}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-5">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─ إيصال الطباعة ──────────────────────────────────────────────── */
function PrintableReceipt({ file, payment }) {
  return (
    <div className="hidden print:block p-8 font-tajawal text-black bg-white" dir="rtl">
      <div className="text-center border-b pb-4 mb-6">
        <h1 className="text-2xl font-bold">مدارس ومعاهد نمبر ون</h1>
        <p className="text-gray-500 text-sm mt-1">إيصال دفع رسمي</p>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">رقم الإيصال:</span><span className="font-bold">{payment?.receipt_number}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">اسم الطالب:</span><span>{file?.student_name}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">المبلغ:</span><span className="font-bold text-green-700">{payment?.amount_sdg} ج.س</span></div>
        <div className="flex justify-between"><span className="text-gray-500">ما يعادل:</span><span>{payment?.amount_sar} ريال سعودي</span></div>
        <div className="flex justify-between"><span className="text-gray-500">سعر الصرف المعتمد:</span><span>{payment?.exchange_rate_at_payment} ج.س/ريال</span></div>
        <div className="flex justify-between"><span className="text-gray-500">طريقة الدفع:</span><span>{payment?.payment_method_display}</span></div>
        {payment?.payment_method === 'bank_transfer' && (
          <>
            <div className="flex justify-between"><span className="text-gray-500">البنك / المُرسل:</span><span>{payment?.bank_name} {payment?.sender_account_number ? `(مُرسل: ${payment?.sender_account_number})` : ''}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">رقم المعاملة:</span><span>{payment?.transaction_id}</span></div>
          </>
        )}
        <div className="flex justify-between"><span className="text-gray-500">التاريخ:</span><span>{payment?.payment_date}</span></div>
      </div>
      <div className="border-t mt-6 pt-4 text-xs text-gray-400 text-center">شكراً لثقتكم — نمبر ون</div>
    </div>
  )
}

/* ─ الصفحة ─────────────────────────────────────────────────────── */
export default function FinancePage() {
  const [tab, setTab] = useState('files') // 'files' | 'payments'
  const [files, setFiles] = useState([])
  const [paymentsList, setPaymentsList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [addPayment, setAddPayment] = useState(null)
  const [editPayment, setEditPayment] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [printData, setPrintData] = useState(null)
  const [editFinance, setEditFinance] = useState(null)

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه الدفعة نهائياً؟")) return
    try {
      await api.delete(`/finance/payments/${paymentId}/`)
      load()
      if (selectedFile) openStudentFile(selectedFile.student)
    } catch (err) {
      alert("حدث خطأ أثناء الحذف.")
    }
  }

  const load = useCallback(() => {
    setLoading(true)
    if (tab === 'files') {
      api.get('/finance/files/', { params: { page, search } })
        .then(({ data }) => {
          setFiles(data.results || data)
          setTotal(data.count || (data.results ? data.count : data.length))
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      api.get('/finance/payments/', { params: { page, search } })
        .then(({ data }) => {
          setPaymentsList(data.results || data)
          setTotal(data.count || (data.results ? data.count : data.length))
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [page, search, tab])

  useEffect(() => { load() }, [load])

  const openStudentFile = async (studentId) => {
    const { data } = await api.get(`/finance/student/${studentId}/file/`)
    setSelectedFile(data)
  }

  const handlePrintReceipt = (file, payment) => {
    setPrintData({ file, payment })
    setTimeout(() => { window.print(); setPrintData(null) }, 300)
  }

  const totalPages = Math.ceil(total / 10)

  return (
    <>
      <div className="space-y-5 animate-fade-in print:hidden">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
          <DollarSign size={20} className="text-brand-blue" /> الملفات المالية
          <span className="text-white/30 font-normal text-sm">({total})</span>
        </h1>
      </div>

      {/* التبويبات */}
      <div className="flex bg-dark-800 p-1 rounded-xl w-max border border-white/5">
        <button onClick={() => { setTab('files'); setPage(1); setSearch(''); }} className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'files' ? 'bg-brand-blue text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>الملفات المالية</button>
        <button onClick={() => { setTab('payments'); setPage(1); setSearch(''); }} className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'payments' ? 'bg-brand-blue text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>سجل الدفعات</button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="ابحث باسم الطالب أو رقم المعاملة..." className="input-glass pr-10" />
        {search && <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X size={14} /></button>}
      </div>

      {/* الجدول */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><Loader2 size={28} className="animate-spin text-brand-blue mx-auto" /></div>
        ) : tab === 'files' ? (
          <table className="table-glass">
            <thead>
              <tr>
                <th>الطالب</th>
                <th>المطلوب</th>
                <th>المدفوع</th>
                <th>المتبقي</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => {
                const totalRequired = parseFloat(f.total_required || 0)
                const totalPaid     = parseFloat(f.total_paid || 0)
                const balance       = parseFloat(f.balance || 0)
                const settled       = balance === 0
                return (
                  <tr key={f.id}>
                    <td className="font-medium text-white">{f.student_name}</td>
                    <td className="text-white/70">{totalRequired.toLocaleString('en-US')} ج.س</td>
                    <td className="text-neon-cyan font-medium">{totalPaid.toLocaleString('en-US')} ج.س</td>
                    <td className={settled ? 'text-white/30' : 'text-brand-red font-medium'}>
                      {balance.toLocaleString('en-US')} ج.س
                    </td>
                    <td>
                      {settled
                        ? <span className="badge-green badge"><CheckCircle size={10} /> مسدَّد</span>
                        : <span className="badge-red badge"><AlertTriangle size={10} /> متبقٍّ</span>
                      }
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => openStudentFile(f.student)}
                          className="btn-ghost p-1.5 text-brand-blue text-xs">تفاصيل</button>
                        <button onClick={() => setAddPayment({ id: f.student, name: f.student_name, balance: balance.toLocaleString('en-US') })}
                          className="btn-ghost p-1.5 text-neon-cyan text-xs flex items-center gap-1">
                          <Plus size={12} /> دفعة
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!files.length && <tr><td colSpan={6} className="text-center text-white/40 py-8">لا توجد بيانات</td></tr>}
            </tbody>
          </table>
        ) : (
          <table className="table-glass">
            <thead>
              <tr>
                <th>الطالب</th>
                <th>المطلوب</th>
                <th>المتبقي</th>
                <th>التاريخ</th>
                <th>المبلغ</th>
                <th>الريال (﷼)</th>
                <th>طريقة الدفع</th>
                <th>المعاملة / الإيصال</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {paymentsList.map(p => {
                const amountSar      = parseFloat(p.amount_sar || 0)
                const totalRequired  = parseFloat(p.student_total_required || 0)
                const studentBalance = parseFloat(p.student_balance || 0)
                const amountSdg      = parseFloat(p.amount_sdg || 0)
                const sarIsZero      = amountSar === 0
                return (
                  <tr key={p.id}>
                    <td className="font-medium text-white">{p.student_name || 'غير معروف'}</td>
                    <td className="text-white/70 text-sm">{totalRequired.toLocaleString('en-US')} ج.س</td>
                    <td className={`font-bold text-sm ${studentBalance === 0 ? 'text-white/30' : 'text-brand-red'}`}>
                      {studentBalance.toLocaleString('en-US')} ج.س
                    </td>
                    <td className="text-white/70 text-sm" dir="ltr">{p.payment_date}</td>
                    <td className="text-neon-cyan font-medium">{amountSdg.toLocaleString('en-US')} ج.س</td>
                    <td className="font-bold">
                      {sarIsZero
                        ? <span className="text-amber-400 text-xs" title="لم يكن هناك سعر صرف نشط وقت هذه الدفعة">— لا سعر ﷼</span>
                        : <span className="text-brand-blue">{amountSar.toLocaleString('en-US')} ﷼</span>
                      }
                    </td>
                    <td>
                      <span className="badge-blue badge text-xs">{p.payment_method_display}</span>
                      {p.bank_name && (
                        <span className="text-xs text-white/50 block mt-1">
                          {p.bank_name}
                          {p.sender_account_number && ` (مُرسل: ${p.sender_account_number})`}
                        </span>
                      )}
                    </td>
                    <td className="text-white/40 text-xs">
                      {p.transaction_id ? <span className="text-neon-cyan bg-neon-cyan/10 px-1.5 py-0.5 rounded">معاملة: {p.transaction_id}</span> : null}
                      <span className="block mt-1">إيصال: {p.receipt_number}</span>
                    </td>
                    <td>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditPayment({ payment: p, studentName: p.student_name, balance: studentBalance })} className="btn-ghost p-1.5 text-brand-blue" title="تعديل"><Edit size={14} /></button>
                        <button onClick={() => handleDeletePayment(p.id)} className="btn-ghost p-1.5 text-brand-red" title="حذف"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!paymentsList.length && <tr><td colSpan={9} className="text-center text-white/40 py-8">لا توجد بيانات</td></tr>}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/05">
            <p className="text-white/40 text-xs">صفحة {page} من {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-ghost p-1.5 disabled:opacity-30"><ChevronRight size={16} /></button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="btn-ghost p-1.5 disabled:opacity-30"><ChevronLeft size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* تفاصيل الملف المالي */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
          <div className="glass-card-strong w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-cairo font-bold text-white text-lg">
                ملف {selectedFile.student_name} المالي
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditFinance({ id: selectedFile.student, name: selectedFile.student_name, currentRequired: selectedFile.total_required, currentNotes: selectedFile.notes })}
                  className="btn-ghost p-1.5 text-brand-blue hover:bg-brand-blue/10"
                  title="تعديل إجمالي المطلوب"
                >
                  <Wallet size={16} />
                </button>
                <button
                  onClick={() => setAddPayment({ id: selectedFile.student, name: selectedFile.student_name, balance: selectedFile.balance })}
                  className="btn-primary py-1 px-3 text-xs"
                >
                  <Plus size={14} /> إضافة دفعة
                </button>
                <button onClick={() => setSelectedFile(null)} className="btn-ghost p-1.5"><X size={18} /></button>
              </div>
            </div>

            {/* ملخص */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="glass-card p-3 text-center">
                <p className="text-white/40 text-xs mb-1">المطلوب</p>
                <p className="font-bold text-white">{parseFloat(selectedFile.total_required || 0).toLocaleString('en-US')}</p>
                <p className="text-white/30 text-xs">ج.س</p>
              </div>
              <div className="glass-card p-3 text-center border-neon-cyan/20">
                <p className="text-white/40 text-xs mb-1">المدفوع</p>
                <p className="font-bold text-neon-cyan">{parseFloat(selectedFile.total_paid || 0).toLocaleString('en-US')}</p>
                <p className="text-white/30 text-xs">ج.س</p>
              </div>
              <div className="glass-card p-3 text-center border-brand-red/20">
                <p className="text-white/40 text-xs mb-1">المتبقي</p>
                <p className="font-bold text-brand-red">{parseFloat(selectedFile.balance || 0).toLocaleString('en-US')}</p>
                <p className="text-white/30 text-xs">ج.س</p>
              </div>
            </div>

            {/* سجل الدفعات */}
            <h3 className="font-cairo font-semibold text-white/70 text-sm mb-3">سجل الدفعات</h3>
            <div className="space-y-2">
              {selectedFile.payments?.map((p) => {
                const pAmountSar = parseFloat(p.amount_sar || 0)
                const pAmountSdg = parseFloat(p.amount_sdg || 0)
                return (
                  <div key={p.id} className="glass-card p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-white text-sm font-medium">{pAmountSdg.toLocaleString('en-US')} ج.س</p>
                      <p className="text-white/40 text-xs">{p.payment_date} — {p.payment_method_display}</p>
                      <p className="text-white/25 text-xs mt-0.5">
                        سعر الصرف: {p.exchange_rate_at_payment} | إيصال: {p.receipt_number}
                        {p.transaction_id ? ` | معاملة: ${p.transaction_id} (${p.bank_name}${p.sender_account_number ? ` - مُرسل: ${p.sender_account_number}` : ''})` : ''}
                      </p>
                    </div>
                    <div className="text-left shrink-0">
                      {pAmountSar === 0
                        ? <p className="text-amber-400 text-xs" title="لم يكن هناك سعر صرف نشط وقت هذه الدفعة">— لا سعر ﷼</p>
                        : <p className="text-neon-cyan text-sm font-medium">{pAmountSar.toLocaleString('en-US')} ﷼</p>
                      }
                      <button onClick={() => handlePrintReceipt(selectedFile, p)}
                        className="text-white/30 hover:text-brand-blue transition-colors mt-1 flex items-center gap-1 text-xs">
                        <Printer size={12} /> طباعة
                      </button>
                    </div>
                    <div className="flex flex-col gap-1 border-r border-white/5 pl-2 mr-2">
                       <button onClick={() => setEditPayment({ payment: p, studentName: selectedFile.student_name, balance: selectedFile.balance })} className="btn-ghost p-1 text-brand-blue"><Edit size={12} /></button>
                       <button onClick={() => handleDeletePayment(p.id)} className="btn-ghost p-1 text-brand-red"><Trash2 size={12} /></button>
                    </div>
                  </div>
                )
              })}
              {!selectedFile.payments?.length && (
                <p className="text-white/30 text-sm text-center py-4">لا توجد دفعات مسجّلة</p>
              )}
            </div>
          </div>
        </div>
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
          currentRequired={editFinance.currentRequired}
          currentNotes={editFinance.currentNotes}
          onClose={() => setEditFinance(null)}
          onUpdated={() => {
            load()
            if (selectedFile) openStudentFile(selectedFile.student)
          }}
        />
      )}

      {/* نافذة تعديل دفعة */}
      {editPayment && (
        <EditPaymentModal
          payment={editPayment.payment}
          studentName={editPayment.studentName}
          balance={editPayment.balance}
          onClose={() => setEditPayment(null)}
          onUpdated={() => {
            load()
            if (selectedFile) openStudentFile(selectedFile.student)
          }}
        />
      )}
      </div>

      {/* بيانات الطباعة (Rendered outside the print:hidden container) */}
      {printData && <PrintableReceipt file={printData.file} payment={printData.payment} />}
    </>
  )
}
