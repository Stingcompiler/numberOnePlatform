/**
 * pages/dashboard/SupervisorDetailPage.jsx
 * صفحة تفاصيل المشرفة + تقارير الطلاب (شهري / سنوي / يوم / نطاق)
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  UserCheck, ArrowRight, Printer, FileText, Loader2,
  Calendar, Filter, TrendingUp, Users,
  Phone, MapPin, BarChart2, Search,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react'
import api from '../../api/axiosInstance'

/* ── helper ─────────────────────────────────────────────────────── */
const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]
const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - i)

/* ── ReportFilters component ─────────────────────────────────────── */
function ReportFilters({ filters, onChange, onApply, loading }) {
  const { filterType, year, month, day, dateFrom, dateTo } = filters

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Filter size={16} className="text-brand-blue" />
        <h3 className="font-cairo font-semibold text-white text-sm">فلترة التقرير</h3>
      </div>

      {/* Filter type tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'الكل' },
          { id: 'yearly', label: 'سنوي' },
          { id: 'monthly', label: 'شهري' },
          { id: 'day', label: 'يوم محدد' },
          { id: 'range', label: 'نطاق تاريخ' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onChange({ ...filters, filterType: id })}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${filterType === id
              ? 'bg-brand-blue text-white shadow-neon'
              : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Conditional filter fields */}
      {(filterType === 'yearly' || filterType === 'monthly') && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/40 text-xs mb-1 block">السنة</label>
            <select
              value={year}
              onChange={e => onChange({ ...filters, year: e.target.value })}
              className="input-glass text-sm"
            >
              <option value="">كل السنوات</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {filterType === 'monthly' && (
            <div>
              <label className="text-white/40 text-xs mb-1 block">الشهر</label>
              <select
                value={month}
                onChange={e => onChange({ ...filters, month: e.target.value })}
                className="input-glass text-sm"
              >
                <option value="">كل الشهور</option>
                {MONTHS_AR.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {filterType === 'day' && (
        <div>
          <label className="text-white/40 text-xs mb-1 block">اختر يوماً</label>
          <input
            type="date"
            value={day}
            onChange={e => onChange({ ...filters, day: e.target.value })}
            className="input-glass text-sm"
          />
        </div>
      )}

      {filterType === 'range' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/40 text-xs mb-1 block">من تاريخ</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
              className="input-glass text-sm"
            />
          </div>
          <div>
            <label className="text-white/40 text-xs mb-1 block">إلى تاريخ</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => onChange({ ...filters, dateTo: e.target.value })}
              className="input-glass text-sm"
            />
          </div>
        </div>
      )}

      <button
        onClick={onApply}
        disabled={loading}
        className="btn-primary w-full justify-center"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
        {loading ? 'جاري التحميل...' : 'تطبيق الفلتر'}
      </button>
    </div>
  )
}

/* ── ReportTable component ───────────────────────────────────────── */
function ReportTable({ students, loading, offset = 0 }) {
  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 size={30} className="animate-spin text-brand-blue mx-auto mb-3" />
        <p className="text-white/40 text-sm">جاري تحميل التقرير...</p>
      </div>
    )
  }

  if (!students.length) {
    return (
      <div className="py-16 text-center">
        <FileText size={40} className="mx-auto mb-3 text-white/15" />
        <p className="text-white/40">لا توجد بيانات للفترة المحددة.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/08">
            <th className="text-right text-white/40 font-medium py-3 px-4 text-xs">#</th>
            <th className="text-right text-white/40 font-medium py-3 px-4 text-xs">اسم الطالب</th>
            <th className="text-right text-white/40 font-medium py-3 px-4 text-xs">رقم الهاتف</th>
            <th className="text-right text-white/40 font-medium py-3 px-4 text-xs">الفصل / المرحلة</th>
            <th className="text-right text-white/40 font-medium py-3 px-4 text-xs">النظام</th>
            <th className="text-right text-white/40 font-medium py-3 px-4 text-xs">تاريخ التسجيل</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/05">
          {students.map((s, i) => (
            <tr key={i} className="hover:bg-white/3 transition-colors group">
              <td className="py-3 px-4 text-white/30 text-xs">{offset + i + 1}</td>
              <td className="py-3 px-4">
                <span className="text-white font-medium">{s.student_name}</span>
              </td>
              <td className="py-3 px-4" dir="ltr">
                <span className="text-white/60 text-xs">{s.phone}</span>
              </td>
              <td className="py-3 px-4">
                <div className="text-white/70 text-xs">{s.enrolled_grade}</div>
                {s.enrolled_grade_level && s.enrolled_grade_level !== '—' && (
                  <div className="text-white/35 text-xs mt-0.5">{s.enrolled_grade_level}</div>
                )}
              </td>
              <td className="py-3 px-4">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${s.system_type === 'أونلاين'
                  ? 'bg-brand-blue/15 text-brand-blue'
                  : 'bg-brand-red/15 text-brand-red'
                  }`}>
                  {s.system_type}
                </span>
              </td>
              <td className="py-3 px-4 text-white/40 text-xs" dir="ltr">
                {s.registered_at}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── TD: shared inline-style string for table cells ─────────────── */
const TD = 'border:1px solid #bbb;padding:6px 10px;text-align:right;vertical-align:middle;color:#111;font-weight:500;'

/* ── openPrintWindow: spawns a clean, self-contained print window ── */
function openPrintWindow(supervisor, students, filterLabel) {
  const today = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })

  const rows = students.map((s, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f2f2f2'}">
      <td style="${TD}color:#555;font-weight:700;text-align:center">${i + 1}</td>
      <td style="${TD}font-weight:700;color:#000">${s.student_name || '—'}</td>
      <td style="${TD}direction:ltr;text-align:left;font-weight:600;color:#222">${s.phone || '—'}</td>
      <td style="${TD}font-weight:600">${s.enrolled_grade || '—'}</td>
      <td style="${TD}color:#444;font-weight:600">${s.enrolled_grade_level || '—'}</td>
      <td style="${TD}">
        <span style="padding:2px 8px;border-radius:4px;border:1.5px solid #666;font-size:9.5pt;font-weight:700;color:#111;display:inline-block">${s.system_type || '—'}</span>
      </td>
      <td style="${TD}direction:ltr;text-align:left;color:#333;font-weight:600">${s.registered_at || '—'}</td>
    </tr>`).join('')

  const noRows = students.length === 0
    ? `<tr><td colspan="7" style="text-align:center;padding:24px;color:#aaa">لا يوجد طلاب</td></tr>`
    : ''

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <title>تقرير المشرفة — ${supervisor?.name || ''}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    /* Suppress browser URL/date header+footer */
    @page {
      size: A4;
      margin: 14mm 12mm 14mm 12mm;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', Tahoma, Arial, sans-serif;
      font-size: 11pt;
      font-weight: 500;
      line-height: 1.55;
      color: #111;
      background: #fff;
      direction: rtl;
    }
    .report-header {
      text-align: center;
      border-bottom: 2.5px solid #1a5fa8;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .report-header h1 {
      font-size: 22pt;
      font-weight: 800;
      color: #000;
      letter-spacing: -0.5px;
    }
    .report-header .subtitle {
      font-size: 12pt;
      color: #222;
      margin-top: 6px;
      font-weight: 700;
    }
    .report-header .date {
      font-size: 9.5pt;
      font-weight: 500;
      color: #555;
      margin-top: 3px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 16px;
      background: #eef3fa;
      border: 1px solid #b8cde0;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 20px;
      font-size: 10.5pt;
    }
    .info-grid .label { color: #444; font-weight: 600; }
    .info-grid .value { font-weight: 800; color: #000; }
    .info-grid .value.blue { color: #1a4fa0; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5pt;
    }
    thead tr {
      background: #1a2e4a;
      color: #fff;
    }
    thead th {
      padding: 8px 10px;
      text-align: right;
      font-weight: 800;
      font-size: 10.5pt;
      border: 1px solid #1a2e4a;
    }
    tbody td {
      padding: 7px 10px;
      border: 1px solid #bbb;
      text-align: right;
      vertical-align: middle;
      color: #111;
      font-weight: 500;
    }
    tbody tr:nth-child(even) td { background: #f2f2f2; }
    tbody tr:nth-child(odd)  td { background: #fff; }
    .badge {
      padding: 2px 8px;
      border-radius: 4px;
      border: 1.5px solid #666;
      font-size: 9.5pt;
      font-weight: 700;
      display: inline-block;
      color: #111;
    }
    .report-footer {
      margin-top: 22px;
      padding-top: 10px;
      border-top: 1px solid #bbb;
      font-size: 8.5pt;
      font-weight: 600;
      color: #555;
      text-align: center;
    }
    /* Repeat header on each printed page */
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
  </style>
</head>
<body>

  <div class="report-header">
    <h1>مدارس ومعاهد نمبر ون</h1>
    <p class="subtitle">تقرير طلاب المشرفة — ${filterLabel}</p>
    <p class="date">${today}</p>
  </div>

  <div class="info-grid">
    <div><span class="label">المشرفة: </span><span class="value">${supervisor?.name || '—'}</span></div>
    <div><span class="label">الهاتف: </span><span class="value" dir="ltr">${supervisor?.phone || '—'}</span></div>
    <div><span class="label">العنوان: </span><span class="value">${supervisor?.address || '—'}</span></div>
    <div><span class="label">إجمالي الطلاب: </span><span class="value blue">${students.length}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:38px">#</th>
        <th>اسم الطالب</th>
        <th style="width:130px;direction:ltr;text-align:left">الهاتف</th>
        <th>الفصل</th>
        <th>المرحلة</th>
        <th style="width:80px">النظام</th>
        <th style="width:110px;direction:ltr;text-align:left">تاريخ التسجيل</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      ${noRows}
    </tbody>
  </table>

  <div class="report-footer">
    نظام مدارس ومعاهد نمبر ون &mdash; تقرير مولَّد بتاريخ ${today} &mdash; عدد السجلات: ${students.length}
  </div>

  <script>
    // Wait for Google Font then print
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); window.close(); }, 600);
    });
  <\/script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { alert('يرجى السماح بالنوافذ المنبثقة لهذا الموقع لطباعة التقرير.'); return }
  win.document.open()
  win.document.write(html)
  win.document.close()
}



/* ── Main Page ────────────────────────────────────────────────────── */
export default function SupervisorDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [supervisor, setSupervisor] = useState(null)
  const [svLoading, setSvLoading] = useState(true)

  const [reportData, setReportData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [printLoading, setPrintLoading] = useState(false)
  const [repPage, setRepPage] = useState(1)
  const [repPageSize, setRepPageSize] = useState(20)
  const [repMeta, setRepMeta] = useState({ total: 0, total_pages: 1 })

  const [filters, setFilters] = useState({
    filterType: 'all',
    year: String(currentYear),
    month: '',
    day: '',
    dateFrom: '',
    dateTo: '',
  })

  /* Load supervisor details */
  useEffect(() => {
    setSvLoading(true)
    api.get(`/supervisors/${id}/`)
      .then(({ data }) => setSupervisor(data))
      .catch(() => navigate('/np-panel/supervisors', { replace: true }))
      .finally(() => setSvLoading(false))
  }, [id])

  /* Build query params from filters */
  const buildParams = (f, pg = repPage, ps = repPageSize) => {
    const p = { page: pg, page_size: ps }
    if (f.filterType !== 'all') p.filter_type = f.filterType
    if (f.filterType === 'yearly' || f.filterType === 'monthly') {
      if (f.year) p.year = f.year
      if (f.month) p.month = f.month
    }
    if (f.filterType === 'day' && f.day) p.day = f.day
    if (f.filterType === 'range') {
      if (f.dateFrom) p.date_from = f.dateFrom
      if (f.dateTo) p.date_to = f.dateTo
    }
    return p
  }

  /* Load report */
  const loadReport = useCallback((f = filters, pg = repPage, ps = repPageSize) => {
    setReportLoading(true)
    api.get(`/supervisors/${id}/report/`, { params: buildParams(f, pg, ps) })
      .then(({ data }) => {
        setReportData(data)
        setRepMeta({ total: data.total, total_pages: data.total_pages })
      })
      .catch(() => alert('تعذّر تحميل التقرير.'))
      .finally(() => setReportLoading(false))
  }, [id, filters, repPage, repPageSize])

  /* Initial report load */
  useEffect(() => { if (id) loadReport(filters, 1, repPageSize) }, [id])

  /* Reload when page changes */
  useEffect(() => {
    if (reportData !== null) loadReport(filters, repPage, repPageSize)
  }, [repPage])

  /* Filter label for display */
  const filterLabel = () => {
    if (filters.filterType === 'yearly') return `السنة ${filters.year || 'الكاملة'}`
    if (filters.filterType === 'monthly') {
      const m = filters.month ? MONTHS_AR[Number(filters.month) - 1] : 'كل الشهور'
      return `${m} ${filters.year || ''}`
    }
    if (filters.filterType === 'day') return filters.day ? `يوم ${filters.day}` : 'يوم محدد'
    if (filters.filterType === 'range') {
      return `${filters.dateFrom || '—'} إلى ${filters.dateTo || '—'}`
    }
    return 'جميع الفترات'
  }

  /* Fetch ALL students (no pagination) then open dedicated print window */
  const fetchAllForPrint = () => {
    setPrintLoading(true)
    const params = buildParams(filters, 1, 10000)
    params.page_size = 10000
    params.page = 1
    api.get(`/supervisors/${id}/report/`, { params })
      .then(({ data }) => {
        openPrintWindow(supervisor, data.students || [], filterLabel())
      })
      .catch(() => alert('تعذّر تحميل بيانات الطباعة.'))
      .finally(() => setPrintLoading(false))
  }

  if (svLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-64">
        <Loader2 size={30} className="animate-spin text-brand-blue" />
      </div>
    )
  }

  const students = reportData?.students || []

  /* ── Pagination bar ── */
  const PaginationBar = () => {
    const { total, total_pages } = repMeta
    if (total_pages <= 1) return null
    const _offset = (repPage - 1) * repPageSize
    const start = _offset + 1
    const end = Math.min(repPage * repPageSize, total)
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-white/08">
        <p className="text-white/40 text-xs">
          عرض <span className="text-white">{start}–{end}</span> من <span className="text-brand-blue font-semibold">{total}</span> طالب
        </p>
        <div className="flex items-center gap-1">
          <button disabled={repPage === 1} onClick={() => setRepPage(1)}
            className="btn-ghost p-1.5 disabled:opacity-30" title="الأولى"><ChevronsRight size={15} /></button>
          <button disabled={repPage === 1} onClick={() => setRepPage(p => p - 1)}
            className="btn-ghost p-1.5 disabled:opacity-30" title="السابق"><ChevronRight size={15} /></button>
          {Array.from({ length: total_pages }, (_, i) => i + 1)
            .filter(n => n === 1 || n === total_pages || Math.abs(n - repPage) <= 1)
            .reduce((acc, n, idx, arr) => {
              if (idx > 0 && arr[idx - 1] !== n - 1) acc.push('...')
              acc.push(n); return acc
            }, [])
            .map((n, i) => n === '...' ? (
              <span key={i} className="text-white/30 text-xs px-1">…</span>
            ) : (
              <button key={i} onClick={() => setRepPage(n)}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${n === repPage ? 'bg-brand-blue text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'
                  }`}>{n}</button>
            ))
          }
          <button disabled={repPage === total_pages} onClick={() => setRepPage(p => p + 1)}
            className="btn-ghost p-1.5 disabled:opacity-30" title="التالي"><ChevronLeft size={15} /></button>
          <button disabled={repPage === total_pages} onClick={() => setRepPage(total_pages)}
            className="btn-ghost p-1.5 disabled:opacity-30" title="الأخيرة"><ChevronsLeft size={15} /></button>
        </div>
        <select value={repPageSize}
          onChange={e => { setRepPageSize(Number(e.target.value)); setRepPage(1) }}
          className="input-glass text-xs py-1.5 px-3 w-auto">
          {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} بالصفحة</option>)}
        </select>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Back + Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/np-panel/supervisors')}
            className="btn-ghost p-2 text-white/50 hover:text-white"
            title="العودة"
          >
            <ArrowRight size={18} />
          </button>
          <div>
            <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
              <UserCheck size={20} className="text-brand-blue" />
              {supervisor?.name}
            </h1>
            <p className="text-white/40 text-sm mt-0.5">
              ملف وتقارير المشرفة
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchAllForPrint}
            disabled={!reportData || reportLoading || printLoading}
            className="btn-secondary flex items-center gap-2"
          >
            {printLoading ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
            {printLoading ? 'جاري التحضير...' : 'طباعة التقرير'}
          </button>
        </div>
      </div>

      {/* Supervisor Info Card */}
      <div className="glass-card p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Phone size={14} className="text-brand-blue shrink-0" />
            <div>
              <div className="text-white/40 text-xs">الهاتف</div>
              <div className="text-white" dir="ltr">{supervisor?.phone || '—'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-brand-blue shrink-0" />
            <div>
              <div className="text-white/40 text-xs">العنوان</div>
              <div className="text-white">{supervisor?.address || '—'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users size={14} className="text-neon-cyan shrink-0" />
            <div>
              <div className="text-white/40 text-xs">إجمالي الطلاب</div>
              <div className="text-neon-cyan font-bold text-lg">{supervisor?.student_count ?? '—'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BarChart2 size={14} className="text-brand-blue shrink-0" />
            <div>
              <div className="text-white/40 text-xs">نتائج التقرير</div>
              <div className="text-white font-bold text-lg">{reportLoading ? '...' : repMeta.total}</div>
            </div>
          </div>
        </div>
        {supervisor?.notes && (
          <div className="mt-4 pt-4 border-t border-white/05 text-white/50 text-sm">
            {supervisor.notes}
          </div>
        )}
      </div>

      {/* Report Section */}
      <div>
        <h2 className="font-cairo font-bold text-white text-base flex items-center gap-2 mb-4">
          <FileText size={16} className="text-brand-blue" />
          تقارير الطلاب
        </h2>

        <div className="grid lg:grid-cols-[280px_1fr] gap-5 items-start">

          {/* Filters */}
          <ReportFilters
            filters={filters}
            onChange={setFilters}
            onApply={() => { setRepPage(1); loadReport(filters, 1, repPageSize) }}
            loading={reportLoading}
          />

          {/* Table */}
          <div className="glass-card overflow-hidden">
            {/* Table header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/08">
              <div>
                <p className="text-white font-semibold text-sm">{filterLabel()}</p>
                <p className="text-white/40 text-xs mt-0.5">
                  {reportLoading ? 'جاري التحميل...' : `${repMeta.total} طالب • صفحة ${repPage} من ${repMeta.total_pages}`}
                </p>
              </div>
              {!reportLoading && students.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-white/40">
                  <TrendingUp size={12} className="text-neon-cyan" />
                  <span className="text-neon-cyan font-medium">{students.length}</span> سجل
                </div>
              )}
            </div>

            <ReportTable students={students} loading={reportLoading} offset={(repPage - 1) * repPageSize} />
            <PaginationBar />
          </div>
        </div>
      </div>


    </div>
  )
}
