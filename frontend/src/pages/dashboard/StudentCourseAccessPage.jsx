/**
 * pages/dashboard/StudentCourseAccessPage.jsx
 * إدارة وصول الطلاب للكورسات — عرض + منح + تفعيل/تعطيل + حذف
 */

import { useEffect, useState, useCallback } from 'react'
import {
  ShieldCheck, Plus, Search, X, Loader2, Trash2,
  ToggleLeft, ToggleRight, Users, BookMarked, Filter,
} from 'lucide-react'
import api from '../../api/axiosInstance'

/* ── نافذة منح وصول ────────────────────────────────────────────── */
function GrantAccessModal({ onClose, onGranted }) {
  const [students, setStudents] = useState([])
  const [courses, setCourses]   = useState([])
  const [studentId, setStudentId] = useState('')
  const [selectedCourses, setSelectedCourses] = useState([])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [searchStudent, setSearchStudent] = useState('')
  const [searchCourse, setSearchCourse] = useState('')

  useEffect(() => {
    api.get('/students/', { params: { page_size: 500, system_type: 'flash' } })
      .then(({ data }) => setStudents(data.results || data))
      .catch(() => {})
    api.get('/academic/courses/', { params: { page_size: 500, system_type: 'flash' } })
      .then(({ data }) => setCourses(data.results || data))
      .catch(() => {})
  }, [])

  const filteredStudents = searchStudent
    ? students.filter(s =>
        (s.user?.full_name || s.full_name || '').toLowerCase().includes(searchStudent.toLowerCase()) ||
        (s.user?.username || s.username || '').toLowerCase().includes(searchStudent.toLowerCase())
      )
    : students

  const filteredCourses = searchCourse
    ? courses.filter(c => (c.name || '').toLowerCase().includes(searchCourse.toLowerCase()))
    : courses

  const toggleCourse = (id) => {
    setSelectedCourses(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    const allIds = filteredCourses.map(c => c.id)
    const allSelected = allIds.every(id => selectedCourses.includes(id))
    if (allSelected) {
      setSelectedCourses(prev => prev.filter(id => !allIds.includes(id)))
    } else {
      setSelectedCourses(prev => [...new Set([...prev, ...allIds])])
    }
  }

  const handleGrant = async (e) => {
    e.preventDefault()
    if (!studentId) { setError('اختر الطالب.'); return }
    if (!selectedCourses.length) { setError('اختر كورساً واحداً على الأقل.'); return }
    setSaving(true)
    setError('')
    const errors = []
    for (const cid of selectedCourses) {
      try {
        await api.post('/academic/access/', { student: studentId, course: cid })
      } catch (err) {
        const d = err.response?.data
        const msg = typeof d === 'object' ? Object.values(d).flat().join(' ') : 'خطأ'
        const cName = courses.find(c => c.id === cid)?.name || cid
        errors.push(`${cName}: ${msg}`)
      }
    }
    if (errors.length) {
      setError(errors.join(' | '))
    } else {
      onGranted()
      onClose()
      return
    }
    onGranted()
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
      <div className="glass-card-strong w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-cairo font-bold text-white text-lg flex items-center gap-2">
            <Plus size={18} className="text-brand-blue" /> منح وصول لكورسات
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>

        <form onSubmit={handleGrant} className="space-y-4">
          {/* البحث عن طالب */}
          <div>
            <label className="text-white/50 text-xs mb-1 block">بحث عن طالب</label>
            <input
              value={searchStudent}
              onChange={e => setSearchStudent(e.target.value)}
              placeholder="اكتب اسم الطالب..."
              className="input-glass mb-2"
            />
            <label className="text-white/50 text-xs mb-1 block">اختر الطالب *</label>
            <select
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              className="input-glass"
              required
            >
              <option value="">— اختر طالباً —</option>
              {filteredStudents.map(s => (
                <option key={s.id} value={s.id}>
                  {s.user?.full_name || s.full_name} ({s.user?.username || s.username})
                </option>
              ))}
            </select>
          </div>

          {/* اختيار الكورسات (متعدد) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-white/50 text-xs">اختر الكورسات *</label>
              <span className="text-brand-blue text-xs font-medium">{selectedCourses.length} محدد</span>
            </div>
            <input
              value={searchCourse}
              onChange={e => setSearchCourse(e.target.value)}
              placeholder="بحث في الكورسات..."
              className="input-glass mb-2 text-sm"
            />
            <div className="border border-white/10 rounded-xl max-h-48 overflow-y-auto bg-dark-800/50">
              {/* تحديد الكل */}
              <label className="flex items-center gap-3 px-3 py-2 border-b border-white/10 cursor-pointer hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={filteredCourses.length > 0 && filteredCourses.every(c => selectedCourses.includes(c.id))}
                  onChange={selectAll}
                  className="accent-brand-blue w-4 h-4"
                />
                <span className="text-brand-blue text-sm font-medium">تحديد الكل</span>
              </label>
              {filteredCourses.map(c => (
                <label key={c.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedCourses.includes(c.id)}
                    onChange={() => toggleCourse(c.id)}
                    className="accent-brand-blue w-4 h-4"
                  />
                  <span className="text-white/80 text-sm">{c.name}</span>
                </label>
              ))}
              {!filteredCourses.length && (
                <p className="text-white/30 text-xs text-center py-4">لا توجد كورسات</p>
              )}
            </div>
          </div>

          {error && <p className="text-brand-red text-sm">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-sm">إلغاء</button>
            <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5 text-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : `منح الوصول (${selectedCourses.length})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── الصفحة الرئيسية ─────────────────────────────────────────── */
export default function StudentCourseAccessPage() {
  const [accesses, setAccesses] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [showModal, setShowModal] = useState(false)

  // فلاتر
  const [courses, setCourses]       = useState([])
  const [filterCourse, setFilterCourse] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const params = {}
    if (filterCourse) params.course = filterCourse
    api.get('/academic/access/', { params })
      .then(({ data }) => setAccesses(data.results || data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filterCourse])

  useEffect(() => { load() }, [load])

  // تحميل الكورسات للفلتر (فلاش فقط)
  useEffect(() => {
    api.get('/academic/courses/', { params: { page_size: 500, system_type: 'flash' } })
      .then(({ data }) => setCourses(data.results || data))
      .catch(() => {})
  }, [])

  // تفعيل/تعطيل
  const toggleActive = async (item) => {
    try {
      await api.patch(`/academic/access/${item.id}/`, { is_active: !item.is_active })
      load()
    } catch (e) { console.error(e) }
  }

  // حذف
  const handleDelete = async (id) => {
    if (!confirm('هل تريد حذف هذا الوصول نهائياً؟')) return
    try {
      await api.delete(`/academic/access/${id}/`)
      load()
    } catch (e) { console.error(e) }
  }

  // فلتر بحث محلي
  const filtered = search
    ? accesses.filter(a =>
        (a.student_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.course_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : accesses

  const activeCount   = accesses.filter(a => a.is_active).length
  const inactiveCount = accesses.length - activeCount

  return (
    <div className="space-y-5 animate-fade-in">
      {/* العنوان */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
          <ShieldCheck size={20} className="text-brand-blue" /> وصول الكورسات
        </h1>
        <button onClick={() => setShowModal(true)} className="btn-primary px-5 py-2.5 text-sm">
          <Plus size={16} /> منح وصول
        </button>
      </div>

      {/* بطاقات إحصائية */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue">
            <ShieldCheck size={18} />
          </div>
          <div>
            <p className="text-white/50 text-xs">إجمالي السجلات</p>
            <p className="font-cairo font-bold text-white text-lg">{accesses.length}</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neon-cyan/10 flex items-center justify-center text-neon-cyan">
            <ToggleRight size={18} />
          </div>
          <div>
            <p className="text-white/50 text-xs">نشط</p>
            <p className="font-cairo font-bold text-white text-lg">{activeCount}</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-red/10 flex items-center justify-center text-brand-red">
            <ToggleLeft size={18} />
          </div>
          <div>
            <p className="text-white/50 text-xs">معطّل</p>
            <p className="font-cairo font-bold text-white text-lg">{inactiveCount}</p>
          </div>
        </div>
      </div>

      {/* شريط البحث والفلاتر */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الكورس..."
            className="input-glass pr-10 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-white/40" />
          <select
            value={filterCourse}
            onChange={e => setFilterCourse(e.target.value)}
            className="input-glass w-48 text-sm"
          >
            <option value="">كل الكورسات</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* الجدول */}
      {loading ? (
        <div className="text-center py-16">
          <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="table-glass">
            <thead>
              <tr>
                <th>الطالب</th>
                <th>الكورس</th>
                <th>تاريخ المنح</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-brand-blue shrink-0" />
                      <span className="font-medium text-white">{a.student_name || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <BookMarked size={14} className="text-neon-cyan shrink-0" />
                      <span className="text-white/70">{a.course_name || '—'}</span>
                    </div>
                  </td>
                  <td className="text-white/50 text-sm" dir="ltr">
                    {a.granted_at ? new Date(a.granted_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                  </td>
                  <td>
                    {a.is_active
                      ? <span className="badge-green badge text-xs">نشط</span>
                      : <span className="badge-red badge text-xs">معطّل</span>
                    }
                  </td>
                  <td>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => toggleActive(a)}
                        className={`btn-ghost p-1.5 ${a.is_active ? 'text-amber-400' : 'text-neon-cyan'}`}
                        title={a.is_active ? 'تعطيل' : 'تفعيل'}
                      >
                        {a.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="btn-ghost p-1.5 text-brand-red"
                        title="حذف"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={5} className="text-center text-white/30 py-8">
                    {search ? 'لا توجد نتائج للبحث' : 'لا توجد سجلات وصول'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* نافذة منح الوصول */}
      {showModal && (
        <GrantAccessModal
          onClose={() => setShowModal(false)}
          onGranted={load}
        />
      )}
    </div>
  )
}
