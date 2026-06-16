import re

with open("FinancePage.jsx", "r") as f:
    content = f.read()

# 1. Update AddPaymentModal props
content = content.replace(
    'function AddPaymentModal({ studentId, studentName, onClose, onAdded }) {',
    'function AddPaymentModal({ studentId, studentName, balance, onClose, onAdded }) {'
)

# 2. Update AddPaymentModal form state
content = content.replace(
    "payment_method: 'cash', payment_date: new Date().toISOString().split('T')[0], notes: '' }",
    "payment_method: 'cash', bank_name: '', transaction_id: '', payment_date: new Date().toISOString().split('T')[0], notes: '' }"
)

# 3. Add conditionally rendered inputs in AddPaymentModal right after payment_method
new_method_block = """          <div>
            <label className="text-white/50 text-xs mb-1 block">طريقة الدفع</label>
            <select name="payment_method" value={form.payment_method} onChange={handleChange} className="input-glass">
              <option value="cash">نقداً</option>
              <option value="bank_transfer">تحويل بنكي</option>
              <option value="mobile_money">محفظة إلكترونية</option>
              <option value="other">أخرى</option>
            </select>
          </div>

          {form.payment_method === 'bank_transfer' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/50 text-xs mb-1 block">اسم البنك *</label>
                <input name="bank_name" value={form.bank_name} onChange={handleChange}
                  required placeholder="مثال: بنك الخرطوم" className="input-glass" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">رقم المعاملة *</label>
                <input name="transaction_id" value={form.transaction_id} onChange={handleChange}
                  required placeholder="رقم التحويل" className="input-glass" />
              </div>
            </div>
          )}"""

content = content.replace("""          <div>
            <label className="text-white/50 text-xs mb-1 block">طريقة الدفع</label>
            <select name="payment_method" value={form.payment_method} onChange={handleChange} className="input-glass">
              <option value="cash">نقداً</option>
              <option value="bank_transfer">تحويل بنكي</option>
              <option value="mobile_money">محفظة إلكترونية</option>
              <option value="other">أخرى</option>
            </select>
          </div>""", new_method_block)

# Add "remaining balance" to AddPaymentModal title
content = content.replace(
    '<Plus size={18} className="text-brand-blue" /> دفعة جديدة — {studentName}',
    '<Plus size={18} className="text-brand-blue" /> دفعة جديدة — {studentName} <span className="text-sm font-normal text-white/50 mr-auto">(المتبقي: {balance} ج.س)</span>'
)

# 4. Refactor FinancePage into tabs, displaying Payments Table
new_page_state = """export default function FinancePage() {
  const [tab, setTab] = useState('files') // 'files' | 'payments'
  const [files, setFiles] = useState([])
  const [paymentsList, setPaymentsList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [addPayment, setAddPayment] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [printData, setPrintData] = useState(null)
"""

content = content.replace("""export default function FinancePage() {
  const [files,       setFiles]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [addPayment,  setAddPayment]  = useState(null)   // { id, name }
  const [page,        setPage]        = useState(1)
  const [total,       setTotal]       = useState(0)
  const [printData,   setPrintData]   = useState(null)   // { file, payment }""", new_page_state)


new_load_func = """  const load = useCallback(() => {
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
  }, [page, search, tab])"""

# We need to replace `const load = useCallback(() => { ... }, [page, search])` with `new_load_func`
content = re.sub(r'const load = useCallback\(\(\) => \{.+?\}, \[page, search\]\)', new_load_func, content, flags=re.DOTALL)

# Tabbing UI
tab_ui = """      <div className="flex bg-dark-800 p-1 rounded-xl w-max border border-white/5">
        <button onClick={() => {setTab('files'); setPage(1); setSearch('');}} className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'files' ? 'bg-brand-blue text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>الملفات المالية</button>
        <button onClick={() => {setTab('payments'); setPage(1); setSearch('');}} className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'payments' ? 'bg-brand-blue text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>سجل الدفعات</button>
      </div>

      <div className="relative max-w-sm">"""

content = content.replace("""      <div className="relative max-w-sm">""", tab_ui)


# Change setAddPayment call to pass balance
content = content.replace("setAddPayment({ id: f.student, name: f.student_name })", "setAddPayment({ id: f.student, name: f.student_name, balance: balance.toLocaleString() })")


# Replace the main glass-card table area dynamically
table_area = """      {/* الجدول */}
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
                const balance = parseFloat(f.balance || 0)
                const settled = balance === 0
                return (
                  <tr key={f.id}>
                    <td className="font-medium text-white">{f.student_name}</td>
                    <td className="text-white/70">{Number(f.total_required).toLocaleString()} ج.س</td>
                    <td className="text-neon-cyan font-medium">{Number(f.total_paid).toLocaleString()} ج.س</td>
                    <td className={settled ? 'text-white/30' : 'text-brand-red font-medium'}>
                      {balance.toLocaleString()} ج.س
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
                        <button onClick={() => setAddPayment({ id: f.student, name: f.student_name, balance: balance.toLocaleString() })}
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
                <th>التاريخ</th>
                <th>المبلغ</th>
                <th>الريال (﷼)</th>
                <th>طريقة الدفع</th>
                <th>المعاملة / الإيصال</th>
              </tr>
            </thead>
            <tbody>
              {paymentsList.map(p => (
                <tr key={p.id}>
                  <td className="font-medium text-white">{p.financial_file?.student?.user?.full_name || 'غير معروف'}</td>
                  <td className="text-white/70 text-sm" dir="ltr">{p.payment_date}</td>
                  <td className="text-neon-cyan font-medium">{Number(p.amount_sdg).toLocaleString()} ج.س</td>
                  <td className="text-brand-blue font-bold">{p.amount_sar} ﷼</td>
                  <td>
                    <span className="badge-blue badge text-xs">{p.payment_method_display}</span>
                    {p.bank_name ? <span className="text-xs text-white/50 block mt-1">{p.bank_name}</span> : null}
                  </td>
                  <td className="text-white/40 text-xs">
                    {p.transaction_id ? <span className="text-neon-cyan bg-neon-cyan/10 px-1.5 py-0.5 rounded">معاملة: {p.transaction_id}</span> : null}
                    <span className="block mt-1">إيصال: {p.receipt_number}</span>
                  </td>
                </tr>
              ))}
              {!paymentsList.length && <tr><td colSpan={6} className="text-center text-white/40 py-8">لا توجد بيانات</td></tr>}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/05">
            <p className="text-white/40 text-xs">صفحة {page} من {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page===1} onClick={() => setPage(p=>p-1)} className="btn-ghost p-1.5 disabled:opacity-30"><ChevronRight size={16} /></button>
              <button disabled={page===totalPages} onClick={() => setPage(p=>p+1)} className="btn-ghost p-1.5 disabled:opacity-30"><ChevronLeft size={16} /></button>
            </div>
          </div>
        )}
      </div>"""

# Find the start and end of the original table block
start_idx = content.find('{/* الجدول */}')
end_idx = content.find('{/* تفاصيل الملف المالي */}')
content = content[:start_idx] + table_area + '\n\n      ' + content[end_idx:]


# Also need to fix the Student details modal inside FinancePage (it maps p.payments)
# Add transaction string there as well
transaction_details = """<p className="text-white/25 text-xs">
                      سعر الصرف: {p.exchange_rate_at_payment} | إيصال: {p.receipt_number}
                      {p.transaction_id ? ` | معاملة: ${p.transaction_id} (${p.bank_name})` : ''}
                    </p>"""
content = content.replace('<p className="text-white/25 text-xs">سعر الصرف: {p.exchange_rate_at_payment} | الرقم: {p.receipt_number}</p>', transaction_details)


with open("FinancePage.jsx", "w") as f:
    f.write(content)
print("done")
