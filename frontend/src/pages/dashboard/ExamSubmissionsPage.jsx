/**
 * ExamSubmissionsPage.jsx — لوحة محاولات الطلاب لاختبار محدد
 *
 * يعرض:
 *   - ملخص إحصائي (عدد المحاولات، نسبة النجاح، المتوسط)
 *   - جدول بكل محاولات الطلاب
 *   - كل صف قابل للنقر لعرض التفاصيل
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Users, Loader2, ArrowRight, FileCheck, Clock, Award,
  TrendingUp, CheckCircle, XCircle, User, Calendar, Search,
  BarChart3, Target,
} from 'lucide-react'
import { fetchExam, fetchExamSubmissions } from '../../api/examService'
import Pagination from '../../components/ui/Pagination'

export default function ExamSubmissionsPage() {
  const navigate = useNavigate()
  const { id: examId } = useParams()

  const [exam, setExam] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  // تحميل بيانات الاختبار
  useEffect(() => {
    fetchExam(examId)
      .then(({ data }) => setExam(data))
      .catch(() => {})
  }, [examId])

  // تحميل المحاولات
  const loadAttempts = useCallback(() => {
    setLoading(true)
    fetchExamSubmissions(examId, { page })
      .then(({ data }) => {
        setAttempts(data.results || data)
        setTotal(data.count || (Array.isArray(data) ? data.length : 0))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [examId, page])

  useEffect(() => { loadAttempts() }, [loadAttempts])

  // حسابات إحصائية
  const allAttempts = attempts
  const totalAttempts = allAttempts.length
  const passedCount = allAttempts.filter(a => a.is_passed).length
  const passRate = totalAttempts > 0 ? ((passedCount / totalAttempts) * 100).toFixed(1) : 0
  const avgScore = totalAttempts > 0
    ? (allAttempts.reduce((sum, a) => sum + a.percentage, 0) / totalAttempts).toFixed(1)
    : 0

  // فلترة
  const filtered = allAttempts.filter(a =>
    (a.student_name && a.student_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard/exams')}
          className="btn-ghost p-2"
        >
          <ArrowRight size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
            <Users size={20} className="text-brand-blue shrink-0" />
            <span className="truncate">محاولات الطلاب</span>
          </h1>
          {exam && (
            <p className="text-white/40 text-xs mt-0.5 flex items-center gap-1.5 truncate">
              <FileCheck size={12} className="shrink-0" />
              {exam.title} — {exam.course_name}
            </p>
          )}
        </div>
      </div>

      {/* Stats cards */}
      {exam && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass-card p-4 text-center">
            <Users size={18} className="mx-auto text-brand-blue/60 mb-2" />
            <p className="text-white font-bold text-lg">{totalAttempts}</p>
            <p className="text-white/30 text-xs">إجمالي المحاولات</p>
          </div>
          <div className="glass-card p-4 text-center">
            <Target size={18} className="mx-auto text-neon-cyan/60 mb-2" />
            <p className="text-neon-cyan font-bold text-lg">{passRate}%</p>
            <p className="text-white/30 text-xs">نسبة النجاح</p>
          </div>
          <div className="glass-card p-4 text-center">
            <TrendingUp size={18} className="mx-auto text-brand-blue/60 mb-2" />
            <p className="text-white font-bold text-lg">{avgScore}%</p>
            <p className="text-white/30 text-xs">متوسط الدرجات</p>
          </div>
          <div className="glass-card p-4 text-center">
            <Award size={18} className="mx-auto text-brand-red/60 mb-2" />
            <p className="text-white font-bold text-lg">{exam.passing_score}</p>
            <p className="text-white/30 text-xs">درجة النجاح</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="بحث عن طالب..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input-glass w-full pr-10"
          />
        </div>
      </div>

      {/* Attempts table */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-white/30">
          <Users size={40} className="mx-auto mb-3 opacity-20" />
          <p>{searchTerm ? 'لا توجد نتائج تطابق بحثك.' : 'لا توجد محاولات بعد لهذا الاختبار.'}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="glass-card overflow-hidden hidden md:block">
            <table className="table-glass">
              <thead>
                <tr>
                  <th>#</th>
                  <th>اسم الطالب</th>
                  <th>رقم الهاتف</th>
                  <th>وقت التسليم</th>
                  <th>الدرجة</th>
                  <th>النسبة</th>
                  <th>الحالة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((attempt, idx) => (
                  <tr
                    key={attempt.id}
                    className="cursor-pointer hover:bg-white/03 transition-colors"
                    onClick={() => navigate(`/dashboard/exams/attempts/${attempt.id}`)}
                  >
                    <td className="text-white/30 text-xs">{idx + 1}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center shrink-0">
                          <User size={14} className="text-white/40" />
                        </div>
                        <span className="font-medium text-white">{attempt.student_name}</span>
                      </div>
                    </td>
                    <td className="text-white/50 text-xs" dir="ltr">{attempt.student_phone || '—'}</td>
                    <td className="text-white/50 text-xs">
                      <div className="flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(attempt.submitted_at).toLocaleDateString('ar-EG', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="font-bold text-white">{attempt.score.toFixed(1)}</td>
                    <td>
                      <span className={`font-bold ${attempt.percentage >= 60 ? 'text-neon-cyan' : 'text-brand-red'}`}>
                        {attempt.percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <span className={`badge text-[10px] ${attempt.is_passed ? 'badge-green' : 'badge-red'}`}>
                        {attempt.is_passed
                          ? <><CheckCircle size={10} /> ناجح</>
                          : <><XCircle size={10} /> راسب</>}
                      </span>
                    </td>
                    <td>
                      <button className="btn-ghost p-1.5 text-brand-blue/50 hover:text-brand-blue">
                        <BarChart3 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((attempt, idx) => (
              <div
                key={attempt.id}
                className="glass-card p-4 cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => navigate(`/dashboard/exams/attempts/${attempt.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-dark-600 flex items-center justify-center shrink-0">
                      <User size={16} className="text-white/40" />
                    </div>
                    <div>
                      <h3 className="font-cairo font-bold text-white text-sm">{attempt.student_name}</h3>
                      <p className="text-white/30 text-[10px] flex items-center gap-1 mt-0.5">
                        <Clock size={9} />
                        {new Date(attempt.submitted_at).toLocaleDateString('ar-EG', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <span className={`badge ${attempt.is_passed ? 'badge-green' : 'badge-red'} font-bold`}>
                      {attempt.percentage.toFixed(0)}%
                    </span>
                    <p className="text-[9px] text-white/30 mt-1">
                      {attempt.is_passed ? 'ناجح' : 'راسب'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-white/30 border-t border-white/05 pt-2">
                  <span>الدرجة: {attempt.score.toFixed(1)}</span>
                  <span className="text-brand-blue/60">عرض التفاصيل ←</span>
                </div>
              </div>
            ))}
          </div>

          <Pagination count={total} currentPage={page} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
