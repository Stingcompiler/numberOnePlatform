/**
 * pages/dashboard/InboxPage.jsx
 * صندوق الوارد — رسائل الزوار مع إدارة الحالة
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Inbox, Mail, MailOpen, Phone, User, Clock,
  ChevronLeft, ChevronRight, X, Loader2, Filter,
} from 'lucide-react'
import api from '../../api/axiosInstance'

const STATUS_LABELS = {
  unread:    { label: 'غير مقروءة', color: 'badge-red',   dot: 'bg-brand-red'    },
  seen:      { label: 'مفتوحة',     color: 'badge-blue',  dot: 'bg-brand-blue'   },
  contacted: { label: 'تم التواصل', color: 'badge-green', dot: 'bg-neon-cyan'    },
  pending:   { label: 'معلّقة',     color: 'badge',       dot: 'bg-amber-400'    },
}

export default function InboxPage() {
  const [messages, setMessages] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('')
  const [page,     setPage]     = useState(1)
  const [total,    setTotal]    = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/admin/inbox/', { params: { status: filter || undefined, page } })
      .then(({ data }) => {
        setMessages(data.results || data)
        setTotal(data.count || (data.results ? data.count : data.length))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filter, page])

  useEffect(() => { load() }, [load])

  const openMessage = async (msg) => {
    const { data } = await api.get(`/admin/inbox/${msg.id}/`)
    setSelected(data)
    load() // تحديث القائمة (تغيير الحالة لـ seen)
  }

  const changeStatus = async (id, status) => {
    await api.patch(`/admin/inbox/${id}/status/`, { status })
    load()
    if (selected?.id === id) {
      setSelected((prev) => ({ ...prev, status }))
    }
  }

  const totalPages = Math.ceil(total / 10)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* الرأس */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
          <Inbox size={20} className="text-brand-blue" /> صندوق الوارد
          <span className="badge-red badge text-xs">{total}</span>
        </h1>
        {/* فلتر الحالة */}
        <div className="flex gap-2 flex-wrap">
          {[['', 'الكل'], ['unread', 'غير مقروءة'], ['seen', 'مفتوحة'], ['contacted', 'تم التواصل'], ['pending', 'معلّقة']].map(([val, label]) => (
            <button key={val} onClick={() => { setFilter(val); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === val ? 'bg-brand-blue/15 text-brand-blue border border-brand-blue/30' : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* القائمة */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><Loader2 size={28} className="animate-spin text-brand-blue mx-auto" /></div>
        ) : messages.length === 0 ? (
          <div className="p-12 text-center text-white/30">
            <Inbox size={40} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد رسائل</p>
          </div>
        ) : (
          <div className="divide-y divide-white/05">
            {messages.map((msg) => {
              const s = STATUS_LABELS[msg.status] || STATUS_LABELS.unread
              const isUnread = msg.status === 'unread'
              return (
                <div key={msg.id}
                  onClick={() => openMessage(msg)}
                  className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-all hover:bg-white/4 ${isUnread ? 'bg-brand-blue/03' : ''}`}>
                  {/* أيقونة */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isUnread ? 'bg-brand-blue/15' : 'bg-white/05'}`}>
                    {isUnread ? <Mail size={16} className="text-brand-blue" /> : <MailOpen size={16} className="text-white/30" />}
                  </div>
                  {/* المحتوى */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium truncate ${isUnread ? 'text-white' : 'text-white/70'}`}>
                        {msg.sender_name}
                      </p>
                      <span className={`badge ${s.color} text-xs shrink-0`}>{s.label}</span>
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${isUnread ? 'text-white/60' : 'text-white/35'}`}>
                      {msg.subject || '(بدون موضوع)'} — {msg.message?.substring(0, 60)}...
                    </p>
                  </div>
                  <span className="text-white/25 text-xs shrink-0">
                    {new Date(msg.received_at).toLocaleDateString('ar-SA')}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-white/05">
            <p className="text-white/30 text-xs">صفحة {page} من {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page===1} onClick={() => setPage(p=>p-1)} className="btn-ghost p-1.5 disabled:opacity-30"><ChevronRight size={16}/></button>
              <button disabled={page===totalPages} onClick={() => setPage(p=>p+1)} className="btn-ghost p-1.5 disabled:opacity-30"><ChevronLeft size={16}/></button>
            </div>
          </div>
        )}
      </div>

      {/* نافذة تفاصيل الرسالة */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
          <div className="glass-card-strong w-full max-w-lg p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-cairo font-bold text-white text-base flex items-center gap-2">
                <MailOpen size={16} className="text-brand-blue" />
                {selected.subject || 'رسالة من الزوار'}
              </h2>
              <button onClick={() => setSelected(null)} className="btn-ghost p-1.5"><X size={18} /></button>
            </div>

            {/* بيانات المرسل */}
            <div className="bg-dark-700/50 rounded-xl p-4 space-y-2 mb-4 text-sm">
              <div className="flex items-center gap-2 text-white/60">
                <User size={14} className="text-brand-blue shrink-0" />
                <span className="font-medium text-white">{selected.sender_name}</span>
              </div>
              {selected.sender_phone && (
                <a href={`tel:${selected.sender_phone}`} className="flex items-center gap-2 text-white/60 hover:text-brand-blue transition-colors">
                  <Phone size={14} className="text-brand-blue shrink-0" />
                  <span dir="ltr">{selected.sender_phone}</span>
                </a>
              )}
              {selected.sender_email && (
                <a href={`mailto:${selected.sender_email}`} className="flex items-center gap-2 text-white/60 hover:text-brand-blue transition-colors">
                  <Mail size={14} className="text-brand-blue shrink-0" />
                  {selected.sender_email}
                </a>
              )}
              <div className="flex items-center gap-2 text-white/30 text-xs">
                <Clock size={12} />
                {new Date(selected.received_at).toLocaleString('ar-SA')}
              </div>
            </div>

            {/* الرسالة */}
            <div className="glass-card p-4 text-white/80 text-sm leading-relaxed whitespace-pre-wrap mb-5">
              {selected.message}
            </div>

            {/* تغيير الحالة */}
            <div className="flex gap-2 flex-wrap">
              <p className="text-white/40 text-xs self-center ml-1">الحالة:</p>
              {['seen', 'contacted', 'pending'].map((s) => (
                <button key={s}
                  onClick={() => changeStatus(selected.id, s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selected.status === s
                      ? 'bg-brand-blue/15 text-brand-blue border border-brand-blue/30'
                      : 'text-white/40 hover:text-white bg-white/5 hover:bg-white/10'
                  }`}>
                  {STATUS_LABELS[s]?.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
