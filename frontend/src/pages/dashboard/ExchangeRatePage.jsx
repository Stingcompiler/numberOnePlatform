/**
 * pages/dashboard/ExchangeRatePage.jsx
 * إدارة سعر الصرف (جنيه سوداني / ريال سعودي)
 */

import { useEffect, useState, useCallback } from 'react'
import {
  TrendingUp, Plus, X, Loader2, CheckCircle,
  RefreshCw, AlertTriangle, Calendar,
} from 'lucide-react'
import api from '../../api/axiosInstance'

export default function ExchangeRatePage() {
  const [rates,   setRates]   = useState([])
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ rate: '', is_active: true, note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/finance/exchange-rates/'),
      api.get('/finance/exchange-rates/current/').catch(() => ({ data: null })),
    ]).then(([rRes, cRes]) => {
      setRates(rRes.data.results || rRes.data)
      setCurrent(cRes.data)
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.rate || parseFloat(form.rate) <= 0) {
      setError('أدخل سعراً صحيحاً أكبر من صفر.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.post('/finance/exchange-rates/', form)
      setShowForm(false)
      setForm({ rate: '', is_active: true, note: '' })
      load()
    } catch (err) {
      const d = err.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'حدث خطأ.')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      {/* الرأس */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
            <TrendingUp size={20} className="text-brand-blue" /> سعر الصرف
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            جنيه سوداني مقابل الريال السعودي — يُحفَظ تاريخياً لكل دفعة
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'إلغاء' : 'تحديث السعر'}
        </button>
      </div>

      {/* السعر الحالي */}
      {loading ? (
        <div className="py-12 text-center">
          <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
        </div>
      ) : (
        <>
          <div className={`glass-card p-6 border ${current ? 'border-neon-cyan/20' : 'border-amber-400/20'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                current ? 'bg-neon-cyan/10' : 'bg-amber-400/10'
              }`}>
                {current
                  ? <CheckCircle size={26} className="text-neon-cyan" />
                  : <AlertTriangle size={26} className="text-amber-400" />
                }
              </div>
              <div>
                <p className="text-white/50 text-sm">
                  {current?.is_active ? 'السعر النشط حالياً' : <span className="text-amber-400">آخر سعر مُسجَّل (غير مُفعَّل)</span>}
                </p>
                {current ? (
                  <>
                    <p className="font-cairo font-black text-4xl text-neon-cyan mt-1">
                      {parseFloat(current.rate).toLocaleString()}
                    </p>
                    <p className="text-white/40 text-xs mt-1">
                      ج.س للريال السعودي الواحد
                      {current.notes && ` — ${current.notes}`}
                    </p>
                    <p className="text-white/25 text-xs mt-0.5 flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(current.created_at).toLocaleString('ar-SA')}
                    </p>
                  </>
                ) : (
                  <p className="text-amber-400 font-medium mt-1">لم يُحدَّد سعر صرف بعد</p>
                )}
              </div>
            </div>
          </div>

          {/* نموذج إضافة سعر جديد */}
          {showForm && (
            <div className="glass-card p-5 border border-brand-blue/20 animate-slide-up">
              <h3 className="font-cairo font-bold text-white mb-4 flex items-center gap-2">
                <RefreshCw size={16} className="text-brand-blue" />
                تحديث سعر الصرف
              </h3>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="text-white/50 text-xs mb-1 block">
                    السعر الجديد (جنيه سوداني / ريال سعودي) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.rate}
                    onChange={e => { setError(''); setForm(f => ({ ...f, rate: e.target.value })) }}
                    placeholder="مثال: 550"
                    className="input-glass text-lg"
                    required
                    dir="ltr"
                  />
                  {form.rate && parseFloat(form.rate) > 0 && (
                    <p className="text-neon-cyan text-xs mt-1">
                      1 ريال سعودي = {parseFloat(form.rate).toLocaleString()} جنيه سوداني
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1 block">ملاحظات (اختياري)</label>
                  <input
                    value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="مثال: تحديث شهر أبريل 2026"
                    className="input-glass"
                  />
                </div>

                <div className="glass-card p-3 border border-amber-400/20 bg-amber-400/05">
                  <p className="text-amber-400 text-xs flex items-center gap-2">
                    <AlertTriangle size={13} />
                    سيُصبح هذا السعر نشطاً فوراً ويُستخدم لجميع الدفعات الجديدة.
                    لن يؤثر على الدفعات السابقة.
                  </p>
                </div>

                {error && <p className="text-brand-red text-xs bg-brand-red/10 rounded-xl p-3">{error}</p>}

                <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    {saving ? 'جاري الحفظ...' : 'تحديث السعر'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary px-5">
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* سجل الأسعار */}
          <div>
            <h3 className="font-cairo font-semibold text-white/70 text-sm mb-3 flex items-center gap-2">
              <Calendar size={14} /> سجل أسعار الصرف
            </h3>
            {rates.length === 0 ? (
              <div className="glass-card p-8 text-center text-white/30">
                <TrendingUp size={32} className="mx-auto mb-3 opacity-20" />
                <p>لا يوجد سجل أسعار بعد</p>
              </div>
            ) : (
              <div className="glass-card overflow-hidden">
                <table className="table-glass">
                  <thead>
                    <tr>
                      <th>السعر (ج.س/ريال)</th>
                      <th>الحالة</th>
                      <th>ملاحظات</th>
                      <th>تاريخ الإضافة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map(r => (
                      <tr key={r.id}>
                        <td dir="ltr" className="text-left">
                          <span className={`font-cairo font-bold text-lg ${r.is_active ? 'text-neon-cyan' : 'text-white/60'}`}>
                            {parseFloat(r.rate).toLocaleString()}
                          </span>
                        </td>
                        <td>
                          {r.is_active
                            ? <span className="badge-green badge text-xs">نشط</span>
                            : <span className="text-white/25 text-xs">سابق</span>
                          }
                        </td>
                        <td className="text-white/40 text-sm">{r.notes || '—'}</td>
                        <td className="text-white/30 text-xs" dir="ltr">
                          {new Date(r.created_at).toLocaleDateString('ar-SA')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
