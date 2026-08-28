/**
 * pages/dashboard/BackupPage.jsx
 * النسخ الاحتياطي والاستعادة — واجهة إدارية كاملة
 */

import { useEffect, useState, useCallback } from 'react'
import {
  HardDrive, Plus, Download, RotateCcw, Trash2, Settings2,
  Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronUp,
  Database, FolderArchive, Clock, Shield, Save, History,
  FileArchive, AlertTriangle, X,
} from 'lucide-react'
import api from '../../api/axiosInstance'

/* ── التبويبات ────────────────────────────────────────────────── */
const TABS = [
  { id: 'backups',  label: 'النسخ الاحتياطية', icon: HardDrive },
  { id: 'settings', label: 'النسخ التلقائي',   icon: Settings2 },
  { id: 'logs',     label: 'سجل الاستعادة',    icon: History },
]

const TYPE_LABELS = {
  full: 'كامل',
  db_only: 'قاعدة بيانات',
  media_only: 'ملفات فقط',
}
const TYPE_COLORS = {
  full: 'badge-blue',
  db_only: 'badge-green',
  media_only: 'badge-red',
}

/* ── Toast Component ──────────────────────────────────────────── */
function Toast({ type, message, onClose }) {
  if (!message) return null
  const isSuccess = type === 'success'
  return (
    <div className={`flex items-center gap-2 text-sm rounded-xl p-3 border animate-fade-in ${
      isSuccess
        ? 'text-neon-cyan bg-neon-cyan/10 border-neon-cyan/20'
        : 'text-brand-red bg-brand-red/10 border-brand-red/20'
    }`}>
      {isSuccess ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}

/* ── Progress Bar ─────────────────────────────────────────────── */
function ProgressBar({ active, label }) {
  if (!active) return null
  return (
    <div className="glass-card p-4 space-y-2 animate-fade-in">
      <div className="flex items-center gap-2 text-sm text-white/70">
        <Loader2 size={16} className="animate-spin text-brand-blue" />
        <span>{label}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-blue to-neon-cyan animate-progress" />
      </div>
      <style>{`
        @keyframes progress-anim {
          0% { width: 5%; }
          50% { width: 70%; }
          90% { width: 92%; }
          100% { width: 98%; }
        }
        .animate-progress { animation: progress-anim 8s ease-out forwards; }
      `}</style>
    </div>
  )
}

/* ── Confirm Modal ────────────────────────────────────────────── */
function ConfirmModal({ open, title, message, onConfirm, onCancel, loading }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-dark-900/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 glass-card-strong p-6 max-w-md w-full space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-red/15 flex items-center justify-center">
            <AlertTriangle size={20} className="text-brand-red" />
          </div>
          <h3 className="text-white font-cairo font-bold text-lg">{title}</h3>
        </div>
        <p className="text-white/60 text-sm leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading} className="btn-ghost px-5 py-2.5 border border-white/10 rounded-xl">إلغاء</button>
          <button onClick={onConfirm} disabled={loading} className="btn-primary px-5 py-2.5">
            {loading ? <><Loader2 size={16} className="animate-spin" /> جاري التنفيذ...</> : 'تأكيد الاستعادة'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   الصفحة الرئيسية
   ══════════════════════════════════════════════════════════════════ */
export default function BackupPage() {
  const [tab, setTab] = useState('backups')
  const [toast, setToast] = useState({ type: '', message: '' })

  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast({ type: '', message: '' }), 5000)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* الرأس */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-blue/20 to-neon-cyan/20 flex items-center justify-center border border-brand-blue/20">
          <HardDrive size={20} className="text-brand-blue" />
        </div>
        <div>
          <h1 className="font-cairo font-bold text-white text-xl">النسخ الاحتياطي والاستعادة</h1>
          <p className="text-white/40 text-xs">إنشاء وإدارة النسخ الاحتياطية للنظام</p>
        </div>
      </div>

      {/* Toast */}
      <Toast {...toast} onClose={() => setToast({ type: '', message: '' })} />

      {/* التبويبات */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all ${
              tab === t.id
                ? 'bg-brand-blue/15 text-brand-blue border border-brand-blue/25'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* المحتوى */}
      {tab === 'backups'  && <BackupsTab showToast={showToast} />}
      {tab === 'settings' && <SettingsTab showToast={showToast} />}
      {tab === 'logs'     && <LogsTab />}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   تبويب النسخ الاحتياطية
   ══════════════════════════════════════════════════════════════════ */
function BackupsTab({ showToast }) {
  const [backups, setBackups]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [creating, setCreating]   = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [newType, setNewType]     = useState('full')
  const [newNotes, setNewNotes]   = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [confirmRestore, setConfirmRestore] = useState(null)
  const [deleteConfirm, setDeleteConfirm]   = useState(null)
  const [downloadingId, setDownloadingId]   = useState(null)

  // النسخ والاستعادة والتنزيل عمليات دقائق لا ثوانٍ، ومهلة axios
  // الافتراضية (١٥ ثانية) مضبوطة لنداءات الواجهة العادية. كانت النسخة
  // تكتمل على الخادم بينما يستسلم المتصفح ويعرض "فشل".
  const LONG_OP = { timeout: 15 * 60 * 1000 }

  // رسالة الخادم إن وُجدت؛ ومهلة العميل ليست فشلاً — العملية قد تكون
  // ما زالت جارية، فادّعاء الفشل يدفع المستخدم لإعادتها بلا داعٍ.
  const failureText = (e, fallback) => {
    if (e?.code === 'ECONNABORTED' || /timeout/i.test(e?.message || '')) return null
    return e?.response?.data?.detail || fallback
  }

  const fetchBackups = useCallback(async () => {
    try {
      const { data } = await api.get('/backups/')
      setBackups(Array.isArray(data) ? data : data.results || [])
    } catch { showToast('error', 'فشل تحميل النسخ الاحتياطية.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchBackups() }, [fetchBackups])

  const handleCreate = async () => {
    setCreating(true)
    try {
      await api.post(
        '/backups/create/', { backup_type: newType, notes: newNotes }, LONG_OP,
      )
      showToast('success', 'تم إنشاء النسخة الاحتياطية بنجاح!')
      setShowForm(false); setNewNotes('')
      fetchBackups()
    } catch (e) {
      const msg = failureText(e, 'فشل إنشاء النسخة الاحتياطية.')
      showToast(
        msg ? 'error' : 'success',
        msg || 'النسخة قيد الإنشاء على الخادم — حدّث القائمة بعد قليل.',
      )
      setShowForm(false)
      fetchBackups()
    }
    finally { setCreating(false) }
  }

  const handleDownload = async (b) => {
    setDownloadingId(b.id)
    try {
      const res = await api.get(
        `/backups/${b.id}/download/`, { responseType: 'blob', ...LONG_OP },
      )
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = b.filename
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      showToast('error', failureText(e, 'فشل تحميل الملف.') || 'انقطع التحميل — أعد المحاولة.')
    }
    finally { setDownloadingId(null) }
  }

  const handleRestore = async () => {
    if (!confirmRestore) return
    setRestoring(true)
    try {
      const { data } = await api.post(
        `/backups/${confirmRestore.id}/restore/`, { confirm: true }, LONG_OP,
      )
      showToast(data.status === 'success' ? 'success' : 'error',
        data.status === 'success' ? 'تمت الاستعادة بنجاح!' : 'فشلت عملية الاستعادة.')
    } catch { showToast('error', 'فشلت عملية الاستعادة.') }
    finally { setRestoring(false); setConfirmRestore(null) }
  }

  const handleDelete = async (b) => {
    try {
      await api.delete(`/backups/${b.id}/`)
      showToast('success', 'تم حذف النسخة بنجاح.')
      fetchBackups()
    } catch { showToast('error', 'فشل حذف النسخة.') }
    finally { setDeleteConfirm(null) }
  }

  return (
    <>
      <ProgressBar active={creating} label="جاري إنشاء النسخة الاحتياطية..." />
      <ProgressBar active={restoring} label="جاري استعادة النسخة الاحتياطية..." />

      <ConfirmModal
        open={!!confirmRestore}
        title="تأكيد الاستعادة"
        message={`سيتم استبدال قاعدة البيانات والملفات الحالية بمحتويات النسخة "${confirmRestore?.filename}". هذه العملية لا يمكن التراجع عنها.`}
        onConfirm={handleRestore}
        onCancel={() => setConfirmRestore(null)}
        loading={restoring}
      />

      {/* زر إنشاء نسخة */}
      <div className="glass-card p-4">
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 text-sm text-brand-blue hover:text-white transition-colors">
          <Plus size={16} />
          <span className="font-medium">إنشاء نسخة احتياطية جديدة</span>
          {showForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showForm && (
          <div className="mt-4 pt-4 border-t border-white/08 space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(TYPE_LABELS).map(([val, label]) => (
                <button key={val} onClick={() => setNewType(val)}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm transition-all ${
                    newType === val
                      ? 'bg-brand-blue/15 border-brand-blue/30 text-brand-blue'
                      : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white'
                  }`}>
                  {val === 'full' && <FolderArchive size={16} />}
                  {val === 'db_only' && <Database size={16} />}
                  {val === 'media_only' && <FileArchive size={16} />}
                  {label}
                </button>
              ))}
            </div>
            <input value={newNotes} onChange={e => setNewNotes(e.target.value)}
              placeholder="ملاحظات (اختياري)..." className="input-glass" />
            <button onClick={handleCreate} disabled={creating} className="btn-primary w-full sm:w-auto">
              {creating
                ? <><Loader2 size={16} className="animate-spin" /> جاري الإنشاء...</>
                : <><Plus size={16} /> إنشاء النسخة</>}
            </button>
          </div>
        )}
      </div>

      {/* قائمة النسخ */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : backups.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <HardDrive size={40} className="text-white/15 mx-auto mb-3" />
          <p className="text-white/40 text-sm">لا توجد نسخ احتياطية بعد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {backups.map(b => (
            <div key={b.id} className="glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
                  <FileArchive size={18} className="text-brand-blue" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{b.filename}</p>
                  <div className="flex items-center gap-3 text-white/40 text-xs mt-0.5">
                    <span className={TYPE_COLORS[b.backup_type] || 'badge-blue'}>{TYPE_LABELS[b.backup_type]}</span>
                    <span>{b.size_display}</span>
                    <span className="flex items-center gap-1"><Clock size={11} /> {new Date(b.created_at).toLocaleString('ar-SD')}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleDownload(b)}
                  disabled={downloadingId === b.id}
                  title={downloadingId === b.id ? 'جارٍ التحميل…' : 'تحميل'}
                  className="btn-ghost p-2 text-brand-blue hover:bg-brand-blue/10 rounded-lg disabled:opacity-60"
                >
                  {downloadingId === b.id
                    ? <Loader2 size={16} className="animate-spin" />
                    : <Download size={16} />}
                </button>
                <button onClick={() => setConfirmRestore(b)} title="استعادة"
                  className="btn-ghost p-2 text-neon-cyan hover:bg-neon-cyan/10 rounded-lg">
                  <RotateCcw size={16} />
                </button>
                {deleteConfirm === b.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(b)}
                      className="text-xs text-brand-red bg-brand-red/10 px-2 py-1 rounded-lg hover:bg-brand-red/20">حذف</button>
                    <button onClick={() => setDeleteConfirm(null)}
                      className="text-xs text-white/40 px-2 py-1 rounded-lg hover:bg-white/5">إلغاء</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(b.id)} title="حذف"
                    className="btn-ghost p-2 text-brand-red/60 hover:text-brand-red hover:bg-brand-red/10 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════
   تبويب إعدادات النسخ التلقائي
   ══════════════════════════════════════════════════════════════════ */
function SettingsTab({ showToast }) {
  const [cfg, setCfg]       = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/backups/settings/').then(({ data }) => setCfg(data)).catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data } = await api.patch('/backups/settings/', cfg)
      setCfg(data)
      showToast('success', 'تم حفظ إعدادات النسخ التلقائي.')
    } catch { showToast('error', 'فشل حفظ الإعدادات.') }
    finally { setSaving(false) }
  }

  if (!cfg) return <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-brand-blue" /></div>

  return (
    <div className="glass-card p-6 space-y-6 max-w-lg">
      {/* التفعيل */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-medium">النسخ التلقائي</p>
          <p className="text-white/40 text-xs mt-0.5">إنشاء نسخ احتياطية تلقائياً حسب الجدول</p>
        </div>
        <button onClick={() => setCfg(c => ({ ...c, auto_backup_enabled: !c.auto_backup_enabled }))}
          className={`w-12 h-7 rounded-full transition-all duration-300 relative ${
            cfg.auto_backup_enabled ? 'bg-brand-blue' : 'bg-white/15'
          }`}>
          <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all duration-300 ${
            cfg.auto_backup_enabled ? 'right-0.5' : 'right-[calc(100%-1.625rem)]'
          }`} />
        </button>
      </div>

      <div className="neon-line" />

      {/* التكرار */}
      <div>
        <label className="text-white/50 text-xs mb-1 block">التكرار</label>
        <select value={cfg.frequency} onChange={e => setCfg(c => ({ ...c, frequency: e.target.value }))}
          className="input-glass">
          <option value="daily">يومي</option>
          <option value="weekly">أسبوعي</option>
          <option value="monthly">شهري</option>
        </select>
      </div>

      {/* الاحتفاظ */}
      <div>
        <label className="text-white/50 text-xs mb-1 block">الاحتفاظ بآخر (عدد النسخ)</label>
        <input type="number" min="1" max="100" value={cfg.keep_last_n}
          onChange={e => setCfg(c => ({ ...c, keep_last_n: parseInt(e.target.value) || 1 }))}
          className="input-glass" />
      </div>

      {/* آخر نسخ تلقائي */}
      {cfg.last_auto_backup_at && (
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <Clock size={13} />
          <span>آخر نسخ تلقائي: {new Date(cfg.last_auto_backup_at).toLocaleString('ar-SD')}</span>
        </div>
      )}

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? <><Loader2 size={16} className="animate-spin" /> جاري الحفظ...</> : <><Save size={16} /> حفظ الإعدادات</>}
      </button>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   تبويب سجلات الاستعادة
   ══════════════════════════════════════════════════════════════════ */
function LogsTab() {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    api.get('/backups/restore-logs/')
      .then(({ data }) => setLogs(Array.isArray(data) ? data : data.results || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="space-y-3">{[1,2].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>

  if (logs.length === 0) return (
    <div className="glass-card p-10 text-center">
      <History size={40} className="text-white/15 mx-auto mb-3" />
      <p className="text-white/40 text-sm">لا توجد سجلات استعادة بعد</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {logs.map(log => (
        <div key={log.id} className="glass-card p-4 space-y-2">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                log.status === 'success' ? 'bg-neon-cyan/10' : 'bg-brand-red/10'
              }`}>
                {log.status === 'success' ? <CheckCircle size={16} className="text-neon-cyan" /> : <AlertCircle size={16} className="text-brand-red" />}
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm truncate">{log.backup_filename}</p>
                <div className="flex items-center gap-3 text-white/40 text-xs mt-0.5">
                  <span className={log.status === 'success' ? 'badge-green' : 'badge-red'}>
                    {log.status === 'success' ? 'ناجحة' : 'فاشلة'}
                  </span>
                  <span>{log.restored_by_name}</span>
                  <span>{new Date(log.restored_at).toLocaleString('ar-SD')}</span>
                </div>
              </div>
            </div>
            {expanded === log.id ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
          </div>
          {expanded === log.id && log.log_text && (
            <pre className="text-xs text-white/50 bg-dark-900/50 rounded-lg p-3 mt-2 whitespace-pre-wrap border border-white/5 animate-fade-in">{log.log_text}</pre>
          )}
        </div>
      ))}
    </div>
  )
}
