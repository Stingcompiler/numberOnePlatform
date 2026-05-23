import re

with open("frontend/src/pages/dashboard/StudentsPage.jsx", "r") as f:
    content = f.read()

# Add StudentDetailsModal component before StudentsPage
details_modal = """/* ─ نافذة تفاصيل الطالب ─────────────────────────────────────────── */
function StudentDetailsModal({ student, onClose }) {
  if (!student) return null;

  const basicInfo = [
    { label: 'الاسم الكامل', value: student.user?.full_name },
    { label: 'اسم المستخدم', value: student.user?.username, dir: 'ltr' },
    { label: 'رقم الهاتف', value: student.user?.phone, dir: 'ltr' },
    { label: 'البريد الإلكتروني', value: student.user?.email || '—', dir: 'ltr' },
    { label: 'السكن', value: student.address || '—' },
  ];

  const parentInfo = [
    { label: 'اسم ولي الأمر', value: student.guardian_name },
    { label: 'هاتف ولي الأمر', value: student.guardian_phone || '—', dir: 'ltr' },
  ];

  const academicInfo = [
    { label: 'تاريخ التسجيل', value: new Date(student.registered_at).toLocaleDateString('ar-EG') },
    { label: 'نوع النظام', value: student.system_type_display },
    { label: 'الفصل الدراسي', value: student.enrolled_grade_name || '—' },
    { label: 'المشرفة', value: student.supervisor_name || '—' },
  ];

  const sysInfo = [
    { label: 'حالة الجهاز', value: student.device_id ? `مربوط (${new Date(student.device_bound_at).toLocaleDateString('ar-EG')})` : 'غير مربوط' },
    { label: 'المعرف الفريد للجهاز', value: student.device_id || '—', dir: 'ltr' },
    { label: 'المتبقي المالي', value: `${student.balance} ج.س` },
    { label: 'ملاحظات إدارية', value: student.notes || '—' },
  ];

  const InfoSection = ({ title, data }) => (
    <div className="glass-card p-4">
      <h3 className="font-cairo font-bold text-white/80 text-sm mb-4 border-b border-white/10 pb-2">{title}</h3>
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i} className="flex justify-between items-start gap-4">
            <span className="text-white/40 text-sm shrink-0">{item.label}</span>
            <span className="text-white text-sm text-right" dir={item.dir || 'rtl'}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-900/80 backdrop-blur-sm">
      <div className="glass-card-strong w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-blue/20 flex items-center justify-center text-xl font-bold text-brand-blue border border-brand-blue/30">
              {student.user?.full_name?.charAt(0)}
            </div>
            <div>
              <h2 className="font-cairo font-bold text-white text-lg leading-tight">{student.user?.full_name}</h2>
              <p className="text-white/40 text-xs mt-1">معرف النظام: {student.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-full hover:bg-white/10"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <InfoSection title="المعلومات الشخصية" data={basicInfo} />
            <InfoSection title="معلومات ولي الأمر" data={parentInfo} />
          </div>
          <div className="space-y-4">
            <InfoSection title="المعلومات الأكاديمية" data={academicInfo} />
            <div className="glass-card p-4">
              <h3 className="font-cairo font-bold text-white/80 text-sm mb-4 border-b border-white/10 pb-2">تفاصيل النظام</h3>
              <div className="space-y-3">
                {sysInfo.map((item, i) => (
                  <div key={i} className="flex justify-between items-start gap-4">
                    <span className="text-white/40 text-sm shrink-0">{item.label}</span>
                    <span className={`text-sm text-right ${item.label === 'المتبقي المالي' ? 'text-brand-red font-bold' : item.label === 'حالة الجهاز' ? 'text-neon-cyan' : 'text-white'}`} dir={item.dir || 'rtl'}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─ الصفحة الرئيسية ────────────────────────────────────────────── */"""

content = content.replace("/* ─ الصفحة الرئيسية ────────────────────────────────────────────── */", details_modal)

# Add state variable
content = content.replace("const [showCreate,  setShowCreate]  = useState(false)", "const [showCreate,  setShowCreate]  = useState(false)\n  const [viewStudent, setViewStudent] = useState(null)")

# Modify the Eye button to open the modal
old_eye = """                      <button title="تفاصيل" className="btn-ghost p-1.5 text-brand-blue">
                        <Eye size={15} />
                      </button>"""
new_eye = """                      <button onClick={() => setViewStudent(s)} title="تفاصيل" className="btn-ghost p-1.5 text-brand-blue hover:bg-brand-blue/10 rounded-lg">
                        <Eye size={15} />
                      </button>"""
content = content.replace(old_eye, new_eye)

# Mount the modal component
old_end = """      {/* نافذة إنشاء طالب */}
      {showCreate && (
        <CreateStudentModal
          grades={grades}
          supervisors={supervisors}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </div>
  )
}
"""
new_end = """      {/* نافذة إنشاء طالب */}
      {showCreate && (
        <CreateStudentModal
          grades={grades}
          supervisors={supervisors}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}

      {/* نافذة تفاصيل الطالب */}
      {viewStudent && (
        <StudentDetailsModal
          student={viewStudent}
          onClose={() => setViewStudent(null)}
        />
      )}
    </div>
  )
}
"""
content = content.replace(old_end, new_end)

with open("frontend/src/pages/dashboard/StudentsPage.jsx", "w") as f:
    f.write(content)
