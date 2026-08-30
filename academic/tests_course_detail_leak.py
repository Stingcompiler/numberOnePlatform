"""
================================================================================
academic/tests_course_detail_leak.py
================================================================================
‎/api/academic/courses/<id>/‎ مفتوحة لكل مصادَق عليه، وكانت تُسَلسِل بـ
CourseSerializer التي تُضمّن youtube_url الخام في كل محاضرة — فطلب واحد كان
يُعيد روابط كل محاضرات الكورس لأي طالب يصل إليها، وهو بالضبط ما تمنعه واجهات
‎my-courses‎.

تطبيق الموبايل يستدعي هذه الواجهة لطالب الأونلاين، فالتسريب كان حياً.

القيد: لا يجوز إغلاق الوصول — الموبايل يعتمد عليه. يسقط الحقل وحده.
================================================================================
"""

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import CustomUser, StudentProfile
from academic.models import Level, Grade, Course, Unit, Lesson

YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


class CourseDetailLeakTests(TestCase):

    def setUp(self):
        level = Level.objects.create(name="المرحلة الثانوية")
        self.grade = Grade.objects.create(level=level, name="الصف الثالث")
        self.course = Course.objects.create(
            grade=self.grade, name="الرياضيات", system_type="online",
        )
        unit = Unit.objects.create(course=self.course, name="الوحدة الأولى")
        Lesson.objects.create(unit=unit, title="محاضرة", youtube_url=YOUTUBE_URL)

        student_user = CustomUser.objects.create_user(
            username="student_leak", password="pass12345",
            full_name="طالب", role=CustomUser.Roles.STUDENT,
        )
        StudentProfile.objects.create(
            user=student_user, system_type="online", enrolled_grade=self.grade,
        )
        self.student = APIClient()
        self.student.force_authenticate(user=student_user)

        admin_user = CustomUser.objects.create_user(
            username="admin_leak", password="pass12345",
            full_name="مدير", role=CustomUser.Roles.ADMIN,
        )
        self.admin = APIClient()
        self.admin.force_authenticate(user=admin_user)

    def _lessons(self, payload):
        return [lesson for unit in payload["units"] for lesson in unit["lessons"]]

    def test_a_student_never_receives_the_raw_youtube_url(self):
        res = self.student.get(f"/api/academic/courses/{self.course.id}/")

        self.assertEqual(res.status_code, 200)
        for lesson in self._lessons(res.data):
            self.assertNotIn("youtube_url", lesson)

    def test_a_student_still_receives_a_usable_embed_url(self):
        """
        الموبايل يقرأ ‎youtube_url || youtube_embed_url‎، فلا بد أن يبقى
        embed_url موجوداً وقابلاً لاستخراج معرّف الفيديو منه.
        """
        res = self.student.get(f"/api/academic/courses/{self.course.id}/")

        for lesson in self._lessons(res.data):
            self.assertIn("youtube_embed_url", lesson)
            self.assertIn("/embed/", lesson["youtube_embed_url"])

    def test_the_student_keeps_their_access_to_this_endpoint(self):
        """القيد: الإصلاح يُسقط حقلاً، ولا يغلق باباً يعتمد عليه الموبايل."""
        self.assertEqual(
            self.student.get(f"/api/academic/courses/{self.course.id}/").status_code, 200,
        )

    def test_staff_still_receive_the_raw_url_because_the_editor_needs_it(self):
        res = self.admin.get(f"/api/academic/courses/{self.course.id}/")

        self.assertEqual(res.status_code, 200)
        for lesson in self._lessons(res.data):
            self.assertIn("youtube_url", lesson)
            self.assertEqual(lesson["youtube_url"], YOUTUBE_URL)
