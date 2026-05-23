import re

with open("frontend/src/pages/dashboard/StudentsPage.jsx", "r") as f:
    content = f.read()

# Pass onUnbindDevice to StudentDetailsModal
old_modal_mount = """      {/* نافذة تفاصيل الطالب */}
      {viewStudent && (
        <StudentDetailsModal
          student={viewStudent}
          onClose={() => setViewStudent(null)}
        />
      )}"""
new_modal_mount = """      {/* نافذة تفاصيل الطالب */}
      {viewStudent && (
        <StudentDetailsModal
          student={viewStudent}
          onClose={() => setViewStudent(null)}
          onUnbindDevice={unbindDevice}
        />
      )}"""

content = content.replace(old_modal_mount, new_modal_mount)

# Update StudentDetailsModal definition to accept onUnbindDevice hook
old_def = "function StudentDetailsModal({ student, onClose }) {"
new_def = "function StudentDetailsModal({ student, onClose, onUnbindDevice }) {"
content = content.replace(old_def, new_def)

# Find the sysInfo items and add Reset Device button in the UI
old_sys_map = """                {sysInfo.map((item, i) => (
                  <div key={i} className="flex justify-between items-start gap-4">
                    <span className="text-white/40 text-sm shrink-0">{item.label}</span>
                    <span className={`text-sm text-right ${item.label === 'المتبقي المالي' ? 'text-brand-red font-bold' : item.label === 'حالة الجهاز' ? 'text-neon-cyan' : 'text-white'}`} dir={item.dir || 'rtl'}>
                      {item.value}
                    </span>
                  </div>
                ))}"""
new_sys_map = """                {sysInfo.map((item, i) => (
                  <div key={i} className="flex justify-between items-center gap-4 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                    <span className="text-white/40 text-sm shrink-0">{item.label}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm text-right ${item.label === 'المتبقي المالي' ? 'text-brand-red font-bold' : item.label === 'حالة الجهاز' && student.device_id ? 'text-neon-cyan' : 'text-white'}`} dir={item.dir || 'rtl'}>
                        {item.value} 
                      </span>
                      {item.label === 'حالة الجهاز' && student.device_id && (
                        <button onClick={() => { onUnbindDevice(student.id); student.device_id = null; onClose(); }} className="btn-primary bg-brand-red hover:bg-red-600 text-xs px-2 py-1 h-auto">
                          فصل الجهاز
                        </button>
                      )}
                    </div>
                  </div>
                ))}"""

content = content.replace(old_sys_map, new_sys_map)


with open("frontend/src/pages/dashboard/StudentsPage.jsx", "w") as f:
    f.write(content)

