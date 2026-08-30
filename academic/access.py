"""
================================================================================
academic/access.py
================================================================================
قاعدة واحدة لتحديد الكورسات المتاحة للطالب.

كانت القاعدة مكرّرة بصيغتين مختلفتين:

  - واجهات الكورسات والمحاضرات كانت تقرأ StudentCourseAccess فقط، وهذه لا
    تُنشأ لطالب الأونلاين إلا عند أول دفعة.
  - StudentExamListView كانت تعتمد على enrolled_grade لطالب الأونلاين.

فكان الطالب الأونلاين يرى اختباراته ولا يستطيع فتح محاضراته. اشتراك الأونلاين
يشمل المرحلة كاملةً ولا يحتاج تفعيلاً لكل كورس على حدة، فتُوحَّد القاعدة هنا
ويُستدعى هذا الملف من كل واجهة بدل تكرار المنطق.
================================================================================
"""

from academic.models import Course, StudentCourseAccess


def accessible_course_ids(student) -> set:
    """
    معرّفات الكورسات التي يحق للطالب فتحها.

    الأونلاين: كل كورسات مرحلته النشطة، بالإضافة إلى أي كورس مُنح له يدوياً.
    الفلاش:    الكورسات المرتبطة به عبر StudentCourseAccess فقط.

    الاتحاد مقصود ولا يُستبدل بالمرحلة وحدها: هناك طلاب أونلاين لديهم
    StudentCourseAccess بلا enrolled_grade، وقصر القاعدة على المرحلة كان
    ليسحب منهم وصولاً يملكونه فعلاً.
    """
    granted = set(
        StudentCourseAccess.objects
        .filter(student=student, is_active=True)
        .values_list("course_id", flat=True)
    )

    if student.system_type == "online" and student.enrolled_grade_id:
        granted |= set(
            Course.objects
            .filter(
                grade_id=student.enrolled_grade_id,
                system_type="online",
                is_active=True,
            )
            .values_list("id", flat=True)
        )

    return granted


def can_access_course(student, course_id) -> bool:
    """هل يملك الطالب صلاحية فتح هذا الكورس؟"""
    return course_id in accessible_course_ids(student)
