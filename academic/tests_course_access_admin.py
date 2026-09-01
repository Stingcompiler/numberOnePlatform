"""
================================================================================
academic/tests_course_access_admin.py
================================================================================
إدارة وصول طلاب الفلاش للكورسات من لوحة التحكم.

ثلاث شكاوى من الإدارة، أصلها واحد تقريباً:

  - الصفحة تعرض ١٠ سجلات فقط. الواجهة كانت تقرأ ‎data.results‎ من نقطة نهاية
    مُجزَّأة دون إكمال الصفحات، فما بعد العاشر لم يكن ظاهراً أصلاً — ولا
    قابلاً للتعطيل أو الحذف لأنه غير معروض.

  - "المدير لا يستطيع إلغاء كورس سجّل الطالب فيه": التعطيل والحذف يعملان في
    الـ API، لكن القيد ‎unique_together(student, course)‎ كان يمنع إعادة المنح
    بعد التعطيل، فيبدو الأمر وكأن الإلغاء لا يعمل.

  - حذف الكورس من سجل الطالب: DELETE مدعوم، وهذه الاختبارات تُثبّته.
================================================================================
"""

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import CustomUser, StudentProfile
from academic.models import Level, Grade, Course, StudentCourseAccess


class CourseAccessAdminTests(TestCase):

    def setUp(self):
        level = Level.objects.create(name="المرحلة الثانوية")
        self.grade = Grade.objects.create(level=level, name="الصف الثالث")

        self.courses = [
            Course.objects.create(
                grade=self.grade, name=f"كورس {i}", system_type="flash",
            )
            for i in range(15)
        ]

        student_user = CustomUser.objects.create_user(
            username="flash_student", password="pass12345",
            full_name="طالب فلاش", role=CustomUser.Roles.STUDENT,
        )
        self.student = StudentProfile.objects.create(
            user=student_user, system_type="flash", enrolled_grade=self.grade,
        )

        admin_user = CustomUser.objects.create_user(
            username="access_admin", password="pass12345",
            full_name="مدير", role=CustomUser.Roles.ADMIN,
        )
        self.admin = APIClient()
        self.admin.force_authenticate(user=admin_user)

    def _grant(self, course):
        return self.admin.post(
            "/api/academic/access/",
            {"student": self.student.id, "course": course.id},
            format="json",
        )

    # ── الصفحات ──────────────────────────────────────────────────────────────

    def test_more_than_ten_records_are_reachable(self):
        """
        الحد الافتراضي عشرة. السجل الحادي عشر فصاعداً لم يكن ظاهراً في الصفحة،
        ولذلك لم يكن قابلاً للتعطيل أو الحذف.
        """
        for course in self.courses:
            self._grant(course)

        first = self.admin.get("/api/academic/access/").data
        self.assertEqual(first["count"], 15)
        self.assertEqual(len(first["results"]), 10)

        # الواجهة تطلب صفحةً أكبر (fetchAll)، فتصل السجلات كلها.
        everything = self.admin.get("/api/academic/access/", {"page_size": 1000}).data
        self.assertEqual(len(everything["results"]), 15)

    def test_the_list_can_be_narrowed_to_one_student(self):
        """المدير يدير سجل طالب بعينه، فلا بد من الفلترة به لا بالكورس وحده."""
        self._grant(self.courses[0])

        res = self.admin.get("/api/academic/access/", {"student": self.student.id})

        self.assertEqual(res.data["count"], 1)

    # ── الإلغاء وإعادة المنح ─────────────────────────────────────────────────

    def test_the_admin_can_disable_an_access_row(self):
        access_id = self._grant(self.courses[0]).data["id"]

        res = self.admin.patch(
            f"/api/academic/access/{access_id}/", {"is_active": False}, format="json",
        )

        self.assertEqual(res.status_code, 200)
        self.assertFalse(StudentCourseAccess.objects.get(pk=access_id).is_active)

    def test_granting_again_after_disabling_reactivates_instead_of_failing(self):
        """
        قبل الإصلاح كان ‎unique_together‎ يردّ بخطأ "موجود مسبقاً"، فيعلق المدير:
        عطّل الكورس ولا يستطيع إعادته.
        """
        access_id = self._grant(self.courses[0]).data["id"]
        self.admin.patch(
            f"/api/academic/access/{access_id}/", {"is_active": False}, format="json",
        )

        res = self._grant(self.courses[0])

        self.assertIn(res.status_code, (200, 201), res.data)
        self.assertTrue(StudentCourseAccess.objects.get(pk=access_id).is_active)

        # ولا يُنشَأ صفّ ثانٍ.
        self.assertEqual(StudentCourseAccess.objects.filter(student=self.student).count(), 1)

    # ── الحذف من سجل الطالب ──────────────────────────────────────────────────

    def test_the_admin_can_delete_a_course_from_the_students_record(self):
        access_id = self._grant(self.courses[0]).data["id"]

        res = self.admin.delete(f"/api/academic/access/{access_id}/")

        self.assertEqual(res.status_code, 204)
        self.assertFalse(StudentCourseAccess.objects.filter(pk=access_id).exists())

    def test_a_deleted_course_can_be_granted_again(self):
        access_id = self._grant(self.courses[0]).data["id"]
        self.admin.delete(f"/api/academic/access/{access_id}/")

        res = self._grant(self.courses[0])

        self.assertEqual(res.status_code, 201)

    def test_deleting_access_does_not_touch_the_course_itself(self):
        """الحذف يزيل الوصول من سجل الطالب، لا الكورس من المنصة."""
        access_id = self._grant(self.courses[0]).data["id"]

        self.admin.delete(f"/api/academic/access/{access_id}/")

        self.assertTrue(Course.objects.filter(pk=self.courses[0].id).exists())

    # ── الصلاحية ─────────────────────────────────────────────────────────────

    def test_a_student_cannot_manage_access(self):
        student_client = APIClient()
        student_client.force_authenticate(user=self.student.user)

        self.assertEqual(student_client.get("/api/academic/access/").status_code, 403)
