/**
 * AttemptDetailPage.jsx — ورقة إجابة تفصيلية لمحاولة طالب
 *
 * يعرض لكل سؤال:
 *   - نص السؤال ونوعه
 *   - الإجابة الصحيحة
 *   - إجابة الطالب
 *   - مؤشر صح/خطأ
 *   - الدرجة المكتسبة
 *
 * لأسئلة المطابقة: عرض فرق واضح بين الأزواج الصحيحة وأزواج الطالب.
 */

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight, Loader2, FileCheck, User, Calendar, Clock,
  CheckCircle, XCircle, Award, TrendingUp, ToggleLeft,
  List, Type, Link2, ArrowLeftRight,
} from 'lucide-react'
import { fetchAttemptDetail } from '../../api/examService'

/* ═══════════════════════════════════════════════════════════════════
   أيقونة نوع السؤال
   ═══════════════════════════════════════════════════════════════════ */
const TYPE_ICONS = {
  true_false: ToggleLeft,
  multiple_choice: List,
  fill_blank: Type,
  matching: Link2,
}
const TYPE_LABELS = {
  true_false: 'صح / خطأ',
  multiple_choice: 'اختيار من متعدد',
  fill_blank: 'أكمل الفراغ',
  matching: 'مطابقة',
}
const TYPE_STYLES = {
  true_false:      { color: 'text-neon-cyan',  bg: 'bg-neon-cyan/10',  border: 'border-neon-cyan/25' },
  multiple_choice: { color: 'text-brand-blue', bg: 'bg-brand-blue/10', border: 'border-brand-blue/25' },
  fill_blank:      { color: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/25' },
  matching:        { color: 'text-violet-400', bg: 'bg-violet-400/10', border: 'border-violet-400/25' },
}

/* ═══════════════════════════════════════════════════════════════════
   عرض إجابة صح/خطأ
   ═══════════════════════════════════════════════════════════════════ */
function TrueFalseAnswer({ correct, student }) {
  const correctVal = correct?.value
  const studentVal = student?.value

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-neon-cyan/5 border border-neon-cyan/15 rounded-xl p-3">
        <p className="text-neon-cyan/60 text-[10px] mb-1">الإجابة الصحيحة</p>
        <p className="text-neon-cyan font-bold text-sm flex items-center gap-1.5">
          {correctVal ? <><CheckCircle size={14} /> صح</> : <><XCircle size={14} /> خطأ</>}
        </p>
      </div>
      <div className={`border rounded-xl p-3 ${
        studentVal === correctVal
          ? 'bg-neon-cyan/5 border-neon-cyan/15'
          : 'bg-brand-red/5 border-brand-red/15'
      }`}>
        <p className="text-white/40 text-[10px] mb-1">إجابة الطالب</p>
        <p className={`font-bold text-sm flex items-center gap-1.5 ${
          studentVal === correctVal ? 'text-neon-cyan' : 'text-brand-red'
        }`}>
          {studentVal === undefined || studentVal === null
            ? 'لم يُجِب'
            : studentVal ? <><CheckCircle size={14} /> صح</> : <><XCircle size={14} /> خطأ</>}
        </p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   عرض إجابة اختيار من متعدد
   ═══════════════════════════════════════════════════════════════════ */
function MultipleChoiceAnswer({ correct, student, options }) {
  const correctId = correct?.option_id
  const studentId = student?.option_id

  return (
    <div className="space-y-1.5">
      {(options || []).map(opt => {
        const isCorrect = opt.id === correctId
        const isSelected = opt.id === studentId
        let style = 'border-white/05 text-white/40'
        if (isCorrect && isSelected) style = 'border-neon-cyan/30 bg-neon-cyan/8 text-neon-cyan'
        else if (isCorrect) style = 'border-neon-cyan/20 bg-neon-cyan/5 text-neon-cyan/70'
        else if (isSelected) style = 'border-brand-red/30 bg-brand-red/8 text-brand-red'

        return (
          <div key={opt.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${style}`}>
            <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
              isCorrect ? 'border-neon-cyan bg-neon-cyan/20' : isSelected ? 'border-brand-red bg-brand-red/20' : 'border-white/15'
            }`}>
              {isCorrect && <CheckCircle size={10} />}
              {isSelected && !isCorrect && <XCircle size={10} />}
            </div>
            <span className="text-sm flex-1">{opt.text}</span>
            <div className="flex items-center gap-1 text-[10px] shrink-0">
              {isCorrect && <span className="badge-green badge text-[9px]">✓ صحيحة</span>}
              {isSelected && !isCorrect && <span className="badge-red badge text-[9px]">✗ اختاره</span>}
              {isSelected && isCorrect && <span className="badge-green badge text-[9px]">✓ اختاره</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   عرض إجابة أكمل الفراغ
   ═══════════════════════════════════════════════════════════════════ */
function FillBlankAnswer({ correct, student, isCorrect }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-neon-cyan/5 border border-neon-cyan/15 rounded-xl p-3">
        <p className="text-neon-cyan/60 text-[10px] mb-1">الإجابة الصحيحة</p>
        <p className="text-neon-cyan font-bold text-sm">{correct?.text || '—'}</p>
      </div>
      <div className={`border rounded-xl p-3 ${
        isCorrect
          ? 'bg-neon-cyan/5 border-neon-cyan/15'
          : 'bg-brand-red/5 border-brand-red/15'
      }`}>
        <p className="text-white/40 text-[10px] mb-1">إجابة الطالب</p>
        <p className={`font-bold text-sm ${isCorrect ? 'text-neon-cyan' : 'text-brand-red'}`}>
          {student?.text || 'لم يُجِب'}
        </p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   عرض إجابة المطابقة — مع فرق واضح
   ═══════════════════════════════════════════════════════════════════ */
function MatchingAnswer({ correct, student }) {
  const correctPairs = correct?.pairs || []
  const studentPairs = student?.pairs || []

  // بناء خريطة المطابقة الصحيحة
  const correctMap = {}
  correctPairs.forEach(p => { correctMap[p.a] = p.b })

  // بناء خريطة إجابة الطالب
  const studentMap = {}
  studentPairs.forEach(p => { studentMap[p.a] = p.b })

  return (
    <div className="space-y-4">
      {/* الأزواج الصحيحة */}
      <div>
        <p className="text-neon-cyan/60 text-[10px] mb-2 font-medium">✓ الأزواج الصحيحة</p>
        <div className="space-y-1.5">
          {correctPairs.map((pair, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-neon-cyan/5 border border-neon-cyan/10 rounded-xl px-3 py-2">
              <span className="text-neon-cyan/80 text-sm flex-1 text-right">{pair.a}</span>
              <ArrowLeftRight size={12} className="text-neon-cyan/40 shrink-0" />
              <span className="text-neon-cyan/80 text-sm flex-1 text-left">{pair.b}</span>
            </div>
          ))}
        </div>
      </div>

      {/* إجابة الطالب مع المقارنة */}
      <div>
        <p className="text-white/40 text-[10px] mb-2 font-medium">إجابة الطالب</p>
        <div className="space-y-1.5">
          {studentPairs.length === 0 ? (
            <p className="text-brand-red/60 text-sm p-3 bg-brand-red/5 rounded-xl border border-brand-red/10">
              لم يُجِب على هذا السؤال
            </p>
          ) : (
            studentPairs.map((pair, idx) => {
              const isCorrectPair = correctMap[pair.a] === pair.b
              return (
                <div key={idx} className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${
                  isCorrectPair
                    ? 'bg-neon-cyan/5 border-neon-cyan/15'
                    : 'bg-brand-red/5 border-brand-red/15'
                }`}>
                  <span className={`text-sm flex-1 text-right ${isCorrectPair ? 'text-neon-cyan/80' : 'text-brand-red/80'}`}>
                    {pair.a}
                  </span>
                  <div className="shrink-0 flex items-center gap-1">
                    {isCorrectPair
                      ? <CheckCircle size={12} className="text-neon-cyan" />
                      : <XCircle size={12} className="text-brand-red" />}
                    <ArrowLeftRight size={12} className="text-white/20" />
                  </div>
                  <span className={`text-sm flex-1 text-left ${isCorrectPair ? 'text-neon-cyan/80' : 'text-brand-red/80'}`}>
                    {pair.b}
                  </span>
                  {!isCorrectPair && correctMap[pair.a] && (
                    <span className="text-[9px] text-neon-cyan/50 bg-neon-cyan/8 px-1.5 py-0.5 rounded-full shrink-0">
                      الصحيح: {correctMap[pair.a]}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   الصفحة الرئيسية — تفاصيل المحاولة
   ═══════════════════════════════════════════════════════════════════ */
export default function AttemptDetailPage() {
  const navigate = useNavigate()
  const { id: attemptId } = useParams()

  const [attempt, setAttempt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetchAttemptDetail(attemptId)
      .then(({ data }) => setAttempt(data))
      .catch(() => setError('فشل تحميل تفاصيل المحاولة.'))
      .finally(() => setLoading(false))
  }, [attemptId])

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
      </div>
    )
  }

  if (error || !attempt) {
    return (
      <div className="glass-card p-12 text-center text-white/30">
        <XCircle size={40} className="mx-auto mb-3 opacity-30" />
        <p>{error || 'المحاولة غير موجودة.'}</p>
        <button onClick={() => navigate(-1)} className="btn-secondary mt-4 text-sm">رجوع</button>
      </div>
    )
  }

  const answers = attempt.answers || []
  const correctCount = answers.filter(a => a.is_correct).length
  const totalQuestions = answers.length

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/np-panel/exams/${attempt.exam}/submissions`)}
          className="btn-ghost p-2"
        >
          <ArrowRight size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
            <FileCheck size={20} className="text-brand-blue shrink-0" />
            <span className="truncate">ورقة الإجابة</span>
          </h1>
          <p className="text-white/40 text-xs mt-0.5 truncate">
            {attempt.exam_title}
          </p>
        </div>
      </div>

      {/* Student info card */}
      <div className="glass-card p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-blue/20 to-brand-red/20 flex items-center justify-center border border-white/10">
              <User size={20} className="text-white/60" />
            </div>
            <div>
              <h2 className="font-cairo font-bold text-white text-base">{attempt.student_name}</h2>
              {attempt.student_phone && (
                <p className="text-white/30 text-xs" dir="ltr">{attempt.student_phone}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {new Date(attempt.submitted_at).toLocaleDateString('ar-EG', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* Score summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/05">
          <div className="text-center">
            <p className="text-white/30 text-[10px] mb-1">الدرجة</p>
            <p className="text-white font-bold text-lg">{attempt.score.toFixed(1)} / {attempt.exam_total_marks}</p>
          </div>
          <div className="text-center">
            <p className="text-white/30 text-[10px] mb-1">النسبة</p>
            <p className={`font-bold text-lg ${attempt.is_passed ? 'text-neon-cyan' : 'text-brand-red'}`}>
              {attempt.percentage.toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-white/30 text-[10px] mb-1">الإجابات الصحيحة</p>
            <p className="text-white font-bold text-lg">{correctCount} / {totalQuestions}</p>
          </div>
          <div className="text-center">
            <p className="text-white/30 text-[10px] mb-1">الحالة</p>
            <span className={`badge text-sm ${attempt.is_passed ? 'badge-green' : 'badge-red'}`}>
              {attempt.is_passed
                ? <><CheckCircle size={12} /> ناجح</>
                : <><XCircle size={12} /> راسب</>}
            </span>
          </div>
        </div>
      </div>

      {/* Answer sheet */}
      <div className="space-y-4">
        <h3 className="font-cairo font-bold text-white text-sm flex items-center gap-2">
          <List size={16} className="text-brand-blue" />
          تفاصيل الإجابات ({totalQuestions} سؤال)
        </h3>

        {answers.map((answer, idx) => {
          const Icon = TYPE_ICONS[answer.question_type] || List
          const typeStyle = TYPE_STYLES[answer.question_type] || TYPE_STYLES.multiple_choice
          const questionTitle = answer.question_title?.trim()
          return (
            <div key={answer.id} className="glass-card overflow-hidden">
              {/* Question header */}
              <div className={`flex items-center gap-3 px-4 py-3 border-b ${
                answer.is_correct ? 'border-neon-cyan/10 bg-neon-cyan/3' : 'border-brand-red/10 bg-brand-red/3'
              }`}>
                {/* Number badge */}
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                  answer.is_correct ? 'bg-neon-cyan/15 text-neon-cyan' : 'bg-brand-red/15 text-brand-red'
                }`}>
                  {idx + 1}
                </span>

                {/* Type badge */}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 border ${typeStyle.bg} ${typeStyle.color} ${typeStyle.border}`}>
                  <Icon size={10} />
                  {TYPE_LABELS[answer.question_type] || answer.question_type}
                </span>

                {/* Title */}
                {questionTitle && (
                  <span className="text-white/70 text-sm font-medium flex-1 truncate">
                    {questionTitle}
                  </span>
                )}

                <div className="flex-1" />
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-white/40 text-xs">
                    {answer.earned_marks.toFixed(1)} / {answer.question_marks.toFixed(1)}
                  </span>
                  {answer.is_correct
                    ? <CheckCircle size={16} className="text-neon-cyan" />
                    : <XCircle size={16} className="text-brand-red" />}
                </div>
              </div>

              {/* Question text + answer */}
              <div className="p-4 space-y-4">
                <p className="text-white text-sm font-medium leading-relaxed">
                  {answer.question_text}
                </p>

                {/* Type-specific answer rendering */}
                {answer.question_type === 'true_false' && (
                  <TrueFalseAnswer
                    correct={answer.correct_answer}
                    student={answer.student_answer}
                  />
                )}

                {answer.question_type === 'multiple_choice' && (
                  <MultipleChoiceAnswer
                    correct={answer.correct_answer}
                    student={answer.student_answer}
                    options={answer.options}
                  />
                )}

                {answer.question_type === 'fill_blank' && (
                  <FillBlankAnswer
                    correct={answer.correct_answer}
                    student={answer.student_answer}
                    isCorrect={answer.is_correct}
                  />
                )}

                {answer.question_type === 'matching' && (
                  <MatchingAnswer
                    correct={answer.correct_answer}
                    student={answer.student_answer}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer nav */}
      <div className="flex justify-center pt-2 pb-8">
        <button
          onClick={() => navigate(`/np-panel/exams/${attempt.exam}/submissions`)}
          className="btn-secondary text-sm"
        >
          <ArrowRight size={14} /> العودة لقائمة المحاولات
        </button>
      </div>
    </div>
  )
}
