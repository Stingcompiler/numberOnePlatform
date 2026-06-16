/**
 * ExamListPage.jsx — قائمة الاختبارات مع إمكانية التصفية
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileCheck, Plus, Loader2, Search, Trash2, Edit3, Users,
  Clock, Award, BookOpen, Eye, BarChart3,
} from 'lucide-react'
import { fetchExams, deleteExam } from '../../api/examService'
import api from '../../api/axiosInstance'
import Pagination from '../../components/ui/Pagination'

export default function ExamListPage() {
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [courses, setCourses] = useState([])
  const [filterCourse, setFilterCourse] = useState('')

  // تحميل الكورسات للفلتر
  useEffect(() => {
    api.get('/academic/courses/', { params: { page_size: 200 } })
      .then(r => setCourses(r.data.results || r.data))
      .catch(() => {})
  }, [])

  const loadExams = useCallback(() => {
    setLoading(true)
    const params = { page }
    if (filterCourse) params.course = filterCourse
    fetchExams(params)
      .then(({ data }) => {
        setExams(data.results || data)
        setTotal(data.count || 0)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, filterCourse])

  useEffect(() => { loadExams() }, [loadExams])

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الاختبار؟')) return
    try {
      await deleteExam(id)
      loadExams()
    } catch (e) {
      alert(e.response?.data?.detail || 'حدث خطأ أثناء الحذف.')
    }
  }

  const filtered = exams.filter(e =>
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.course_name && e.course_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
            <FileCheck size={20} className="text-brand-blue" /> إدارة الاختبارات
          </h1>
          <p className="text-white/30 text-xs mt-0.5">
            إنشاء ومتابعة الاختبارات ومراجعة نتائج الطلاب
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard/exams/create')}
          className="btn-primary text-sm"
        >
          <Plus size={16} /> إنشاء اختبار جديد
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="بحث عن اختبار..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input-glass w-full pr-10"
          />
        </div>
        <select
          value={filterCourse}
          onChange={e => { setFilterCourse(e.target.value); setPage(1) }}
          className="input-glass text-sm max-w-xs"
        >
          <option value="">كل الكورسات</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-white/30">
          <FileCheck size={40} className="mx-auto mb-3 opacity-20" />
          <p>لا توجد اختبارات{searchTerm || filterCourse ? ' تطابق بحثك' : ' بعد. أنشئ أول اختبار!'}.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(exam => (
              <div key={exam.id} className="glass-card p-5 flex flex-col gap-4">

                {/* Title + course */}
                <div>
                  <h3 className="font-cairo font-bold text-white text-base mb-1 line-clamp-2">
                    {exam.title}
                  </h3>
                  <p className="text-white/40 text-xs flex items-center gap-1.5">
                    <BookOpen size={12} className="text-brand-blue/60" />
                    {exam.course_name}
                  </p>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-dark-700/50 rounded-xl p-2.5 text-center">
                    <Clock size={14} className="mx-auto text-brand-blue/60 mb-1" />
                    <p className="text-white font-bold text-sm">{exam.duration_minutes}</p>
                    <p className="text-white/30 text-[10px]">دقيقة</p>
                  </div>
                  <div className="bg-dark-700/50 rounded-xl p-2.5 text-center">
                    <Award size={14} className="mx-auto text-neon-cyan/60 mb-1" />
                    <p className="text-white font-bold text-sm">{exam.passing_score}</p>
                    <p className="text-white/30 text-[10px]">درجة النجاح</p>
                  </div>
                  <div className="bg-dark-700/50 rounded-xl p-2.5 text-center">
                    <BarChart3 size={14} className="mx-auto text-brand-red/60 mb-1" />
                    <p className="text-white font-bold text-sm">{exam.question_count}</p>
                    <p className="text-white/30 text-[10px]">سؤال</p>
                  </div>
                </div>

                {/* Footer info */}
                <div className="flex items-center justify-between text-[10px] text-white/30 border-t border-white/05 pt-3">
                  <span>{exam.attempts_count || 0} محاولة</span>
                  <span className={`badge text-[10px] ${exam.is_active ? 'badge-green' : 'badge-red'}`}>
                    {exam.is_active ? 'نشط' : 'معطل'}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => navigate(`/dashboard/exams/${exam.id}/submissions`)}
                    className="btn-ghost border border-white/08 rounded-xl py-2 text-[11px] flex items-center justify-center gap-1.5 hover:border-brand-blue/30 hover:text-brand-blue hover:bg-brand-blue/5 transition-all"
                  >
                    <Users size={12} /> المحاولات
                  </button>
                  <button
                    onClick={() => navigate(`/dashboard/exams/${exam.id}/edit`)}
                    className="btn-ghost border border-white/08 rounded-xl py-2 text-[11px] flex items-center justify-center gap-1.5 hover:border-neon-cyan/30 hover:text-neon-cyan hover:bg-neon-cyan/5 transition-all"
                  >
                    <Edit3 size={12} /> تعديل
                  </button>
                  <button
                    onClick={() => handleDelete(exam.id)}
                    className="btn-ghost border border-white/08 rounded-xl py-2 text-[11px] flex items-center justify-center gap-1.5 hover:border-brand-red/30 hover:text-brand-red hover:bg-brand-red/5 transition-all"
                  >
                    <Trash2 size={12} /> حذف
                  </button>
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
