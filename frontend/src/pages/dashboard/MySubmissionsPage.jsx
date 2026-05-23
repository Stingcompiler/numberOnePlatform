/**
 * pages/dashboard/MySubmissionsPage.jsx
 * واجهة الطالب — تمارينتي وسجل الإجابات
 */

import { useEffect, useState, useCallback } from 'react'
import {
  ClipboardList, CheckCircle, XCircle, Award, Loader2,
  ChevronLeft, ChevronRight, BookOpen, Calendar,
} from 'lucide-react'
import api from '../../api/axiosInstance'

/* ─ بطاقة تسليم ─────────────────────────────────────────────── */
function SubmissionCard({ submission }) {
  const [open, setOpen] = useState(false)
  const passed = submission.is_passed

  return (
    <div className={`glass-card overflow-hidden border ${passed ? 'border-neon-cyan/15' : 'border-brand-red/10'}`}>
      {/* رأس البطاقة */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 p-4 hover:bg-white/3 transition-colors text-right"
      >
        {/* أيقونة */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          passed ? 'bg-neon-cyan/10' : 'bg-brand-red/10'
        }`}>
          {passed
            ? <Award size={18} className="text-neon-cyan" />
            : <XCircle size={18} className="text-brand-red" />
          }
        </div>

        {/* المعلومات */}
        <div className="flex-1 min-w-0">
          <p className="font-cairo font-semibold text-white text-sm truncate">
            {submission.exercise_title || 'تمرين'}
          </p>
          <p className="text-white/40 text-xs mt-0.5 flex items-center gap-2">
            <BookOpen size={10} /> {submission.lesson_title}
          </p>
        </div>

        {/* الدرجة */}
        <div className="text-left shrink-0">
          <p className={`font-cairo font-bold text-lg ${passed ? 'text-neon-cyan' : 'text-brand-red'}`}>
            {submission.percentage?.toFixed(1)}%
          </p>
          <p className="text-white/30 text-xs">
            {submission.score} / {submission.total_marks}
          </p>
        </div>

        {/* الحالة */}
        <div className="shrink-0">
          {passed
            ? <span className="badge-green badge text-xs">ناجح</span>
            : <span className="badge-red badge text-xs">راسب</span>
          }
        </div>
      </button>

      {/* التفاصيل */}
      {open && (
        <div className="border-t border-white/08 p-4 space-y-3 bg-dark-800/30">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {new Date(submission.submitted_at).toLocaleString('ar-SA')}
            </span>
            <span>محاولة رقم: {submission.attempt_number}</span>
          </div>

          {/* إجابات الأسئلة */}
          {submission.answers?.length > 0 && (
            <div className="space-y-2">
              <p className="text-white/50 text-xs font-medium">تفاصيل الإجابات:</p>
              {submission.answers.map((ans, i) => (
                <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${
                  ans.is_correct ? 'bg-neon-cyan/05 border border-neon-cyan/15' : 'bg-brand-red/05 border border-brand-red/10'
                }`}>
                  {ans.is_correct
                    ? <CheckCircle size={13} className="text-neon-cyan shrink-0 mt-0.5" />
                    : <XCircle size={13} className="text-brand-red shrink-0 mt-0.5" />
                  }
                  <div className="min-w-0">
                    <p className="text-white/70">{ans.question_text}</p>
                    <p className={`mt-0.5 ${ans.is_correct ? 'text-neon-cyan' : 'text-brand-red'}`}>
                      إجابتك: {ans.selected_choice_text || '(لم تُجَب)'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─ الصفحة الرئيسية ─────────────────────────────────────────── */
export default function MySubmissionsPage() {
  const [submissions, setSubmissions] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [page,        setPage]        = useState(1)
  const [total,       setTotal]       = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/academic/my-submissions/', { params: { page } })
      .then(({ data }) => {
        setSubmissions(data.results || data)
        setTotal(data.count || data.length)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load() }, [load])

  // ─ إحصائيات ─
  const passed  = submissions.filter(s => s.is_passed).length
  const totalS  = submissions.length
  const avgPct  = totalS > 0
    ? (submissions.reduce((acc, s) => acc + (s.percentage || 0), 0) / totalS).toFixed(1)
    : 0

  const totalPages = Math.ceil(total / 10)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* الرأس */}
      <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
        <ClipboardList size={20} className="text-brand-blue" /> تمارينتي
        <span className="text-white/30 font-normal text-sm">({total})</span>
      </h1>

      {/* إحصائيات مختصرة */}
      {totalS > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-4 text-center border border-neon-cyan/15">
            <p className="text-neon-cyan font-bold text-2xl font-cairo">{passed}</p>
            <p className="text-white/40 text-xs mt-1">تمارين ناجحة</p>
          </div>
          <div className="glass-card p-4 text-center border border-brand-red/15">
            <p className="text-brand-red font-bold text-2xl font-cairo">{totalS - passed}</p>
            <p className="text-white/40 text-xs mt-1">تمارين راسبة</p>
          </div>
          <div className="glass-card p-4 text-center border border-brand-blue/15">
            <p className="text-brand-blue font-bold text-2xl font-cairo">{avgPct}%</p>
            <p className="text-white/40 text-xs mt-1">متوسط النسبة</p>
          </div>
        </div>
      )}

      {/* القائمة */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="glass-card p-16 text-center text-white/40">
          <ClipboardList size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-cairo text-lg">لم تسلّم أي تمارين بعد</p>
          <p className="text-sm mt-2 text-white/25">ابدأ بحل تمارين كورساتك</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <SubmissionCard key={s.id} submission={s} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-white/40 text-xs">صفحة {page} من {totalPages}</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="btn-ghost p-1.5 disabled:opacity-30"><ChevronRight size={16} /></button>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              className="btn-ghost p-1.5 disabled:opacity-30"><ChevronLeft size={16} /></button>
          </div>
        </div>
      )}
    </div>
  )
}
