/**
 * pages/dashboard/TeachersPage.jsx
 * إدارة الأساتذة — CRUD كامل مع البيانات الشخصية
 */

import { useEffect, useState, useCallback } from 'react'
import {
  GraduationCap, Plus, Search, X, Loader2,
  Phone, Edit2, Trash2, Eye, EyeOff, BookOpen,
  ChevronLeft, ChevronRight, User,
} from 'lucide-react'
import api from '../../api/axiosInstance'

/* ─ نافذة إنشاء/تعديل أستاذ ──────────────────────────────────── */
function TeacherModal({ teacher, onClose, onSaved }) {
  const isEdit = !!teacher?.id
  const [form, setForm] = useState({
    username:       teacher?.user?.username       || '',
    phone:          teacher?.user?.phone          || '',
    full_name:      teacher?.user?.full_name      || '',
    password:       '',
    email:          teacher?.user?.email          || '',
    specialization: teacher?.specialization       || '',
    bio:            teacher?.bio                  || '',
    staff_type:     teacher?.staff_type           || 'academic',
    is_public:      teacher?.is_public            ?? false,
    display_order:  teacher?.display_order        ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const handleChange = (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setError('')
    setForm((f) => ({ ...f, [e.target.name]: val }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit) {
        // تعديل: نرسل فقط الحقول المسموح بتعديلها
        await api.patch(`/teachers/${teacher.id}/`, {
          specialization: form.specialization,
          bio:            form.bio,
          staff_type:     form.staff_type,
          is_public:      form.is_public,
          display_order:  form.display_order,
        })
      } else {
        await api.post('/teachers/', form)
      }
      onSaved()
      onClose()
    } catch (err) {
      const d = err.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'حدث خطأ.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
      <div className="glass-card-strong w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-cairo font-bold text-white text-lg flex items-center gap-2">
            {isEdit ? <Edit2 size={18} className="text-brand-blue" /> : <Plus size={18} className="text-brand-blue" />}
            {isEdit ? 'تعديل بيانات الأستاذ' : 'أستاذ جديد'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {!isEdit && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-white/50 text-xs mb-1 block">اسم المستخدم *</label>
                <input name="username" value={form.username} onChange={handleChange}
                  required placeholder="اسم مستخدم فريد" className="input-glass" dir="ltr" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">الاسم الكامل *</label>
                <input name="full_name" value={form.full_name} onChange={handleChange}
                  required placeholder="اسم الأستاذ" className="input-glass" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">رقم الهاتف</label>
                <input name="phone" value={form.phone} onChange={handleChange}
                  placeholder="+249..." className="input-glass" dir="ltr" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">كلمة المرور *</label>
                <input name="password" value={form.password} onChange={handleChange}
                  required type="password" placeholder="6 أحرف+" className="input-glass" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">البريد الإلكتروني</label>
                <input name="email" value={form.email} onChange={handleChange}
                  type="email" placeholder="optional@email.com" className="input-glass" dir="ltr" />
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-white/50 text-xs mb-1 block">التخصص</label>
              <input name="specialization" value={form.specialization} onChange={handleChange}
                placeholder="مثال: رياضيات، فيزياء..." className="input-glass" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">نوع الكادر</label>
              <select name="staff_type" value={form.staff_type} onChange={handleChange} className="input-glass">
                <option value="academic">هيئة تدريس</option>
                <option value="administrative">هيئة إدارة</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs mb-1 block">نبذة مختصرة</label>
            <textarea name="bio" value={form.bio} onChange={handleChange}
              rows={3} placeholder="نبذة عن الأستاذ..." className="input-glass resize-none" />
          </div>

          <div className="flex items-center gap-6">
            <div>
              <label className="text-white/50 text-xs mb-1 block">ترتيب العرض</label>
              <input name="display_order" value={form.display_order} onChange={handleChange}
                type="number" min="0" className="input-glass w-24 text-sm" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-4">
              <input name="is_public" type="checkbox" checked={form.is_public} onChange={handleChange}
                className="w-4 h-4 accent-brand-blue" />
              <span className="text-white/60 text-sm">ظاهر في صفحة الهبوط</span>
            </label>
          </div>

          {error && <p className="text-brand-red text-xs bg-brand-red/10 rounded-xl p-3">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-6">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─ الصفحة الرئيسية ─────────────────────────────────────────── */
export default function TeachersPage() {
  const [teachers,   setTeachers]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [modal,      setModal]      = useState(null)  // null | {} | { teacher }
  const [page,       setPage]       = useState(1)
  const [total,      setTotal]      = useState(0)
  const pageSize = 10

  const load = useCallback(() => {
    setLoading(true)
    api.get('/teachers/', { params: { page, search } })
      .then(({ data }) => {
        setTeachers(data.results || data)
        setTotal(data.count || (data.results ? data.count : data.length))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => { load() }, [load])

  const destroy = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الأستاذ؟')) return
    await api.delete(`/teachers/${id}/`)
    load()
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* الرأس */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cairo font-bold text-white text-xl flex items-center gap-2">
            <GraduationCap size={20} className="text-brand-blue" /> إدارة الأساتذة
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            إجمالي: <span className="text-brand-blue font-medium">{total}</span> أستاذ
          </p>
        </div>
        <button onClick={() => setModal({})} className="btn-primary">
          <Plus size={16} /> أستاذ جديد
        </button>
      </div>

      {/* بحث */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="ابحث بالاسم أو التخصص..."
          className="input-glass pr-10"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
            <X size={14} />
          </button>
        )}
      </div>

      {/* الجدول */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 size={28} className="animate-spin text-brand-blue mx-auto" />
          </div>
        ) : teachers.length === 0 ? (
          <div className="p-12 text-center text-white/40">
            <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد نتائج.</p>
          </div>
        ) : (
          <table className="table-glass">
            <thead>
              <tr>
                <th>الأستاذ</th>
                <th>الهاتف</th>
                <th>التخصص</th>
                <th>نوع الكادر</th>
                <th>صفحة الهبوط</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      {t.user?.avatar ? (
                        <img src={`/media/${t.user.avatar}`} alt=""
                          className="w-8 h-8 rounded-full object-cover shrink-0 border border-white/10" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-dark-500 flex items-center justify-center shrink-0">
                          <User size={14} className="text-brand-blue" />
                        </div>
                      )}
                      <div>
                        <p className="text-white text-sm font-medium">{t.user?.full_name}</p>
                        <p className="text-white/30 text-xs">{t.user?.email || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td dir="ltr" className="text-left">
                    <span className="text-white/70 text-sm flex items-center gap-1">
                      <Phone size={12} className="text-white/30" /> {t.user?.phone}
                    </span>
                  </td>
                  <td className="text-white/60 text-sm">{t.specialization || '—'}</td>
                  <td>
                    <span className={`badge text-xs ${t.staff_type === 'academic' ? 'badge-blue' : 'badge-green'}`}>
                      {t.staff_type_display}
                    </span>
                  </td>
                  <td>
                    {t.is_public
                      ? <span className="badge-green badge text-xs flex items-center gap-1"><Eye size={10} /> ظاهر</span>
                      : <span className="text-white/25 text-xs flex items-center gap-1"><EyeOff size={10} /> مخفي</span>
                    }
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setModal({ teacher: t })}
                        className="btn-ghost p-1.5 text-brand-blue" title="تعديل">
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => destroy(t.id)}
                        className="btn-ghost p-1.5 text-brand-red/40 hover:text-brand-red" title="حذف">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/05">
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

      {/* المودال */}
      {modal !== null && (
        <TeacherModal
          teacher={modal.teacher}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
