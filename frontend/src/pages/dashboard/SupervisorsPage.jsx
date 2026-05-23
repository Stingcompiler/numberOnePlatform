/**
 * pages/dashboard/SupervisorsPage.jsx
 * إدارة المشرفات + تقارير شاملة لجميع المشرفات
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserCheck, Plus, Search, X, Loader2, Edit2, Trash2,
  Phone, MapPin, Users, ChevronLeft, ChevronRight,
  FileText, Filter, BarChart2, TrendingUp, Printer,
  Calendar, ExternalLink, ChevronsLeft, ChevronsRight,
} from 'lucide-react'
import api from '../../api/axiosInstance'

/* ─ helpers ─────────────────────────────────────────────────────── */
const MONTHS_AR = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
]
const CY = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => CY - i)

/* ─ SupervisorModal ─────────────────────────────────────────────── */
function SupervisorModal({ supervisor, onClose, onSaved }) {
  const isEdit = !!supervisor?.id
  const [form, setForm] = useState({
    name:      supervisor?.name      || '',
    phone:     supervisor?.phone     || '',
    address:   supervisor?.address   || '',
    notes:     supervisor?.notes     || '',
    is_active: supervisor?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const handleChange = e => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setError(''); setForm(f => ({ ...f, [e.target.name]: val }))
  }

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    try {
      if (isEdit) await api.patch(`/supervisors/${supervisor.id}/`, form)
      else         await api.post('/supervisors/', form)
      onSaved(); onClose()
    } catch (err) {
      const d = err.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'حدث خطأ.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
      <div className="glass-card-strong w-full max-w-lg p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-cairo font-bold text-white text-lg flex items-center gap-2">
            {isEdit ? <Edit2 size={18} className="text-brand-blue" /> : <Plus size={18} className="text-brand-blue" />}
            {isEdit ? 'تعديل بيانات المشرفة' : 'مشرفة جديدة'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-white/50 text-xs mb-1 block">الاسم الكامل *</label>
              <input name="name" value={form.name} onChange={handleChange} required placeholder="اسم المشرفة" className="input-glass" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">رقم الهاتف</label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="+249..." className="input-glass" dir="ltr" />
            </div>
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">السكن / العنوان</label>
            <input name="address" value={form.address} onChange={handleChange} placeholder="المدينة / الحي" className="input-glass" />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">ملاحظات</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} placeholder="ملاحظات اختيارية..." className="input-glass resize-none" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange} className="w-4 h-4 accent-brand-blue" />
            <span className="text-white/60 text-sm">مشرفة نشطة</span>
          </label>
          {error && <p className="text-brand-red text-xs bg-brand-red/10 rounded-xl p-3">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-6">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  )
}
/* ─ printReport ─────────────────────────────────────────────────── */
/**
 * Opens a fresh popup window with a fully self-contained print document.
 * This approach avoids:
 *   – The dark overlay / glassmorphism styles leaking into print
 *   – The browser URL header line (suppressed via @page { margin:0 })
 *   – Content being clipped by position:fixed / overflow:hidden wrappers
 */
function printReport(students, summary, filterLabel) {
  const dateStr = new Date().toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  /* Build supervisor summary chips */
  const summaryHtml = summary.length > 0
    ? `<div class="summary-box">
        <p class="summary-title">ملخص المشرفات:</p>
        <div class="summary-chips">
          ${summary.map(s =>
            `<span class="chip">${s.name}: <strong>${s.count}</strong> طالب</span>`
          ).join('')}
        </div>
      </div>`
    : ''

  /* Build table rows */
  const rowsHtml = students.length > 0
    ? students.map((s, i) => {
        const gradeLevelHtml = (s.enrolled_grade_level && s.enrolled_grade_level !== '—')
          ? `<span class="grade-level">${s.enrolled_grade_level}</span>`
          : ''
        return `
          <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
            <td class="td-num">${i + 1}</td>
            <td class="td-name">${s.student_name || ''}</td>
            <td class="td-ltr">${s.phone || ''}</td>
            <td class="td-sup">${s.supervisor_name || ''}</td>
            <td>${s.enrolled_grade || ''}${gradeLevelHtml}</td>
            <td><span class="badge">${s.system_type || ''}</span></td>
            <td class="td-ltr">${s.registered_at || ''}</td>
          </tr>`
      }).join('')
    : `<tr><td colspan="7" class="empty-row">لا يوجد بيانات</td></tr>`

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>تقرير المشرفات — ${filterLabel}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Page setup: zero margin removes browser URL/date headers ── */
    @page {
      size: A4 portrait;
      margin: 0;
    }

    body {
      font-family: 'Cairo', Arial, sans-serif;
      background: #fff;
      color: #111;
      direction: rtl;
      /* Manual page margin replaces @page margin */
      padding: 14mm 16mm 14mm 16mm;
      font-size: 11pt;
      font-weight: 500;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Header ── */
    .doc-header {
      text-align: center;
      border-bottom: 2.5px solid #888;
      padding-bottom: 13px;
      margin-bottom: 18px;
    }
    .doc-header h1 {
      font-size: 20pt;
      font-weight: 800;
      color: #000;
      letter-spacing: -0.3px;
      margin-bottom: 5px;
    }
    .doc-header .subtitle {
      font-size: 11pt;
      font-weight: 700;
      color: #222;
      margin-bottom: 3px;
    }
    .doc-header .date {
      font-size: 9.5pt;
      font-weight: 500;
      color: #555;
    }

    /* ── Summary box ── */
    .summary-box {
      margin-bottom: 16px;
      padding: 9px 12px;
      background: #f0f4f8;
      border: 1px solid #bbc8d8;
      border-radius: 6px;
    }
    .summary-title {
      font-size: 10pt;
      font-weight: 800;
      color: #111;
      margin-bottom: 7px;
    }
    .summary-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
      font-size: 9.5pt;
      font-weight: 600;
      padding: 3px 11px;
      border: 1.5px solid #999;
      border-radius: 20px;
      color: #111;
      background: #fff;
    }

    /* ── Table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5pt;
      margin-bottom: 14px;
    }
    thead tr { background: #222; }
    th {
      border: 1px solid #333;
      padding: 7px 9px;
      text-align: right;
      font-weight: 800;
      color: #fff;
      white-space: nowrap;
      font-size: 10.5pt;
    }
    td {
      border: 1px solid #bbb;
      padding: 6px 9px;
      color: #111;
      font-weight: 500;
      vertical-align: top;
    }
    .row-even td { background: #fff; }
    .row-odd  td { background: #f2f2f2; }
    tr { page-break-inside: avoid; }

    .td-num  { color: #444; font-weight: 700; text-align: center; width: 32px; }
    .td-name { font-weight: 700; color: #000; }
    .td-ltr  { direction: ltr; text-align: left; color: #222; font-weight: 600; }
    .td-sup  { color: #1a4fa0; font-weight: 700; }
    .grade-level { display: block; font-size: 9pt; font-weight: 600; color: #555; margin-top: 2px; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border: 1.5px solid #666;
      border-radius: 4px;
      font-size: 9.5pt;
      font-weight: 700;
      color: #111;
    }
    .empty-row { text-align: center; padding: 20px; color: #777; font-weight: 600; }

    /* ── Footer ── */
    .doc-total {
      font-size: 11pt;
      font-weight: 800;
      color: #000;
      margin-bottom: 14px;
    }
    .doc-footer {
      border-top: 1px solid #bbb;
      padding-top: 9px;
      font-size: 8.5pt;
      font-weight: 600;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <h1>مدارس ومعاهد نمبر ون</h1>
    <p class="subtitle">تقرير طلاب المشرفات — ${filterLabel}</p>
    <p class="date">${dateStr}</p>
  </div>

  ${summaryHtml}

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>اسم الطالب</th>
        <th>الهاتف</th>
        <th>المشرفة</th>
        <th>الفصل / المرحلة</th>
        <th>النظام</th>
        <th>تاريخ التسجيل</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <p class="doc-total">الإجمالي: ${students.length} طالب</p>

  <div class="doc-footer">
    نظام مدارس ومعاهد نمبر ون — تقرير مولَّد بتاريخ ${dateStr}
  </div>

  <script>
    window.onload = function () {
      window.print();
      window.onafterprint = function () { window.close(); };
    };
  <\/script>
</body>
</html>`

  const popup = window.open('', '_blank', 'width=900,height=700,scrollbars=yes')
  if (!popup) {
    alert('يُرجى السماح بالنوافذ المنبثقة لطباعة التقرير.')
    return
  }
  popup.document.open()
  popup.document.write(html)
  popup.document.close()
}


function ReportFilters({ filters, onChange, onApply, loading, supervisors }) {
  const { filterType, year, month, day, dateFrom, dateTo, supervisorId } = filters
  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Filter size={15} className="text-brand-blue" />
        <h3 className="font-cairo font-semibold text-white text-sm">فلترة التقرير</h3>
      </div>

      {/* filter type */}
      <div className="flex flex-wrap gap-2">
        {[
          { id:'all', label:'الكل' },
          { id:'yearly', label:'سنوي' },
          { id:'monthly', label:'شهري' },
          { id:'day', label:'يوم محدد' },
          { id:'range', label:'نطاق تاريخ' },
        ].map(({ id, label }) => (
          <button key={id}
            onClick={() => onChange({ ...filters, filterType: id })}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
              filterType === id ? 'bg-brand-blue text-white shadow-neon' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
            }`}>{label}</button>
        ))}
      </div>

      {/* Supervisor filter */}
      <div>
        <label className="text-white/40 text-xs mb-1 block">تصفية بمشرفة</label>
        <select value={supervisorId} onChange={e => onChange({ ...filters, supervisorId: e.target.value })} className="input-glass text-sm">
          <option value="">كل المشرفات</option>
          {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {(filterType === 'yearly' || filterType === 'monthly') && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/40 text-xs mb-1 block">السنة</label>
            <select value={year} onChange={e => onChange({ ...filters, year: e.target.value })} className="input-glass text-sm">
              <option value="">كل السنوات</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {filterType === 'monthly' && (
            <div>
              <label className="text-white/40 text-xs mb-1 block">الشهر</label>
              <select value={month} onChange={e => onChange({ ...filters, month: e.target.value })} className="input-glass text-sm">
                <option value="">كل الشهور</option>
                {MONTHS_AR.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {filterType === 'day' && (
        <div>
          <label className="text-white/40 text-xs mb-1 block">اختر يوماً</label>
          <input type="date" value={day} onChange={e => onChange({ ...filters, day: e.target.value })} className="input-glass text-sm" />
        </div>
      )}

      {filterType === 'range' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/40 text-xs mb-1 block">من تاريخ</label>
            <input type="date" value={dateFrom} onChange={e => onChange({ ...filters, dateFrom: e.target.value })} className="input-glass text-sm" />
          </div>
          <div>
            <label className="text-white/40 text-xs mb-1 block">إلى تاريخ</label>
            <input type="date" value={dateTo} onChange={e => onChange({ ...filters, dateTo: e.target.value })} className="input-glass text-sm" />
          </div>
        </div>
      )}

      <button onClick={onApply} disabled={loading} className="btn-primary w-full justify-center">
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
        {loading ? 'جاري التحميل...' : 'تطبيق الفلتر'}
      </button>
    </div>
  )
}

/* ─ ReportTable ─────────────────────────────────────────────────── */
function ReportTable({ students, loading, summary }) {
  if (loading) return (
    <div className="py-16 text-center">
      <Loader2 size={28} className="animate-spin text-brand-blue mx-auto mb-3" />
      <p className="text-white/40 text-sm">جاري تحميل التقرير...</p>
    </div>
  )
  if (!students.length) return (
    <div className="py-16 text-center">
      <FileText size={40} className="mx-auto mb-3 text-white/15" />
      <p className="text-white/40">لا توجد بيانات للفترة المحددة.</p>
    </div>
  )
  return (
    <>
      {/* Summary chips */}
      {summary?.length > 0 && (
        <div className="px-5 py-3 border-b border-white/05 flex flex-wrap gap-2">
          {summary.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 text-xs text-white/70">
              <UserCheck size={11} className="text-brand-blue" />
              {s.name}
              <span className="text-brand-blue font-bold">{s.count}</span>
            </span>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/08">
              {['#','اسم الطالب','الهاتف','المشرفة','الفصل','النظام','تاريخ التسجيل'].map(h => (
                <th key={h} className="text-right text-white/40 font-medium py-3 px-4 text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/05">
            {students.map((s, i) => (
              <tr key={i} className="hover:bg-white/3 transition-colors">
                <td className="py-3 px-4 text-white/30 text-xs">{i + 1}</td>
                <td className="py-3 px-4 text-white font-medium">{s.student_name}</td>
                <td className="py-3 px-4 text-white/60 text-xs" dir="ltr">{s.phone}</td>
                <td className="py-3 px-4">
                  <span className="text-brand-blue text-xs">{s.supervisor_name}</span>
                </td>
                <td className="py-3 px-4">
                  <div className="text-white/70 text-xs">{s.enrolled_grade}</div>
                  {s.enrolled_grade_level && s.enrolled_grade_level !== '—' && (
                    <div className="text-white/35 text-xs">{s.enrolled_grade_level}</div>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${
                    s.system_type === 'أونلاين' ? 'bg-brand-blue/15 text-brand-blue' : 'bg-brand-red/15 text-brand-red'
                  }`}>{s.system_type}</span>
                </td>
                <td className="py-3 px-4 text-white/40 text-xs" dir="ltr">{s.registered_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ─ Main Page ───────────────────────────────────────────────────── */
export default function SupervisorsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('list')   // 'list' | 'reports'

  /* ── List state ── */
  const [supervisors, setSupervisors] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search,  setSearch]    = useState('')
  const [modal,   setModal]     = useState(null)
  const [page,    setPage]      = useState(1)
  const [total,   setTotal]     = useState(0)
  const pageSize = 10

  /* ── Report state ── */
  const [reportData,    setReportData]    = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportFilters, setReportFilters] = useState({
    filterType: 'all', year: String(CY), month: '', day: '', dateFrom: '', dateTo: '', supervisorId: '',
  })
  const [reportPage,     setReportPage]     = useState(1)
  const [reportPageSize, setReportPageSize] = useState(20)
  const [reportMeta,     setReportMeta]     = useState({ total: 0, total_pages: 1 })

  /* ── Load supervisors list ── */
  const load = useCallback(() => {
    setLoading(true)
    api.get('/supervisors/', { params: { page, search } })
      .then(({ data }) => {
        setSupervisors(data.results || data)
        setTotal(data.count || (data.results ? data.count : data.length))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => { load() }, [load])

  const destroy = async id => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المشرفة؟')) return
    await api.delete(`/supervisors/${id}/`)
    load()
  }

  /* ── Build report query params ── */
  const buildParams = (f, pg = reportPage, ps = reportPageSize) => {
    const p = { page: pg, page_size: ps }
    if (f.filterType !== 'all') p.filter_type = f.filterType
    if (f.filterType === 'yearly' || f.filterType === 'monthly') {
      if (f.year)  p.year  = f.year
      if (f.month) p.month = f.month
    }
    if (f.filterType === 'day' && f.day)    p.day       = f.day
    if (f.filterType === 'range') {
      if (f.dateFrom) p.date_from = f.dateFrom
      if (f.dateTo)   p.date_to   = f.dateTo
    }
    if (f.supervisorId) p.supervisor = f.supervisorId
    return p
  }

  /* ── Load report ── */
  const loadReport = useCallback((f = reportFilters, pg = reportPage, ps = reportPageSize) => {
    setReportLoading(true)
    api.get('/supervisors/report/all/', { params: buildParams(f, pg, ps) })
      .then(({ data }) => {
        setReportData(data)
        setReportMeta({ total: data.total, total_pages: data.total_pages })
      })
      .catch(() => alert('تعذّر تحميل التقرير.'))
      .finally(() => setReportLoading(false))
  }, [reportFilters, reportPage, reportPageSize])

  /* auto-load report when tab switches to reports */
  useEffect(() => { if (tab === 'reports') loadReport(reportFilters, 1, reportPageSize) }, [tab])

  /* reload when page changes (without resetting to page 1) */
  useEffect(() => {
    if (tab === 'reports' && reportData !== null) loadReport(reportFilters, reportPage, reportPageSize)
  }, [reportPage])

  const totalPages = Math.ceil(total / pageSize)

  const filterLabel = () => {
    const f = reportFilters
    if (f.filterType === 'yearly')  return `السنة ${f.year || 'الكاملة'}`
    if (f.filterType === 'monthly') {
      const m = f.month ? MONTHS_AR[Number(f.month) - 1] : 'كل الشهور'
      return `${m} ${f.year || ''}`
    }
    if (f.filterType === 'day')   return f.day ? `يوم ${f.day}` : 'يوم محدد'
    if (f.filterType === 'range') return `${f.dateFrom || '—'} إلى ${f.dateTo || '—'}`
    return 'جميع الفترات'
  }

  const students = reportData?.students || []
  const summary  = reportData?.summary  || []

  /* ── Pagination bar component (inline) ── */
  const PaginationBar = () => {
    const { total, total_pages } = reportMeta
    if (total_pages <= 1) return null
    const start = (reportPage - 1) * reportPageSize + 1
    const end   = Math.min(reportPage * reportPageSize, total)
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-white/08">
        <p className="text-white/40 text-xs">
          عرض <span className="text-white">{start}–{end}</span> من <span className="text-brand-blue font-semibold">{total}</span> طالب
        </p>
        <div className="flex items-center gap-1">
          {/* First */}
          <button disabled={reportPage === 1} onClick={() => setReportPage(1)}
            className="btn-ghost p-1.5 disabled:opacity-30" title="الأولى">
            <ChevronsRight size={15} />
          </button>
          {/* Prev */}
          <button disabled={reportPage === 1} onClick={() => setReportPage(p => p - 1)}
            className="btn-ghost p-1.5 disabled:opacity-30" title="السابق">
            <ChevronRight size={15} />
          </button>
          {/* Page numbers */}
          {Array.from({ length: total_pages }, (_, i) => i + 1)
            .filter(n => n === 1 || n === total_pages || Math.abs(n - reportPage) <= 1)
            .reduce((acc, n, idx, arr) => {
              if (idx > 0 && arr[idx - 1] !== n - 1) acc.push('...')
              acc.push(n)
              return acc
            }, [])
            .map((n, i) =>
              n === '...' ? (
                <span key={i} className="text-white/30 text-xs px-1">…</span>
              ) : (
                <button key={i} onClick={() => setReportPage(n)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                    n === reportPage
                      ? 'bg-brand-blue text-white'
                      : 'text-white/50 hover:bg-white/10 hover:text-white'
                  }`}>
                  {n}
                </button>
              )
            )
          }
          {/* Next */}
          <button disabled={reportPage === total_pages} onClick={() => setReportPage(p => p + 1)}
            className="btn-ghost p-1.5 disabled:opacity-30" title="التالي">
            <ChevronLeft size={15} />
          </button>
          {/* Last */}
          <button disabled={reportPage === total_pages} onClick={() => setReportPage(total_pages)}
            className="btn-ghost p-1.5 disabled:opacity-30" title="الأخيرة">
            <ChevronsLeft size={15} />
          </button>
        </div>
        {/* Page size selector */}
        <select
          value={reportPageSize}
          onChange={e => { setReportPageSize(Number(e.target.value)); setReportPage(1) }}
          className="input-glass text-xs py-1.5 px-3 w-auto"
        >
          {[10, 20, 50, 100].map(n => (
            <option key={n} value={n}>{n} بالصفحة</option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
            <UserCheck size={20} className="text-brand-blue" /> إدارة المشرفات
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            إجمالي: <span className="text-brand-blue font-medium">{total}</span> مشرفة
          </p>
        </div>
        <button onClick={() => setModal({})} className="btn-primary">
          <Plus size={16} /> مشرفة جديدة
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit">
        {[
          { id: 'list',    icon: <Users size={14} />,    label: 'قائمة المشرفات' },
          { id: 'reports', icon: <BarChart2 size={14} />, label: 'التقارير الشاملة' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.id ? 'bg-brand-blue text-white shadow-neon' : 'text-white/50 hover:text-white'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: List ── */}
      {tab === 'list' && (
        <>
          {/* Search */}
          <div className="relative max-w-sm">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="ابحث بالاسم..." className="input-glass pr-10" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="glass-card overflow-hidden">
            {loading ? (
              <div className="p-12 text-center"><Loader2 size={28} className="animate-spin text-brand-blue mx-auto" /></div>
            ) : supervisors.length === 0 ? (
              <div className="p-12 text-center text-white/40">
                <UserCheck size={40} className="mx-auto mb-3 opacity-30" />
                <p>لا توجد مشرفات. أضف المشرفة الأولى!</p>
              </div>
            ) : (
              <div className="divide-y divide-white/05">
                {supervisors.map(s => (
                  <div key={s.id} className={`flex items-center gap-4 p-4 hover:bg-white/3 transition-colors ${!s.is_active ? 'opacity-50' : ''}`}>
                    <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
                      <UserCheck size={18} className="text-brand-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-cairo font-semibold text-white">{s.name}</h3>
                        {!s.is_active && <span className="badge badge-red text-xs">موقوفة</span>}
                        <span className="text-white/25 text-xs flex items-center gap-1">
                          <Users size={10} /> {s.student_count} طالب
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        {s.phone && <span className="text-white/40 text-xs flex items-center gap-1" dir="ltr"><Phone size={10} /> {s.phone}</span>}
                        {s.address && <span className="text-white/40 text-xs flex items-center gap-1"><MapPin size={10} /> {s.address}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => navigate(`/dashboard/supervisors/${s.id}`)}
                        title="عرض التفاصيل والتقارير"
                        className="btn-ghost p-2 text-white/40 hover:text-neon-cyan"
                      >
                        <ExternalLink size={15} />
                      </button>
                      <button onClick={() => setModal({ supervisor: s })} className="btn-ghost p-2 text-brand-blue" title="تعديل">
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => destroy(s.id)} className="btn-ghost p-2 text-brand-red/40 hover:text-brand-red" title="حذف">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
        </>
      )}

      {/* ── Tab: Reports ── */}
      {tab === 'reports' && (
        <div className="space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'إجمالي المشرفات', value: total, icon: <UserCheck size={18} className="text-brand-blue" />, color: 'text-brand-blue' },
              { label: 'إجمالي الطلاب في التقرير', value: reportLoading ? '...' : reportMeta.total, icon: <Users size={18} className="text-neon-cyan" />, color: 'text-neon-cyan' },
              { label: 'الفترة المحددة', value: filterLabel(), icon: <Calendar size={18} className="text-purple-400" />, color: 'text-purple-400', small: true },
              { label: 'المشرفات الفعّالة', value: supervisors.filter(s => s.is_active).length, icon: <TrendingUp size={18} className="text-green-400" />, color: 'text-green-400' },
            ].map((stat, i) => (
              <div key={i} className="glass-card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">{stat.icon}</div>
                  <div className="min-w-0">
                    <p className="text-white/40 text-xs">{stat.label}</p>
                    <p className={`font-bold mt-0.5 ${stat.color} ${stat.small ? 'text-sm' : 'text-lg'} truncate`}>{stat.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Filters + Table */}
          <div className="grid lg:grid-cols-[280px_1fr] gap-5 items-start">
            <ReportFilters
              filters={reportFilters}
              onChange={setReportFilters}
              onApply={() => { setReportPage(1); loadReport(reportFilters, 1, reportPageSize) }}
              loading={reportLoading}
              supervisors={supervisors}
            />

            <div className="glass-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/08">
                <div>
                  <p className="text-white font-semibold text-sm">{filterLabel()}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {reportLoading ? 'جاري التحميل...' : `${reportMeta.total} طالب • صفحة ${reportPage} من ${reportMeta.total_pages}`}
                  </p>
                </div>
                {!reportLoading && students.length > 0 && (
                  <button
                    onClick={() => printReport(students, summary, filterLabel())}
                    className="btn-ghost p-2 text-white/40 hover:text-white"
                    title="طباعة / PDF"
                  >
                    <Printer size={16} />
                  </button>
                )}
              </div>
              <ReportTable students={students} loading={reportLoading} summary={summary} />
              <PaginationBar />
            </div>
          </div>
        </div>
      )}

      {/* Print: handled by printReport() popup — no modal needed */}

      {/* Supervisor Modal */}
      {modal !== null && (
        <SupervisorModal supervisor={modal.supervisor} onClose={() => setModal(null)} onSaved={load} />
      )}
    </div>
  )
}
