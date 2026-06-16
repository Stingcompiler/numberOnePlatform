import re

with open("frontend/src/pages/dashboard/StudentsPage.jsx", "r") as f:
    content = f.read()

head_imports = "import { Edit, Trash, "
content = content.replace("import {\n  Users,", "import {\n  Users, Edit, Trash,")

# Add EditStudentModal and DeleteStudentModal
edit_del_modals = """/* ─ نافذة تعديل طالب ──────────────────────────────────────────── */
function EditStudentModal({ student, grades, supervisors, onClose, onUpdated }) {
  const [form, setForm] = useState({
    username: student.user?.username || '',
    phone: student.user?.phone || '',
    full_name: student.user?.full_name || '',
    guardian_name: student.guardian_name || '',
    guardian_phone: student.guardian_phone || '',
    address: student.address || '',
    system_type: student.system_type || 'online',
    enrolled_grade: student.enrolled_grade || '',
    supervisor: student.supervisor || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        user: {
          username: form.username,
          full_name: form.full_name,
          phone: form.phone,
        },
        guardian_name: form.guardian_name,
        guardian_phone: form.guardian_phone,
        address: form.address,
        system_type: form.system_type,
        enrolled_grade: form.enrolled_grade || null,
        supervisor: form.supervisor || null,
      }
      await api.patch(`/students/${student.id}/`, payload)
      onUpdated()
      onClose()
    } catch (err) {
      const d = err.response?.data
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'حدث خطأ.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
      <div className="glass-card-strong w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-cairo font-bold text-white text-lg flex items-center gap-2">
            <Edit size={18} className="text-brand-blue" /> تعديل بيانات الطالب
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-white/50 text-xs mb-1 block">اسم المستخدم *</label>
              <input name="username" value={form.username} onChange={handleChange} required className="input-glass" dir="ltr" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">الاسم الكامل *</label>
              <input name="full_name" value={form.full_name} onChange={handleChange} required className="input-glass" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">رقم الهاتف</label>
              <input name="phone" value={form.phone} onChange={handleChange} className="input-glass" dir="ltr" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">نوع النظام *</label>
              <select name="system_type" value={form.system_type} onChange={handleChange} className="input-glass">
                <option value="online">أونلاين</option>
                <option value="flash">فلاش</option>
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">اسم ولي الأمر *</label>
              <input name="guardian_name" value={form.guardian_name} onChange={handleChange} required className="input-glass" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">هاتف ولي الأمر</label>
              <input name="guardian_phone" value={form.guardian_phone} onChange={handleChange} className="input-glass" dir="ltr" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">الفصل</label>
              <select name="enrolled_grade" value={form.enrolled_grade} onChange={handleChange} className="input-glass">
                <option value="">— اختر فصلاً —</option>
                {grades.map((g) => <option key={g.id} value={g.id}>{g.level_name} — {g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">المشرفة</label>
              <select name="supervisor" value={form.supervisor} onChange={handleChange} className="input-glass">
                <option value="">— بدون مشرفة —</option>
                {supervisors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">السكن</label>
            <input name="address" value={form.address} onChange={handleChange} className="input-glass" />
          </div>

          {error && <p className="text-brand-red text-xs bg-brand-red/10 rounded-xl p-3">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Edit size={16} />}
              {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-6">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─ نافذة حذف طالب ───────────────────────────────────────────── */
function DeleteStudentModal({ student, onClose, onDeleted }) {
  const [saving, setSaving] = useState(false)
  
  const handleDelete = async () => {
    setSaving(true)
    try {
      await api.delete(`/students/${student.id}/`)
      onDeleted()
      onClose()
    } catch (e) {
      alert("حدث خطأ أثناء الحذف.")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
      <div className="glass-card-strong w-full max-w-sm p-6 text-center animate-scale-in">
        <div className="w-14 h-14 rounded-full bg-brand-red/20 text-brand-red flex items-center justify-center mx-auto mb-4 border border-brand-red/30">
          <Trash size={28} />
        </div>
        <h3 className="font-cairo font-bold text-white text-lg mb-2">تأكيد الحذف</h3>
        <p className="text-white/60 text-sm mb-6">
          هل أنت متأكد أنك تريد حذف الطالب <span className="font-bold text-white">{student.user?.full_name}</span> بشكل نهائي؟  
          هذا الإجراء سيحذف كافة سجّلاته ومعلوماته (بما فيها الملف المالي والدفعات).
        </p>
        <div className="flex gap-3">
          <button onClick={handleDelete} disabled={saving} className="btn-primary bg-brand-red hover:bg-red-600 flex-1 justify-center">
            {saving ? <Loader2 className="animate-spin" size={16} /> : 'نعم، احذف نهائياً'}
          </button>
          <button onClick={onClose} className="btn-secondary px-5">إلغاء</button>
        </div>
      </div>
    </div>
  )
}

/* ─ الصفحة الرئيسية ────────────────────────────────────────────── */"""

content = content.replace("/* ─ الصفحة الرئيسية ────────────────────────────────────────────── */", edit_del_modals)

# Add levels, active level/grade filters, and edit/del states
new_states = """  const [levels,      setLevels]      = useState([])
  const [level,       setLevel]       = useState('')
  const [grade,       setGrade]       = useState('')
  const [editStudent, setEditStudent] = useState(null)
  const [delStudent,  setDelStudent]  = useState(null)"""

content = content.replace("  const [total,       setTotal]       = useState(0)\n  const pageSize = 20", "  const [total,       setTotal]       = useState(0)\n  const pageSize = 20\n" + new_states)

# Update load to include level, grade
old_load = """api.get('/students/', { params: { page, search } })"""
new_load = """api.get('/students/', { params: { page, search, level, grade } })"""
content = content.replace(old_load, new_load)
content = content.replace("[page, search])", "[page, search, level, grade])")

# Update effect to fetch levels as well
old_effect = """  // خيارات الفصول والمشرفات للنموذج
  useEffect(() => {
    Promise.all([
      api.get('/academic/grades/').catch(() => ({ data: [] })),
      api.get('/supervisors/').catch(() => ({ data: [] })),
    ]).then(([g, s]) => {
      setGrades(g.data.results || g.data)
      setSupervisors(s.data.results || s.data)
    })
  }, [])"""

new_effect = """  // خيارات المراحل والفصول والمشرفات
  useEffect(() => {
    Promise.all([
      api.get('/academic/levels/').catch(() => ({ data: [] })),
      api.get('/academic/grades/').catch(() => ({ data: [] })),
      api.get('/supervisors/').catch(() => ({ data: [] })),
    ]).then(([l, g, s]) => {
      setLevels(l.data.results || l.data)
      setGrades(g.data.results || g.data)
      setSupervisors(s.data.results || s.data)
    })
  }, [])"""
content = content.replace(old_effect, new_effect)

# Inject Level and Grade filters beside Search
filters_ui = """      {/* شريط البحث والفلاتر */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="ابحث بالاسم أو الهاتف أو المستخدم..."
            className="input-glass pr-10 w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>
        
        <select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1) }} className="input-glass w-auto min-w-[120px]">
          <option value="">— كل المراحل —</option>
          {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>

        <select value={grade} onChange={(e) => { setGrade(e.target.value); setPage(1) }} className="input-glass w-auto min-w-[120px]">
          <option value="">— كل الفصول —</option>
          {grades
            .filter(g => !level || g.level == level || String(g.level?.id) == String(level))
            .map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>"""

# Remove old search UI
content = re.sub(r'      \{\/\* شريط البحث \*\/\}[\s\S]+?<\/div>', filters_ui, content, count=1)


# Update Unbind device button string
old_unbind = """                        <span className="badge-green badge text-xs">مربوط</span>
                        <button
                          onClick={() => unbindDevice(s.id)}
                          title="فك الارتباط"
                          className="text-white/30 hover:text-brand-red transition-colors"
                        >
                          <SmartphoneNfc size={14} />
                        </button>"""
new_unbind = """                        <span className="badge-green badge text-xs">مربوط</span>
                        <button
                          onClick={() => unbindDevice(s.id)}
                          title="فك الارتباط"
                          className="btn-ghost p-1 text-brand-red flex items-center gap-1 text-xs"
                        >
                          <SmartphoneNfc size={12} /> إعادة ضبط
                        </button>"""
content = content.replace(old_unbind, new_unbind)

# Add Edit and Delete buttons to Action cells
old_actions = """                      <button onClick={() => setViewStudent(s)} title="تفاصيل" className="btn-ghost p-1.5 text-brand-blue hover:bg-brand-blue/10 rounded-lg">
                        <Eye size={15} />
                      </button>"""
new_actions = """                      <button onClick={() => setViewStudent(s)} title="تفاصيل" className="btn-ghost p-1.5 text-brand-blue hover:bg-brand-blue/10 rounded-lg">
                        <Eye size={15} />
                      </button>
                      <button onClick={() => setEditStudent(s)} title="تعديل" className="btn-ghost p-1.5 text-amber-400 hover:bg-amber-400/10 rounded-lg">
                        <Edit size={15} />
                      </button>
                      <button onClick={() => setDelStudent(s)} title="حذف" className="btn-ghost p-1.5 text-brand-red hover:bg-brand-red/10 rounded-lg">
                        <Trash size={15} />
                      </button>"""
content = content.replace(old_actions, new_actions)

# Mount Modals at the end of component
mount_modals = """      {editStudent && (
        <EditStudentModal
          student={editStudent}
          grades={grades}
          supervisors={supervisors}
          onClose={() => setEditStudent(null)}
          onUpdated={load}
        />
      )}

      {delStudent && (
        <DeleteStudentModal
          student={delStudent}
          onClose={() => setDelStudent(null)}
          onDeleted={load}
        />
      )}"""

content = content.replace("    </div>\n  )\n}\n", mount_modals + "\n    </div>\n  )\n}\n")

with open("frontend/src/pages/dashboard/StudentsPage.jsx", "w") as f:
    f.write(content)
