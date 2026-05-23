/**
 * StudentRequestsPage.jsx — صفحة طلبات التسجيل
 * ──────────────────────────────────────────────
 * تبويبان:
 *  1. طلبات التسجيل الجديدة (NewStudentRegistration)
 *  2. الطلبات القديمة (StudentRequest) — النافذة العامة السابقة
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Filter, Eye, CheckCircle, Trash2, Calendar, User, Phone,
  MapPin, Inbox, Loader2, RefreshCw, Archive, GraduationCap, Layers,
  Clock, XCircle, FileText, X,
} from 'lucide-react'
import api from '../../api/axiosInstance'

/* ── Status Helpers ── */
const NEW_STATUS_MAP = {
  new:      { label: 'جديد',        color: 'bg-blue-500/15 text-blue-400',     icon: Clock },
  reviewed: { label: 'تمت المراجعة', color: 'bg-yellow-500/15 text-yellow-400', icon: Eye },
  accepted: { label: 'مقبول',       color: 'bg-emerald-500/15 text-emerald-400', icon: CheckCircle },
  rejected: { label: 'مرفوض',       color: 'bg-red-500/15 text-red-400',       icon: XCircle },
}

const OLD_STATUS_MAP = {
  new:       { label: 'جديد',        color: 'bg-brand-red/20 text-brand-red' },
  contacted: { label: 'تم التواصل',  color: 'bg-brand-blue/20 text-brand-blue' },
  closed:    { label: 'مكتمل / مغلق', color: 'bg-neon-cyan/20 text-neon-cyan' },
}

/* ═══════════════════════════════════════════════════════════════
   Tab 1: New Registration Requests
   ═══════════════════════════════════════════════════════════════ */
function NewRegistrationTab() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (statusFilter) params.append('status', statusFilter)
      if (levelFilter) params.append('level', levelFilter)
      if (dateFilter) params.append('date', dateFilter)
      const { data } = await api.get(`/student-registration/?${params.toString()}`)
      setRequests(data.results || data)
    } catch { setRequests([]) }
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(fetchRequests, 400)
    return () => clearTimeout(t)
  }, [search, statusFilter, levelFilter, dateFilter])

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب؟')) return
    try { await api.delete(`/student-registration/${id}/`); fetchRequests() }
    catch { alert('حدث خطأ أثناء الحذف.') }
  }

  const handleQuickStatus = async (id, newStatus) => {
    try { await api.patch(`/student-registration/${id}/`, { status: newStatus }); fetchRequests() }
    catch { alert('حدث خطأ أثناء تحديث الحالة.') }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-white/50 mb-1 block">بحث (الاسم، الوطني، ولي الأمر)</label>
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input-glass pl-3 pr-10 w-full" placeholder="ابحث..." />
          </div>
        </div>
        <div className="w-full sm:w-auto min-w-[130px]">
          <label className="text-xs text-white/50 mb-1 block">الحالة</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-glass pl-3 pr-3 w-full appearance-none">
            <option value="">الكل</option>
            <option value="new">جديد</option>
            <option value="reviewed">تمت المراجعة</option>
            <option value="accepted">مقبول</option>
            <option value="rejected">مرفوض</option>
          </select>
        </div>
        <div className="w-full sm:w-auto min-w-[130px]">
          <label className="text-xs text-white/50 mb-1 block">المرحلة</label>
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} className="input-glass pl-3 pr-3 w-full appearance-none">
            <option value="">الكل</option>
            <option value="primary">ابتدائي</option>
            <option value="middle">متوسط</option>
            <option value="secondary">ثانوي</option>
          </select>
        </div>
        <div className="w-full sm:w-auto min-w-[150px]">
          <label className="text-xs text-white/50 mb-1 block">تاريخ الإرسال</label>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input-glass pl-3 pr-3 w-full [color-scheme:dark]" />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading && requests.length === 0 ? (
          <div className="flex items-center justify-center p-10"><Loader2 className="animate-spin text-brand-blue" size={32} /></div>
        ) : requests.length === 0 ? (
          <div className="text-center p-10 text-white/50">
            <Inbox size={48} className="mx-auto mb-3 opacity-20" />
            لا توجد طلبات تسجيل جديدة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-white/5 border-b border-white/10 text-white/70">
                <tr>
                  <th className="p-4 font-cairo">اسم الطالب</th>
                  <th className="p-4 font-cairo">الرقم الوطني</th>
                  <th className="p-4 font-cairo hidden md:table-cell">المرحلة</th>
                  <th className="p-4 font-cairo hidden md:table-cell">الصف</th>
                  <th className="p-4 font-cairo">ولي الأمر</th>
                  <th className="p-4 font-cairo hidden lg:table-cell">المشرفة</th>
                  <th className="p-4 font-cairo">تاريخ الإرسال</th>
                  <th className="p-4 font-cairo">الحالة</th>
                  <th className="p-4 font-cairo">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {requests.map(req => {
                  const st = NEW_STATUS_MAP[req.status] || NEW_STATUS_MAP.new
                  const StIcon = st.icon
                  return (
                    <tr key={req.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 text-white font-medium">
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-white/40" />
                          {req.student_full_name}
                        </div>
                      </td>
                      <td className="p-4 text-white/70 text-xs" dir="ltr">{req.national_id}</td>
                      <td className="p-4 text-white/80 hidden md:table-cell">
                        <span className="bg-dark-600/70 px-2 py-1 rounded text-xs">{req.level_display || req.level}</span>
                      </td>
                      <td className="p-4 text-white/80 hidden md:table-cell">
                        <span className="bg-dark-600/70 px-2 py-1 rounded text-xs">{req.grade_display || req.grade}</span>
                      </td>
                      <td className="p-4 text-white/80">
                        <div>{req.guardian_name}</div>
                        <div className="text-xs text-white/40 flex items-center gap-1 mt-0.5"><Phone size={12} /> {req.guardian_phone}</div>
                      </td>
                      <td className="p-4 text-white/60 text-xs hidden lg:table-cell">{req.supervisor_name || '—'}</td>
                      <td className="p-4 text-white/60 text-xs">
                        {new Date(req.submitted_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 w-fit ${st.color}`}>
                          <StIcon size={12} /> {st.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => navigate(`/dashboard/student-requests/${req.id}`)} className="p-1.5 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 rounded-lg transition-colors" title="التفاصيل">
                            <Eye size={16} />
                          </button>
                          {req.status === 'new' && (
                            <button onClick={() => handleQuickStatus(req.id, 'reviewed')} className="p-1.5 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 rounded-lg transition-colors" title="تمت المراجعة">
                              <CheckCircle size={16} />
                            </button>
                          )}
                          {req.status === 'reviewed' && (
                            <>
                              <button onClick={() => handleQuickStatus(req.id, 'accepted')} className="p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors" title="قبول">
                                <CheckCircle size={16} />
                              </button>
                              <button onClick={() => handleQuickStatus(req.id, 'rejected')} className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors" title="رفض">
                                <XCircle size={16} />
                              </button>
                            </>
                          )}
                          <button onClick={() => handleDelete(req.id)} className="p-1.5 bg-brand-red/10 text-brand-red hover:bg-brand-red/20 rounded-lg transition-colors" title="حذف">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Tab 2: Old Registration Requests (StudentRequest)
   ═══════════════════════════════════════════════════════════════ */
function OldRequestsTab() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedRequest, setSelectedRequest] = useState(null)

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (statusFilter) params.append('status', statusFilter)
      if (dateFilter) params.append('date', dateFilter)
      const { data } = await api.get(`/student-requests/?${params.toString()}`)
      setRequests(data.results || data)
    } catch { setRequests([]) }
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(fetchRequests, 400)
    return () => clearTimeout(t)
  }, [search, statusFilter, dateFilter])

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.patch(`/student-requests/${id}/`, { status: newStatus })
      fetchRequests()
      if (selectedRequest?.id === id) {
        setSelectedRequest({ ...selectedRequest, status: newStatus })
      }
    } catch { alert('حدث خطأ أثناء تحديث الحالة.') }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب؟')) return
    try { await api.delete(`/student-requests/${id}/`); fetchRequests(); setSelectedRequest(null) }
    catch { alert('حدث خطأ أثناء الحذف.') }
  }

  const getStatusInfo = s => OLD_STATUS_MAP[s] || { label: s, color: 'bg-white/10 text-white/70' }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-white/50 mb-1 block">بحث (الاسم، رقم الهاتف)</label>
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input-glass pl-3 pr-10 w-full" placeholder="ابحث..." />
          </div>
        </div>
        <div className="w-full sm:w-auto min-w-[150px]">
          <label className="text-xs text-white/50 mb-1 block">الحالة</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-glass pl-3 pr-3 w-full appearance-none">
            <option value="">الكل</option>
            <option value="new">جديد</option>
            <option value="contacted">تم التواصل</option>
            <option value="closed">مكتمل / مغلق</option>
          </select>
        </div>
        <div className="w-full sm:w-auto min-w-[150px]">
          <label className="text-xs text-white/50 mb-1 block">تاريخ الإرسال</label>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input-glass pl-3 pr-3 w-full [color-scheme:dark]" />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading && requests.length === 0 ? (
          <div className="flex items-center justify-center p-10"><Loader2 className="animate-spin text-brand-blue" size={32} /></div>
        ) : requests.length === 0 ? (
          <div className="text-center p-10 text-white/50">
            <Inbox size={48} className="mx-auto mb-3 opacity-20" />
            لا توجد طلبات.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-white/5 border-b border-white/10 text-white/70">
                <tr>
                  <th className="p-4 font-cairo">اسم الطالب</th>
                  <th className="p-4 font-cairo">ولي الأمر</th>
                  <th className="p-4 font-cairo">النظام</th>
                  <th className="p-4 font-cairo hidden md:table-cell">المرحلة</th>
                  <th className="p-4 font-cairo">تاريخ الإرسال</th>
                  <th className="p-4 font-cairo">الحالة</th>
                  <th className="p-4 font-cairo">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {requests.map(req => {
                  const st = getStatusInfo(req.status)
                  return (
                    <tr key={req.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 text-white font-medium">
                        <div className="flex items-center gap-2"><User size={16} className="text-white/40" /> {req.student_name}</div>
                      </td>
                      <td className="p-4 text-white/80">
                        <div>{req.guardian_name}</div>
                        <div className="text-xs text-white/40 flex items-center gap-1 mt-0.5"><Phone size={12} /> {req.guardian_phone}</div>
                      </td>
                      <td className="p-4"><span className="bg-dark-600 px-2 py-1 rounded text-xs text-white/80">{req.system_type_display || req.system_type}</span></td>
                      <td className="p-4 hidden md:table-cell"><span className="bg-dark-600/70 px-2 py-1 rounded text-xs text-white/80">{req.level_display || req.level || '—'}</span></td>
                      <td className="p-4 text-white/60 text-xs">{new Date(req.submitted_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-medium ${st.color}`}>{st.label}</span></td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSelectedRequest(req)} className="p-1.5 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 rounded-lg transition-colors" title="التفاصيل"><Eye size={16} /></button>
                          {req.status === 'new' && (
                            <button onClick={() => handleStatusChange(req.id, 'contacted')} className="p-1.5 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 rounded-lg transition-colors" title="تم التواصل"><CheckCircle size={16} /></button>
                          )}
                          {req.status === 'contacted' && (
                            <button onClick={() => handleStatusChange(req.id, 'closed')} className="p-1.5 bg-white/10 text-white hover:bg-white/20 rounded-lg transition-colors" title="مكتمل"><Archive size={16} /></button>
                          )}
                          <button onClick={() => handleDelete(req.id)} className="p-1.5 bg-brand-red/10 text-brand-red hover:bg-brand-red/20 rounded-lg transition-colors" title="حذف"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-lg overflow-hidden relative shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-white/10 bg-dark-800/50">
              <h3 className="font-cairo font-bold text-white text-lg">تفاصيل الطلب</h3>
              <button onClick={() => setSelectedRequest(null)} className="text-white/50 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusInfo(selectedRequest.status).color}`}>
                  الحالة: {getStatusInfo(selectedRequest.status).label}
                </span>
                <span className="text-white/50 text-xs">{new Date(selectedRequest.submitted_at).toLocaleString('ar-EG')}</span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-white/50 mb-1">اسم الطالب</div>
                  <div className="text-white font-medium text-lg">{selectedRequest.student_name}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-white/50 mb-1">اسم ولي الأمر</div>
                    <div className="text-white">{selectedRequest.guardian_name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/50 mb-1">هاتف ولي الأمر</div>
                    <div className="text-white flex items-center gap-2">
                      <Phone size={14} className="text-white/40" />
                      <a href={`tel:${selectedRequest.guardian_phone}`} className="hover:text-brand-blue hover:underline">{selectedRequest.guardian_phone}</a>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-white/50 mb-1">النظام الدراسي</div>
                    <div className="text-white bg-dark-600 inline-block px-2 py-1 rounded text-sm">{selectedRequest.system_type_display || selectedRequest.system_type}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/50 mb-1">المرحلة</div>
                    <div className="text-white bg-dark-600/70 inline-block px-2 py-1 rounded text-sm">{selectedRequest.level_display || selectedRequest.level || '—'}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/50 mb-1">العنوان</div>
                  <div className="text-white flex items-center gap-2"><MapPin size={14} className="text-white/40" /> {selectedRequest.address}</div>
                </div>
                {selectedRequest.notes && (
                  <div className="bg-dark-600/50 p-3 rounded-xl border border-white/5 mt-2">
                    <div className="text-xs text-white/50 mb-1">ملاحظات</div>
                    <div className="text-white/90 text-sm whitespace-pre-wrap">{selectedRequest.notes}</div>
                  </div>
                )}
              </div>
              <div className="pt-4 mt-4 border-t border-white/10 flex gap-2 justify-end">
                {selectedRequest.status === 'new' && (
                  <button onClick={() => handleStatusChange(selectedRequest.id, 'contacted')} className="btn-secondary text-sm !py-2 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20">
                    <CheckCircle size={16} /> تم التواصل
                  </button>
                )}
                {selectedRequest.status === 'contacted' && (
                  <button onClick={() => handleStatusChange(selectedRequest.id, 'closed')} className="btn-secondary text-sm !py-2 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20">
                    <Archive size={16} /> مكتمل
                  </button>
                )}
                <button onClick={() => setSelectedRequest(null)} className="btn-secondary text-sm !py-2">إغلاق</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Main Page — Tabbed
   ═══════════════════════════════════════════════════════════════ */
export default function StudentRequestsPage() {
  const [tab, setTab] = useState('new')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-cairo text-white flex items-center gap-2">
            <Inbox className="text-brand-blue" /> طلبات التسجيل
          </h1>
          <p className="text-white/50 text-sm mt-1">
            مراجعة وإدارة طلبات التسجيل الواردة
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/05 w-fit">
        <button
          onClick={() => setTab('new')}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold font-cairo transition-all ${
            tab === 'new'
              ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20'
              : 'text-white/50 hover:text-white hover:bg-white/05'
          }`}
        >
          <div className="flex items-center gap-2"><FileText size={16} /> طلبات التسجيل الجديدة</div>
        </button>
        <button
          onClick={() => setTab('old')}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold font-cairo transition-all ${
            tab === 'old'
              ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20'
              : 'text-white/50 hover:text-white hover:bg-white/05'
          }`}
        >
          <div className="flex items-center gap-2"><Archive size={16} /> الطلبات القديمة</div>
        </button>
      </div>

      {/* Tab Content */}
      {tab === 'new' ? <NewRegistrationTab /> : <OldRequestsTab />}
    </div>
  )
}
