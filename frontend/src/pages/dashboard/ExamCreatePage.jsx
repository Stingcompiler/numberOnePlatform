/**
 * ExamCreatePage.jsx — إنشاء / تعديل اختبار مع بنك أسئلة ديناميكي
 *
 * يدعم أربعة أنواع أسئلة:
 *   - صح / خطأ (true_false)
 *   - اختيار من متعدد (multiple_choice)
 *   - أكمل الفراغ (fill_blank)
 *   - مطابقة (matching)
 *
 * كل البيانات تُحفظ في State وتُرسل دفعة واحدة عند الإرسال.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  FileCheck, Plus, Loader2, X, Trash2, ArrowRight,
  Save, ChevronDown, ChevronUp, GripVertical,
  CheckCircle, XCircle, Type, List, Link2, ToggleLeft,
  Image, ImagePlus, FileImage,
} from 'lucide-react'
import { createExam, fetchExam, updateExam } from '../../api/examService'
import fetchAll from '../../api/fetchAll'

/* ═══════════════════════════════════════════════════════════════════
   أنواع الأسئلة المتاحة
   ═══════════════════════════════════════════════════════════════════ */
const QUESTION_TYPES = [
  { value: 'true_false',      label: 'صح / خطأ',          icon: ToggleLeft,  color: 'text-neon-cyan',   bg: 'bg-neon-cyan/10',   border: 'border-neon-cyan/25' },
  { value: 'multiple_choice', label: 'اختيار من متعدد',    icon: List,        color: 'text-brand-blue',  bg: 'bg-brand-blue/10',  border: 'border-brand-blue/25' },
  { value: 'fill_blank',      label: 'أكمل الفراغ',        icon: Type,        color: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/25' },
  { value: 'matching',        label: 'مطابقة',              icon: Link2,       color: 'text-violet-400',  bg: 'bg-violet-400/10',  border: 'border-violet-400/25' },
]

/* ── مساعد تحويل ملف صورة إلى Base64 ── */
function readAsBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = e => res(e.target.result)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

/* ── مكوّن خلية رفع صورة مضغوطة (للمطابقة) ── */
function ImageUploadCell({ value, onChange, placeholder = 'اختر صورة' }) {
  const ref = useRef(null)
  const handleFile = async e => {
    const f = e.target.files[0]
    if (f) onChange(await readAsBase64(f))
    e.target.value = ''
  }
  return (
    <div className="relative w-full">
      {value ? (
        <div className="relative group rounded-lg overflow-hidden border border-violet-400/30">
          <img src={value} alt="" className="w-full h-20 object-cover" />
          <button type="button" onClick={() => onChange('')}
            className="absolute top-1 left-1 w-5 h-5 rounded-full bg-dark-900/80 text-white/60 hover:text-brand-red flex items-center justify-center">
            <X size={10} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()}
          className="w-full h-20 rounded-lg border border-dashed border-violet-400/30 bg-violet-400/05 flex flex-col items-center justify-center gap-1 text-violet-400/60 hover:text-violet-400 hover:border-violet-400/50 transition-all text-xs">
          <ImagePlus size={16} />
          <span>{placeholder}</span>
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   مكون سؤال صح / خطأ
   ═══════════════════════════════════════════════════════════════════ */
function TrueFalseInput({ question, onChange }) {
  const value = question.correct_answer?.value
  return (
    <div className="space-y-2">
      <p className="text-white/50 text-xs">اختر الإجابة الصحيحة:</p>
      <div className="flex gap-3">
        {[true, false].map(val => (
          <button
            key={String(val)}
            type="button"
            onClick={() => onChange({ ...question, correct_answer: { value: val } })}
            className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all border
              ${value === val
                ? val ? 'border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan' : 'border-brand-red/50 bg-brand-red/10 text-brand-red'
                : 'border-white/10 bg-dark-700/30 text-white/40 hover:border-white/20'}`}
          >
            {val
              ? <span className="flex items-center justify-center gap-2"><CheckCircle size={16} /> صح</span>
              : <span className="flex items-center justify-center gap-2"><XCircle size={16} /> خطأ</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   مكون سؤال اختيار من متعدد
   ═══════════════════════════════════════════════════════════════════ */
function MultipleChoiceInput({ question, onChange }) {
  const options = question.options || []
  const correctIdx = question.correct_answer?.correct_option_index

  const addOption = () => {
    onChange({
      ...question,
      options: [...options, { text: '', display_order: options.length }]
    })
  }

  const updateOption = (idx, text) => {
    const updated = options.map((o, i) => i === idx ? { ...o, text } : o)
    onChange({ ...question, options: updated })
  }

  const removeOption = (idx) => {
    const updated = options.filter((_, i) => i !== idx)
    let newCorrectIdx = correctIdx
    if (correctIdx === idx) newCorrectIdx = undefined
    else if (correctIdx > idx) newCorrectIdx = correctIdx - 1
    onChange({
      ...question,
      options: updated,
      correct_answer: newCorrectIdx !== undefined
        ? { correct_option_index: newCorrectIdx }
        : {}
    })
  }

  const selectCorrect = (idx) => {
    onChange({ ...question, correct_answer: { correct_option_index: idx } })
  }

  return (
    <div className="space-y-3">
      <p className="text-white/50 text-xs">أضف الخيارات وحدد الإجابة الصحيحة:</p>
      {options.map((opt, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => selectCorrect(idx)}
            className={`w-7 h-7 rounded-full border-2 shrink-0 flex items-center justify-center transition-all
              ${correctIdx === idx
                ? 'border-neon-cyan bg-neon-cyan/20'
                : 'border-white/20 hover:border-white/40'}`}
          >
            {correctIdx === idx && <CheckCircle size={14} className="text-neon-cyan" />}
          </button>
          <input
            type="text"
            value={opt.text}
            onChange={e => updateOption(idx, e.target.value)}
            placeholder={`الخيار ${idx + 1}`}
            className="input-glass flex-1 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => removeOption(idx)}
            className="btn-ghost p-1.5 text-brand-red/50 hover:text-brand-red"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addOption}
        className="flex items-center gap-1.5 text-xs text-brand-blue hover:text-brand-blue/80 transition-colors"
      >
        <Plus size={13} /> إضافة خيار
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   مكون سؤال أكمل الفراغ
   ═══════════════════════════════════════════════════════════════════ */
function FillBlankInput({ question, onChange }) {
  const imgRef = useRef(null)
  const ca = question.correct_answer || {}
  // currentImage: Base64 أو URL HTTP للصورة الحالية
  const currentImage = question.image || null
  const [showImg, setShowImg] = useState(!!currentImage)

  const handleImgFile = async e => {
    const f = e.target.files[0]
    if (f) {
      const b64 = await readAsBase64(f)
      onChange({ ...question, image: b64 })
      setShowImg(true)
    }
    e.target.value = ''
  }
  const removeImg = () => {
    onChange({ ...question, image: null })
    setShowImg(false)
  }

  return (
    <div className="space-y-3">
      <p className="text-white/50 text-xs">اكتب الإجابة الصحيحة:</p>
      <input
        type="text"
        value={ca.text || ''}
        onChange={e => onChange({ ...question, correct_answer: { ...ca, text: e.target.value } })}
        placeholder="الإجابة الصحيحة..."
        className="input-glass text-sm"
      />

      {!showImg ? (
        <button type="button" onClick={() => setShowImg(true)}
          className="flex items-center gap-1.5 text-xs text-amber-400/70 hover:text-amber-400 transition-colors">
          <ImagePlus size={12} /> إضافة صورة للسؤال (اختياري)
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-white/40 text-xs flex items-center gap-1"><FileImage size={12} /> صورة السؤال</p>
            <button type="button" onClick={removeImg} className="text-xs text-brand-red/60 hover:text-brand-red">إزالة</button>
          </div>
          {currentImage ? (
            <div className="relative rounded-xl overflow-hidden border border-amber-400/25">
              <img src={currentImage} alt="" className="w-full max-h-44 object-contain bg-dark-700/50" />
              <button type="button" onClick={removeImg}
                className="absolute top-2 left-2 w-6 h-6 rounded-full bg-dark-900/80 text-white/60 hover:text-brand-red flex items-center justify-center">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => imgRef.current?.click()}
              className="w-full h-24 rounded-xl border border-dashed border-amber-400/30 bg-amber-400/05 flex flex-col items-center justify-center gap-2 text-amber-400/60 hover:text-amber-400 hover:border-amber-400/50 transition-all text-xs">
              <ImagePlus size={18} /><span>انقر لرفع صورة</span>
            </button>
          )}
          <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImgFile} />
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   مكون سؤال المطابقة
   ═══════════════════════════════════════════════════════════════════ */
function MatchingInput({ question, onChange }) {
  const pairs = question.correct_answer?.pairs || []

  const addPair = () => {
    onChange({
      ...question,
      correct_answer: { pairs: [...pairs, { a: '', b: '', a_type: 'text', b_type: 'text' }] }
    })
  }

  const updatePair = (idx, key, value) => {
    onChange({ ...question, correct_answer: { pairs: pairs.map((p, i) => i === idx ? { ...p, [key]: value } : p) } })
  }

  const toggleType = (idx, side) => {
    const p = pairs[idx]
    const tk = `${side}_type`
    const newType = p[tk] === 'text' ? 'image' : 'text'
    const updated = pairs.map((pr, i) =>
      i === idx ? { ...pr, [tk]: newType, [side]: '' } : pr
    )
    onChange({ ...question, correct_answer: { pairs: updated } })
  }

  const removePair = idx => {
    onChange({ ...question, correct_answer: { pairs: pairs.filter((_, i) => i !== idx) } })
  }

  /* خلية عنصر (نص أو صورة) */
  const SideCell = ({ idx, side, pair }) => {
    const tk = `${side}_type`
    const isImg = pair[tk] === 'image'
    const label = side === 'a' ? 'أ' : 'ب'
    return (
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-white/30 text-[10px]">عنصر {label}</span>
          <button type="button" onClick={() => toggleType(idx, side)}
            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-all ${
              isImg ? 'border-violet-400/40 bg-violet-400/10 text-violet-400' : 'border-white/15 text-white/30 hover:text-white/50'
            }`}>
            {isImg ? <><Image size={9} /> صورة</> : <><Type size={9} /> نص</>}
          </button>
        </div>
        {isImg ? (
          <ImageUploadCell value={pair[side]} onChange={v => updatePair(idx, side, v)} placeholder={`صورة ${label}${idx + 1}`} />
        ) : (
          <input type="text" value={pair[side]}
            onChange={e => updatePair(idx, side, e.target.value)}
            placeholder={`عنصر ${label}${idx + 1}`} className="input-glass py-2 text-sm" />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-white/50 text-xs">أضف أزواج المطابقة — كل عنصر يمكن أن يكون نصاً أو صورة:</p>
      <div className="space-y-3">
        {pairs.map((pair, idx) => (
          <div key={idx} className="p-3 rounded-xl bg-white/03 border border-white/06">
            <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 items-start">
              <SideCell idx={idx} side="a" pair={pair} />
              <span className="text-white/20 text-xs mt-8">↔</span>
              <SideCell idx={idx} side="b" pair={pair} />
              <button type="button" onClick={() => removePair(idx)}
                className="btn-ghost p-1.5 text-brand-red/50 hover:text-brand-red mt-6">
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={addPair}
        className="flex items-center gap-1.5 text-xs text-brand-blue hover:text-brand-blue/80 transition-colors">
        <Plus size={13} /> إضافة زوج
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   مكون بطاقة السؤال
   ═══════════════════════════════════════════════════════════════════ */
function QuestionCard({ question, index, onChange, onRemove }) {
  const [collapsed, setCollapsed] = useState(false)
  const typeInfo = QUESTION_TYPES.find(t => t.value === question.question_type) || QUESTION_TYPES[0]
  const TypeIcon = typeInfo.icon

  const renderTypeInput = () => {
    switch (question.question_type) {
      case 'true_false':      return <TrueFalseInput question={question} onChange={onChange} />
      case 'multiple_choice': return <MultipleChoiceInput question={question} onChange={onChange} />
      case 'fill_blank':      return <FillBlankInput question={question} onChange={onChange} />
      case 'matching':        return <MatchingInput question={question} onChange={onChange} />
      default:                return null
    }
  }

  const displayTitle = question.title?.trim() || question.text?.trim() || 'سؤال جديد...'

  return (
    <div className="glass-card border border-white/08 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-dark-700/30 cursor-pointer hover:bg-dark-700/50 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <GripVertical size={14} className="text-white/20 shrink-0" />

        {/* Question number badge */}
        <span className="w-6 h-6 rounded-lg bg-white/08 flex items-center justify-center text-white/50 text-[11px] font-bold shrink-0">
          {index + 1}
        </span>

        {/* Question type badge */}
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 border ${typeInfo.bg} ${typeInfo.color} ${typeInfo.border}`}>
          <TypeIcon size={10} />
          {typeInfo.label}
        </span>

        {/* Title */}
        <span className="text-white/80 text-sm flex-1 truncate font-medium">
          {displayTitle}
        </span>

        {/* Marks badge */}
        <span className="text-white/40 text-xs shrink-0 bg-white/05 px-2 py-0.5 rounded-full">
          {question.marks} درجة
        </span>

        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="btn-ghost p-1.5 text-brand-red/40 hover:text-brand-red"
        >
          <Trash2 size={13} />
        </button>
        {collapsed ? <ChevronDown size={14} className="text-white/30" /> : <ChevronUp size={14} className="text-white/30" />}
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="p-4 space-y-4">

          {/* Question title */}
          <div>
            <label className="text-white/50 text-xs mb-1 block">عنوان السؤال <span className="text-white/25">(اختياري)</span></label>
            <input
              type="text"
              value={question.title || ''}
              onChange={e => onChange({ ...question, title: e.target.value })}
              placeholder="مثال: التعريف بالتمثيل الضوئي، مفهوم الحركة..."
              className="input-glass text-sm"
            />
            <p className="text-white/20 text-[10px] mt-1">عنوان وصفي مختصر يظهر في رأس البطاقة لتمييز السؤال بسرعة</p>
          </div>

          {/* Question type */}
          <div>
            <label className="text-white/50 text-xs mb-1 block">نوع السؤال</label>
            <select
              value={question.question_type}
              onChange={e => onChange({
                ...question,
                question_type: e.target.value,
                correct_answer: {},
                options: e.target.value === 'multiple_choice' ? [{ text: '', display_order: 0 }, { text: '', display_order: 1 }] : [],
              })}
              className="input-glass text-sm"
            >
              {QUESTION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Question text */}
          <div>
            <label className="text-white/50 text-xs mb-1 block">نص السؤال</label>
            <textarea
              value={question.text}
              onChange={e => onChange({ ...question, text: e.target.value })}
              placeholder="اكتب السؤال هنا..."
              rows={2}
              className="input-glass resize-none text-sm"
            />
          </div>

          {/* Marks */}
          <div>
            <label className="text-white/50 text-xs mb-1 block">الدرجة</label>
            <input
              type="number"
              value={question.marks}
              onChange={e => onChange({ ...question, marks: parseFloat(e.target.value) || 0 })}
              min={0}
              step={0.5}
              className="input-glass text-sm w-32"
            />
          </div>

          {/* Type-specific input */}
          <div className="border-t border-white/05 pt-4">
            {renderTypeInput()}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   الصفحة الرئيسية — إنشاء / تعديل اختبار
   ═══════════════════════════════════════════════════════════════════ */
export default function ExamCreatePage() {
  const navigate = useNavigate()
  const { id: examId } = useParams()
  const isEdit = Boolean(examId)

  // بيانات الاختبار
  const [title, setTitle] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [passingScore, setPassingScore] = useState(50)
  const [courseId, setCourseId] = useState('')

  // الأسئلة
  const [questions, setQuestions] = useState([])

  // حالات عامة
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // تحميل الكورسات
  useEffect(() => {
    fetchAll('/academic/courses/')
      .then(setCourses)
      .catch(() => {})
  }, [])

  // تحميل بيانات الاختبار عند التعديل
  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    fetchExam(examId)
      .then(({ data }) => {
        setTitle(data.title)
        setDurationMinutes(data.duration_minutes)
        setPassingScore(data.passing_score)
        setCourseId(String(data.course))
        setQuestions(
          (data.questions || []).map((q, idx) => ({
            question_type: q.question_type,
            title: q.title || '',
            text: q.text,
            marks: q.marks,
            display_order: idx,
            correct_answer: q.correct_answer || {},
            options: (q.options || []).map(o => ({
              text: o.text,
              display_order: o.display_order,
            })),
            // صورة السؤال المخزّنة مسبقاً (URL HTTP) — تُعرض للمستخدم حتى يستبدلها
            image: q.image_url || null,
          }))
        )
      })
      .catch(() => setError('فشل تحميل بيانات الاختبار.'))
      .finally(() => setLoading(false))
  }, [isEdit, examId])

  // إضافة سؤال جديد
  const addQuestion = () => {
    setQuestions(prev => [...prev, {
      question_type: 'multiple_choice',
      title: '',
      text: '',
      marks: 1,
      display_order: prev.length,
      correct_answer: {},
      options: [{ text: '', display_order: 0 }, { text: '', display_order: 1 }],
      image: null,
    }])
  }

  // تحديث سؤال
  const updateQuestion = (idx, updated) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...updated, display_order: i } : q))
  }

  // حذف سؤال
  const removeQuestion = (idx) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx))
  }

  // التحقق والإرسال
  const validateAndSubmit = async () => {
    setError(''); setSuccess('')

    if (!courseId) return setError('يرجى اختيار الكورس.')
    if (!title.trim()) return setError('يرجى إدخال عنوان الاختبار.')
    if (questions.length === 0) return setError('يجب إضافة سؤال واحد على الأقل.')

    // التحقق من كل سؤال
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.text.trim()) return setError(`السؤال ${i + 1}: نص السؤال مطلوب.`)

      if (q.question_type === 'true_false' && q.correct_answer?.value === undefined) {
        return setError(`السؤال ${i + 1}: يرجى اختيار صح أو خطأ.`)
      }
      if (q.question_type === 'multiple_choice') {
        if (!q.options || q.options.length < 2) {
          return setError(`السؤال ${i + 1}: يجب إضافة خيارين على الأقل.`)
        }
        if (q.options.some(o => !o.text.trim())) {
          return setError(`السؤال ${i + 1}: جميع الخيارات يجب أن تحتوي على نص.`)
        }
        if (q.correct_answer?.correct_option_index === undefined) {
          return setError(`السؤال ${i + 1}: يرجى تحديد الإجابة الصحيحة.`)
        }
      }
        if (q.question_type === 'fill_blank' && !q.correct_answer?.text?.trim() && !q.image) {
        return setError(`السؤال ${i + 1}: يرجى كتابة الإجابة الصحيحة أو إرفاق صورة.`)
      }
      if (q.question_type === 'matching') {
        const pairs = q.correct_answer?.pairs || []
        if (pairs.length < 2) {
          return setError(`السؤال ${i + 1}: يجب إضافة زوجين على الأقل للمطابقة.`)
        }
        // Accept pairs where each side is text (non-empty) or image (base64)
        const invalid = pairs.some(p => {
          const aOk = p.a_type === 'image' ? !!p.a : !!p.a?.trim()
          const bOk = p.b_type === 'image' ? !!p.b : !!p.b?.trim()
          return !aOk || !bOk
        })
        if (invalid) {
          return setError(`السؤال ${i + 1}: جميع عناصر المطابقة يجب أن تحتوي على نص أو صورة.`)
        }
      }
    }

    setSaving(true)
    const payload = {
      course: parseInt(courseId),
      title,
      duration_minutes: durationMinutes,
      passing_score: passingScore,
      questions: questions.map((q, idx) => ({
        question_type: q.question_type,
        title: q.title || '',
        text: q.text,
        marks: q.marks,
        display_order: idx,
        correct_answer: q.correct_answer,
        options: q.options || [],
        // إرسال الصورة إذا كانت Base64 جديدة (تبدأ بـ data:)
        // إذا كانت URL HTTP فقط نُرسل null (لم يتغيّر)
        image: q.image && q.image.startsWith('data:') ? q.image : null,
      })),
    }

    try {
      if (isEdit) {
        await updateExam(examId, payload)
        setSuccess('تم تحديث الاختبار بنجاح!')
      } else {
        await createExam(payload)
        setSuccess('تم إنشاء الاختبار بنجاح!')
        setTimeout(() => navigate('/np-panel/exams'), 1500)
      }
    } catch (err) {
      const d = err.response?.data
      if (typeof d === 'object') {
        const msgs = []
        Object.entries(d).forEach(([k, v]) => {
          const val = Array.isArray(v) ? v.join(' ') : v
          msgs.push(`${k}: ${val}`)
        })
        setError(msgs.join('\n') || 'حدث خطأ أثناء الحفظ.')
      } else {
        setError('حدث خطأ أثناء الحفظ.')
      }
    } finally {
      setSaving(false)
    }
  }

  // حساب المجموع
  const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0)

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/np-panel/exams')}
          className="btn-ghost p-2"
        >
          <ArrowRight size={18} />
        </button>
        <div>
          <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
            <FileCheck size={20} className="text-brand-blue" />
            {isEdit ? 'تعديل الاختبار' : 'إنشاء اختبار جديد'}
          </h1>
          <p className="text-white/30 text-xs mt-0.5">
            {isEdit ? 'عدّل بيانات الاختبار وأسئلته' : 'أنشئ اختبار جديد مع بنك أسئلة متنوع'}
          </p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-brand-red/10 border border-brand-red/30 text-brand-red text-sm rounded-xl p-4 whitespace-pre-wrap">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm rounded-xl p-4">
          {success}
        </div>
      )}

      {/* Exam metadata */}
      <div className="glass-card p-5 space-y-4">
        <h2 className="font-cairo font-bold text-white text-sm">بيانات الاختبار الأساسية</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-white/50 text-xs mb-1 block">الكورس *</label>
            <select
              value={courseId}
              onChange={e => setCourseId(e.target.value)}
              className="input-glass text-sm"
              disabled={isEdit}
            >
              <option value="">اختر الكورس...</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-white/50 text-xs mb-1 block">عنوان الاختبار *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="مثال: اختبار الوحدة الأولى"
              className="input-glass text-sm"
            />
          </div>

          <div>
            <label className="text-white/50 text-xs mb-1 block">المدة (بالدقائق)</label>
            <input
              type="number"
              value={durationMinutes}
              onChange={e => setDurationMinutes(parseInt(e.target.value) || 0)}
              min={1}
              className="input-glass text-sm"
            />
          </div>

          <div>
            <label className="text-white/50 text-xs mb-1 block">درجة النجاح</label>
            <input
              type="number"
              value={passingScore}
              onChange={e => setPassingScore(parseFloat(e.target.value) || 0)}
              min={0}
              step={0.5}
              className="input-glass text-sm"
            />
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="glass-card p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-white/40">
            عدد الأسئلة: <strong className="text-white">{questions.length}</strong>
          </span>
          <span className="text-white/40">
            مجموع الدرجات: <strong className="text-brand-blue">{totalMarks}</strong>
          </span>
        </div>
        <button
          type="button"
          onClick={addQuestion}
          className="btn-secondary text-sm py-2"
        >
          <Plus size={14} /> إضافة سؤال
        </button>
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {questions.length === 0 ? (
          <div className="glass-card p-12 text-center text-white/30">
            <List size={40} className="mx-auto mb-3 opacity-20" />
            <p>لم تُضف أي أسئلة بعد. اضغط "إضافة سؤال" للبدء.</p>
          </div>
        ) : (
          questions.map((q, idx) => (
            <QuestionCard
              key={idx}
              question={q}
              index={idx}
              onChange={updated => updateQuestion(idx, updated)}
              onRemove={() => removeQuestion(idx)}
            />
          ))
        )}
      </div>

      {/* Submit */}
      {questions.length > 0 && (
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={validateAndSubmit}
            disabled={saving}
            className="btn-primary flex-1 justify-center py-4"
          >
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> جاري الحفظ...</>
              : <><Save size={16} /> {isEdit ? 'حفظ التعديلات' : 'إنشاء الاختبار'}</>}
          </button>
          <button
            type="button"
            onClick={() => navigate('/np-panel/exams')}
            className="btn-secondary px-6"
          >
            إلغاء
          </button>
        </div>
      )}
    </div>
  )
}
