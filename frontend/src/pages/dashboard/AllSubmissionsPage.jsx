import { useEffect, useState, useCallback } from 'react'
import { ClipboardList, Loader2, Calendar, User, Search, Play, CheckCircle } from 'lucide-react'
import api from '../../api/axiosInstance'
import Pagination from '../../components/ui/Pagination'

export default function AllSubmissionsPage() {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [totalSubmissions, setTotalSubmissions] = useState(0)

  const loadSubmissions = useCallback(() => {
    setLoading(true)
    api.get('/academic/submissions/', {
      params: { page }
    })
      .then((res) => {
        setSubmissions(res.data.results || res.data)
        setTotalSubmissions(res.data.count || 0)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { loadSubmissions() }, [loadSubmissions])

  const filteredSubmissions = submissions.filter(s => {
    const term = searchTerm.toLowerCase()
    return (
      (s.student_name && s.student_name.toLowerCase().includes(term)) ||
      (s.exercise_title && s.exercise_title.toLowerCase().includes(term)) ||
      (s.lesson_title && s.lesson_title.toLowerCase().includes(term))
    )
  })

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
            <ClipboardList size={20} className="text-brand-blue" /> تسليمات التمارين
          </h1>
          <p className="text-white/30 text-xs mt-0.5">
            عرض إجابات ونتائج الطلاب في مختلف التمارين
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="بحث عن طالب، تمرين، أو محاضرة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-glass w-full pr-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="glass-card p-12 text-center text-white/30">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
          <p>لا توجد تسليمات متطابقة مع بحثك.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSubmissions.map((sub) => (
              <div key={sub.id} className="glass-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center shrink-0">
                      {sub.student_avatar ? (
                        <img src={sub.student_avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <User size={18} className="text-white/50" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-cairo font-bold text-white text-sm">{sub.student_name}</h3>
                      <p className="text-white/40 text-xs flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(sub.submitted_at).toLocaleDateString('ar-EG', {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-center">
                    <span className={`badge ${sub.is_passed ? 'badge-green' : 'badge-red'} font-bold`}>
                      {sub.score.toFixed(0)}%
                    </span>
                    <p className="text-[10px] text-white/30 mt-1">{sub.is_passed ? 'ناجح' : 'راسب'}</p>
                  </div>
                </div>

                <div className="border-t border-white/05 pt-3">
                  <p className="text-white/80 text-sm flex items-center gap-2">
                    <Play size={12} className="text-brand-blue" />
                    {sub.lesson_title}
                  </p>
                  <p className="text-white/40 text-xs mt-1">تمرين: {sub.exercise_title}</p>
                </div>

                {sub.answers && sub.answers.length > 0 && (
                  <div className="mt-2 bg-dark-800/50 rounded-xl p-3 space-y-2">
                    <p className="text-white/50 text-xs mb-2 border-b border-white/05 pb-2">سجل الإجابات:</p>
                    {sub.answers.map((ans, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <CheckCircle size={12} className={ans.is_correct ? "text-green-500 shrink-0 mt-0.5" : "text-red-500 shrink-0 mt-0.5"} />
                        <div className="min-w-0">
                          <p className="text-white/80 truncate">{ans.question_text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <Pagination count={totalSubmissions} currentPage={page} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
