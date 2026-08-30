"""
================================================================================
academic/tests_student_access.py
================================================================================
قاعدة وصول الطالب للكورسات والمحاضرات.

الخلل الذي تحرسه هذه الاختبارات: كانت واجهات الكورسات والمحاضرات تقرأ
StudentCourseAccess وحدها، وهذه لا تُنشأ لطالب الأونلاين إلا عند أول دفعة،
بينما كانت واجهة الاختبارات تعتمد على enrolled_grade. فكان الطالب الأونلاين
يرى اختباراته ويُمنع من فتح محاضراته — والاشتراك الأونلاين يشمل المرحلة كاملةً
ولا يحتاج تفعيلاً لكل كورس.
================================================================================
"""

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import CustomUser, StudentProfile
from academic.models import (
    Level, Grade, Course, Unit, Lesson, StudentCourseAccess,
)


class StudentCourseAccessRuleTests(TestCase):

    def setUp(self):
        self.level = Level.objects.create(name="المرحلة الثانوية")
        self.grade = Grade.objects.create(level=self.level, name="الصف الثالث")

        self.course = Course.objects.create(
            grade=self.grade, name="الرياضيات", system_type="online",
        )
        self.unit = Unit.objects.create(course=self.course, name="الوحدة الأولى")
        self.lesson = Lesson.objects.create(
            unit=self.unit,
            title="المعادلات التربيعية",
            youtube_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        )

        # كورس خارج مرحلة الطالب — لا يجوز أن يظهر له.
        self.other_grade = Grade.objects.create(level=self.level, name="الصف الأول")
        self.other_course = Course.objects.create(
            grade=self.other_grade, name="الفيزياء", system_type="online",
        )

    def _student(self, username, system_type, grade=None):
        user = CustomUser.objects.create_user(
            username=username, password="pass12345",
            full_name=username, role=CustomUser.Roles.STUDENT,
        )
        profile = StudentProfile.objects.create(
            user=user, system_type=system_type, enrolled_grade=grade,
        )
        client = APIClient()
        client.force_authenticate(user=user)
        return profile, client

    # ── طالب الأونلاين: المرحلة تكفي ─────────────────────────────────────────

    def test_online_student_without_any_access_row_sees_their_grade_courses(self):
        _, client = self._student("online1", "online", self.grade)

        res = client.get("/api/academic/my-courses/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual([c["id"] for c in res.data], [self.course.id])

    def test_online_student_without_any_access_row_can_open_the_course(self):
        _, client = self._student("online2", "online", self.grade)

        res = client.get(f"/api/academic/my-courses/{self.course.id}/")

        self.assertEqual(res.status_code, 200)

    def test_online_student_without_any_access_row_can_open_the_lesson(self):
        """الخلل الأصلي: كان يرى الكورس ويُمنع من محاضرته."""
        _, client = self._student("online3", "online", self.grade)

        res = client.get(f"/api/academic/my-lessons/{self.lesson.id}/")

        self.assertEqual(res.status_code, 200)

    def test_online_student_still_cannot_reach_another_grades_course(self):
        """المرحلة تفتح كورسات مرحلته فقط، لا كل الكورسات."""
        _, client = self._student("online4", "online", self.grade)

        res = client.get(f"/api/academic/my-courses/{self.other_course.id}/")

        self.assertEqual(res.status_code, 403)

    def test_online_student_with_no_enrolled_grade_keeps_their_granted_courses(self):
        """
        الاتحاد لا الاستبدال: هناك طلاب أونلاين لديهم StudentCourseAccess بلا
        enrolled_grade، وقصر القاعدة على المرحلة كان ليسحب منهم وصولاً يملكونه.
        """
        profile, client = self._student("online5", "online", None)
        StudentCourseAccess.objects.create(
            student=profile, course=self.course, is_active=True,
        )

        res = client.get(f"/api/academic/my-lessons/{self.lesson.id}/")

        self.assertEqual(res.status_code, 200)

    # ── طالب الفلاش: لا تتغيّر قاعدته ────────────────────────────────────────

    def test_flash_student_without_access_is_still_refused(self):
        """المرحلة لا تفتح شيئاً لطالب الفلاش؛ يُربط بالكورسات يدوياً."""
        _, client = self._student("flash1", "flash", self.grade)

        self.assertEqual(client.get("/api/academic/my-courses/").data, [])
        self.assertEqual(
            client.get(f"/api/academic/my-lessons/{self.lesson.id}/").status_code, 403,
        )

    def test_flash_student_with_access_reaches_the_lesson(self):
        profile, client = self._student("flash2", "flash", self.grade)
        StudentCourseAccess.objects.create(
            student=profile, course=self.course, is_active=True,
        )

        self.assertEqual(
            client.get(f"/api/academic/my-lessons/{self.lesson.id}/").status_code, 200,
        )

    def test_a_revoked_access_row_is_not_honoured(self):
        profile, client = self._student("flash3", "flash", self.grade)
        StudentCourseAccess.objects.create(
            student=profile, course=self.course, is_active=False,
        )

        self.assertEqual(
            client.get(f"/api/academic/my-lessons/{self.lesson.id}/").status_code, 403,
        )

    # ── الاتساق مع واجهة الاختبارات ──────────────────────────────────────────

    def test_courses_and_exams_now_agree_for_an_online_student(self):
        """
        القاعدتان كانتا مختلفتين، فكان الطالب يرى اختبار كورس لا يستطيع فتحه.
        """
        _, client = self._student("online6", "online", self.grade)

        course_ids = {c["id"] for c in client.get("/api/academic/my-courses/").data}
        exam_course_ids = {
            e["course_id"] for e in client.get("/api/exams/student/list/").data
        }

        self.assertTrue(exam_course_ids.issubset(course_ids))
