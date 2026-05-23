/**
 * pages/dashboard/ReportsPage.jsx
 * التقارير المالية: يومي / شهري / سنوي + ملخص شامل
 */

import { useEffect, useState } from 'react'
import {
  BarChart3, Calendar, TrendingUp, DollarSign,
  Loader2, ChevronDown, ArrowDown, ArrowUp,
  Receipt, Users, CheckCircle, Printer,
} from 'lucide-react'
import api from '../../api/axiosInstance'

/* ── بطاقة ملخص ─────────────────────────────────────────────── */
function SummaryCard({ label, value, sub, icon: Icon, color }) {
  const c = {
    blue: 'text-brand-blue bg-brand-blue/10 border-brand-blue/15',
    cyan: 'text-neon-cyan bg-neon-cyan/10 border-neon-cyan/15',
    red:  'text-brand-red  bg-brand-red/10  border-brand-red/15',
    amber:'text-amber-400  bg-amber-400/10  border-amber-400/15',
  }
  return (
    <div className={`glass-card p-5 flex items-center gap-4 bg-gradient-to-br ${c[color]} border`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${c[color]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-white/50 text-xs mb-0.5">{label}</p>
        <p className="font-cairo font-bold text-white text-lg leading-tight truncate">{value}</p>
        {sub && <p className="text-white/30 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

/* ── شريط مخطط بسيط (بدون مكتبة خارجية) ────────────────────── */
function SimpleBarChart({ data, valueKey, labelKey, color = '#4CC9F0' }) {
  if (!data?.length) return <p className="text-white/30 text-center py-8">لا توجد بيانات</p>
  const max = Math.max(...data.map(d => parseFloat(d[valueKey]) || 0))
  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
      {data.map((row, i) => {
        const val    = parseFloat(row[valueKey]) || 0
        const pct    = max > 0 ? (val / max) * 100 : 0
        const isLast = i === data.length - 1
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-white/40 text-xs w-24 shrink-0 text-left" dir="ltr">
              {row[labelKey]}
            </span>
            <div className="flex-1 bg-dark-700 rounded-full h-5 relative overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: color, opacity: isLast ? 1 : 0.75 }}
              />
              <span className="absolute inset-0 flex items-center pr-2 text-xs text-white/60">
                {Number(val).toLocaleString()}
              </span>
            </div>
            <span className="text-white/30 text-xs w-10 text-left">{row.count}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ── الصفحة الرئيسية ─────────────────────────────────────────── */
export default function ReportsPage() {
  const [tab,     setTab]     = useState('summary')
  const [summary, setSummary] = useState(null)
  const [daily,   setDaily]   = useState([])
  const [monthly, setMonthly] = useState([])
  const [annual,  setAnnual]  = useState([])
  const [loading, setLoading] = useState(false)

  const [year,    setYear]    = useState(new Date().getFullYear())
  const [from,    setFrom]    = useState('')
  const [to,      setTo]      = useState('')

  // إعادة تحميل عند تغيير التاب
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (tab === 'summary') {
          const { data } = await api.get('/finance/reports/summary/')
          setSummary(data)
        } else if (tab === 'daily') {
          const { data } = await api.get('/finance/reports/daily/', { params: { from, to } })
          setDaily(data.data || [])
        } else if (tab === 'monthly') {
          const { data } = await api.get('/finance/reports/monthly/', { params: { year } })
          setMonthly(data.data || [])
        } else if (tab === 'annual') {
          const { data } = await api.get('/finance/reports/annual/')
          setAnnual(data.data || [])
        }
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [tab, from, to, year])

  /* ── طباعة التقرير ──────────────────────────────────────────── */
  const printReport = () => {
    let title = ''
    let tableHTML = ''
    const now = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })

    if (tab === 'summary' && summary) {
      title = 'ملخص التقرير المالي الشامل'
      tableHTML = `
        <table>
          <thead><tr><th>البند</th><th>القيمة</th></tr></thead>
          <tbody>
            <tr><td>إجمالي المطلوب</td><td>${Number(summary.total_required_sdg).toLocaleString()} ج.س</td></tr>
            <tr><td>إجمالي المحصَّل (ج.س)</td><td>${Number(summary.total_paid_sdg).toLocaleString()} ج.س</td></tr>
            <tr><td>إجمالي المحصَّل (﷼)</td><td>${Number(summary.total_paid_sar).toLocaleString(undefined, { minimumFractionDigits: 2 })} ﷼</td></tr>
            <tr><td>الرصيد المتبقي</td><td>${Number(summary.total_balance_sdg).toLocaleString()} ج.س</td></tr>
            <tr><td>إجمالي الطلاب</td><td>${summary.students_count}</td></tr>
            <tr><td>طلاب مستوفو السداد</td><td>${summary.settled_count}</td></tr>
            <tr><td>طلاب لديهم رصيد</td><td>${summary.students_count - summary.settled_count}</td></tr>
          </tbody>
        </table>`
    } else if (tab === 'daily' && daily.length) {
      title = 'التقرير اليومي' + (from ? ' — من ' + from : '') + (to ? ' إلى ' + to : '')
      const totSDG = daily.reduce((s, r) => s + Number(r.total_sdg), 0)
      const totSAR = daily.reduce((s, r) => s + Number(r.total_sar), 0)
      const totCount = daily.reduce((s, r) => s + r.count, 0)
      tableHTML = `
        <table>
          <thead><tr><th>التاريخ</th><th>عدد الدفعات</th><th>المجموع (ج.س)</th><th>المجموع (﷼)</th></tr></thead>
          <tbody>
            ${daily.map(r => `<tr><td>${r.date}</td><td>${r.count}</td><td>${Number(r.total_sdg).toLocaleString()} ج.س</td><td>${Number(r.total_sar).toLocaleString()} ﷼</td></tr>`).join('')}
            <tr class="totals"><td>الإجمالي</td><td>${totCount}</td><td>${totSDG.toLocaleString()} ج.س</td><td>${totSAR.toLocaleString(undefined, { minimumFractionDigits: 2 })} ﷼</td></tr>
          </tbody>
        </table>`
    } else if (tab === 'monthly' && monthly.length) {
      title = 'التقرير الشهري — ' + year
      const totSDG = monthly.reduce((s, r) => s + Number(r.total_sdg), 0)
      const totSAR = monthly.reduce((s, r) => s + Number(r.total_sar), 0)
      const totCount = monthly.reduce((s, r) => s + r.count, 0)
      tableHTML = `
        <table>
          <thead><tr><th>الشهر</th><th>عدد الدفعات</th><th>المجموع (ج.س)</th><th>المجموع (﷼)</th></tr></thead>
          <tbody>
            ${monthly.map(r => `<tr><td>${r.month}</td><td>${r.count}</td><td>${Number(r.total_sdg).toLocaleString()} ج.س</td><td>${Number(r.total_sar).toLocaleString()} ﷼</td></tr>`).join('')}
            <tr class="totals"><td>الإجمالي</td><td>${totCount}</td><td>${totSDG.toLocaleString()} ج.س</td><td>${totSAR.toLocaleString(undefined, { minimumFractionDigits: 2 })} ﷼</td></tr>
          </tbody>
        </table>`
    } else if (tab === 'annual' && annual.length) {
      title = 'التقرير السنوي'
      const totSDG = annual.reduce((s, r) => s + Number(r.total_sdg), 0)
      const totSAR = annual.reduce((s, r) => s + Number(r.total_sar), 0)
      const totCount = annual.reduce((s, r) => s + r.count, 0)
      tableHTML = `
        <table>
          <thead><tr><th>السنة</th><th>عدد الدفعات</th><th>المجموع (ج.س)</th><th>المجموع (﷼)</th></tr></thead>
          <tbody>
            ${annual.map(r => `<tr><td>${r.year}</td><td>${r.count}</td><td>${Number(r.total_sdg).toLocaleString()} ج.س</td><td>${Number(r.total_sar).toLocaleString()} ﷼</td></tr>`).join('')}
            <tr class="totals"><td>الإجمالي</td><td>${totCount}</td><td>${totSDG.toLocaleString()} ج.س</td><td>${totSAR.toLocaleString(undefined, { minimumFractionDigits: 2 })} ﷼</td></tr>
          </tbody>
        </table>`
    } else {
      return
    }

    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Cairo', sans-serif; padding: 40px; color: #1a1a1a; direction: rtl; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
    .header h1 { font-size: 22px; margin-bottom: 4px; }
    .header h2 { font-size: 16px; color: #555; font-weight: 600; }
    .header p { font-size: 12px; color: #888; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ccc; padding: 10px 14px; text-align: right; font-size: 13px; }
    th { background: #f0f0f0; font-weight: 700; color: #333; }
    .totals td { font-weight: 700; background: #e8f4fd; border-top: 2px solid #333; }
    @page { size: auto; margin: 0; }
    @media print { body { padding: 30px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>مدارس ومعاهد نمبر ون</h1>
    <h2>${title}</h2>
    <p>تاريخ الطباعة: ${now}</p>
  </div>
  ${tableHTML}
</body>
</html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  const TABS = [
    { id: 'summary', label: 'ملخص شامل',  icon: BarChart3  },
    { id: 'daily',   label: 'يومي',        icon: Calendar   },
    { id: 'monthly', label: 'شهري',        icon: TrendingUp },
    { id: 'annual',  label: 'سنوي',        icon: Receipt    },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
          <BarChart3 size={20} className="text-brand-blue" /> التقارير المالية
        </h1>
        <button onClick={printReport} className="btn-secondary px-4 py-2 text-sm flex items-center gap-2">
          <Printer size={16} /> طباعة التقرير
        </button>
      </div>

      {/* التابات */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              tab === t.id
                ? 'bg-brand-blue/15 text-brand-blue border border-brand-blue/30'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}>
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-16">
          <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
        </div>
      )}

      {/* ─── الملخص الشامل ─────────────────────────────────────── */}
      {!loading && tab === 'summary' && summary && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <SummaryCard
              label="إجمالي المطلوب"
              value={`${Number(summary.total_required_sdg).toLocaleString()} ج.س`}
              icon={DollarSign} color="blue"
            />
            <SummaryCard
              label="إجمالي المحصَّل"
              value={`${Number(summary.total_paid_sdg).toLocaleString()} ج.س`}
              sub={`${Number(summary.total_paid_sar).toLocaleString()} ﷼`}
              icon={TrendingUp} color="cyan"
            />
            <SummaryCard
              label="الرصيد المتبقي"
              value={`${Number(summary.total_balance_sdg).toLocaleString()} ج.س`}
              icon={ArrowDown} color="amber"
            />
            <SummaryCard
              label="إجمالي الطلاب"
              value={summary.students_count}
              icon={Users} color="blue"
            />
            <SummaryCard
              label="طلاب مستوفو السداد"
              value={summary.settled_count}
              sub={`${summary.students_count > 0 ? Math.round(summary.settled_count / summary.students_count * 100) : 0}% من الإجمالي`}
              icon={CheckCircle} color="cyan"
            />
            <SummaryCard
              label="طلاب لديهم رصيد"
              value={summary.students_count - summary.settled_count}
              icon={ArrowUp} color="red"
            />
          </div>

          {/* بطاقة SAR */}
          <div className="glass-card p-6 bg-gradient-to-r from-brand-blue/10 to-transparent border-brand-blue/15">
            <p className="text-white/50 text-sm mb-1">إجمالي المحصَّل بالريال السعودي</p>
            <p className="font-cairo font-black text-4xl text-brand-blue glow-text-blue">
              {Number(summary.total_paid_sar).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ﷼
            </p>
            <p className="text-white/25 text-xs mt-2">
              محسوب بسعر الصرف المُعتمَد لحظة كل دفع — دقيق تاريخياً
            </p>
          </div>
        </div>
      )}

      {/* ─── التقرير اليومي ────────────────────────────────────── */}
      {!loading && tab === 'daily' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div>
              <label className="text-white/40 text-xs mb-1 block">من تاريخ</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-glass text-sm" />
            </div>
            <div>
              <label className="text-white/40 text-xs mb-1 block">إلى تاريخ</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-glass text-sm" />
            </div>
          </div>
          <div className="glass-card p-5">
            <h3 className="font-cairo font-semibold text-white/70 text-sm mb-4 flex items-center justify-between">
              <span>المحصَّل يومياً (ج.س)</span>
              <span className="text-white/30 text-xs">{daily.length} يوم</span>
            </h3>
            <SimpleBarChart data={daily} valueKey="total_sdg" labelKey="date" color="#4CC9F0" />
          </div>

          {/* جدول */}
          <div className="glass-card overflow-hidden">
            <table className="table-glass">
              <thead><tr><th>التاريخ</th><th>عدد الدفعات</th><th>المجموع (ج.س)</th><th>المجموع (﷼)</th></tr></thead>
              <tbody>
                {daily.map((r, i) => (
                  <tr key={i}>
                    <td dir="ltr" className="text-left">{r.date}</td>
                    <td><span className="badge-blue badge">{r.count}</span></td>
                    <td className="text-neon-cyan font-medium">{Number(r.total_sdg).toLocaleString()} ج.س</td>
                    <td className="text-brand-blue">{Number(r.total_sar).toLocaleString()} ﷼</td>
                  </tr>
                ))}
                {daily.length > 0 && (
                  <tr className="border-t-2 border-brand-blue/30">
                    <td className="font-bold text-white">الإجمالي</td>
                    <td><span className="badge-blue badge font-bold">{daily.reduce((s, r) => s + r.count, 0)}</span></td>
                    <td className="text-neon-cyan font-bold">{daily.reduce((s, r) => s + Number(r.total_sdg), 0).toLocaleString()} ج.س</td>
                    <td className="text-brand-blue font-bold">{daily.reduce((s, r) => s + Number(r.total_sar), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ﷼</td>
                  </tr>
                )}
                {!daily.length && (
                  <tr><td colSpan={4} className="text-center text-white/30 py-8">لا توجد بيانات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── التقرير الشهري ────────────────────────────────────── */}
      {!loading && tab === 'monthly' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-white/40 text-xs">السنة:</label>
            <select value={year} onChange={e => setYear(e.target.value)} className="input-glass w-28 text-sm">
              {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="glass-card p-5">
            <h3 className="font-cairo font-semibold text-white/70 text-sm mb-4">المحصَّل شهرياً — {year}</h3>
            <SimpleBarChart data={monthly} valueKey="total_sdg" labelKey="month" color="#00F5D4" />
          </div>
          <div className="glass-card overflow-hidden">
            <table className="table-glass">
              <thead><tr><th>الشهر</th><th>عدد الدفعات</th><th>المجموع (ج.س)</th><th>المجموع (﷼)</th></tr></thead>
              <tbody>
                {monthly.map((r, i) => (
                  <tr key={i}>
                    <td dir="ltr" className="text-left">{r.month}</td>
                    <td><span className="badge-blue badge">{r.count}</span></td>
                    <td className="text-neon-cyan font-medium">{Number(r.total_sdg).toLocaleString()} ج.س</td>
                    <td className="text-brand-blue">{Number(r.total_sar).toLocaleString()} ﷼</td>
                  </tr>
                ))}
                {monthly.length > 0 && (
                  <tr className="border-t-2 border-brand-blue/30">
                    <td className="font-bold text-white">الإجمالي</td>
                    <td><span className="badge-blue badge font-bold">{monthly.reduce((s, r) => s + r.count, 0)}</span></td>
                    <td className="text-neon-cyan font-bold">{monthly.reduce((s, r) => s + Number(r.total_sdg), 0).toLocaleString()} ج.س</td>
                    <td className="text-brand-blue font-bold">{monthly.reduce((s, r) => s + Number(r.total_sar), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ﷼</td>
                  </tr>
                )}
                {!monthly.length && (
                  <tr><td colSpan={4} className="text-center text-white/30 py-8">لا توجد بيانات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── التقرير السنوي ────────────────────────────────────── */}
      {!loading && tab === 'annual' && (
        <div className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-cairo font-semibold text-white/70 text-sm mb-4">المحصَّل السنوي</h3>
            <SimpleBarChart data={annual} valueKey="total_sdg" labelKey="year" color="#E63946" />
          </div>
          <div className="glass-card overflow-hidden">
            <table className="table-glass">
              <thead><tr><th>السنة</th><th>عدد الدفعات</th><th>المجموع (ج.س)</th><th>المجموع (﷼)</th></tr></thead>
              <tbody>
                {annual.map((r, i) => (
                  <tr key={i}>
                    <td dir="ltr" className="text-left">{r.year}</td>
                    <td><span className="badge-blue badge">{r.count}</span></td>
                    <td className="text-neon-cyan font-medium">{Number(r.total_sdg).toLocaleString()} ج.س</td>
                    <td className="text-brand-blue">{Number(r.total_sar).toLocaleString()} ﷼</td>
                  </tr>
                ))}
                {annual.length > 0 && (
                  <tr className="border-t-2 border-brand-blue/30">
                    <td className="font-bold text-white">الإجمالي</td>
                    <td><span className="badge-blue badge font-bold">{annual.reduce((s, r) => s + r.count, 0)}</span></td>
                    <td className="text-neon-cyan font-bold">{annual.reduce((s, r) => s + Number(r.total_sdg), 0).toLocaleString()} ج.س</td>
                    <td className="text-brand-blue font-bold">{annual.reduce((s, r) => s + Number(r.total_sar), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ﷼</td>
                  </tr>
                )}
                {!annual.length && (
                  <tr><td colSpan={4} className="text-center text-white/30 py-8">لا توجد بيانات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
