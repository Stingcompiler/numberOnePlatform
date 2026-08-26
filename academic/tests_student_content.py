"""
================================================================================
academic/tests_student_content.py
================================================================================
اختبارات تسريب روابط اليوتيوب في واجهات الطالب.

القاعدة:
  - الطالب يحصل على youtube_embed_url فقط.
  - youtube_url الخام يبقى في واجهات الإدارة (نماذج التحرير تعتمد عليه).

اختبار التوافق الأهم: تطبيق الموبايل المنشور يقرأ
    lesson.youtube_url || lesson.youtube_embed_url
فلا بد أن يبقى embed_url قابلاً للتحليل باستخراج معرّف الفيديو.
================================================================================
"""

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import CustomUser, StudentProfile
from academic.models import (
    Level, Grade, Course, Unit, Lesson, StudentCourseAccess,
)

YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


class StudentContentLeakTests(TestCase):

    def setUp(self):
        self.level = Level.objects.create(name="المرحلة الثانوية")
        self.grade = Grade.objects.create(level=self.level, name="الصف الأول")
        self.course = Course.objects.create(grade=self.grade, name="الرياضيات")
        self.unit = Unit.objects.create(course=self.course, name="الوحدة الأولى")
        self.lesson = Lesson.objects.create(
            unit=self.unit,
            title="المحاضرة الأولى",
            youtube_url=YOUTUBE_URL,
        )

        student_user = CustomUser.objects.create_user(
            username="student1", password="pass12345",
            full_name="طالب اختبار", role=CustomUser.Roles.STUDENT,
        )
        self.student = StudentProfile.objects.create(user=student_user)
        StudentCourseAccess.objects.create(
            student=self.student, course=self.course, is_active=True,
        )

        self.admin_user = CustomUser.objects.create_user(
            username="admin1", password="pass12345",
            full_name="مدير اختبار", role=CustomUser.Roles.ADMIN,
        )

        self.student_client = APIClient()
        self.student_client.force_authenticate(user=student_user)
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.admin_user)

    # ── واجهات الطالب: لا youtube_url ────────────────────────────────────────

    def test_my_lesson_detail_hides_raw_url(self):
        res = self.student_client.get(f"/api/academic/my-lessons/{self.lesson.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("youtube_url", res.data)
        self.assertIn("youtube_embed_url", res.data)

    def test_my_course_detail_hides_raw_url_in_nested_lessons(self):
        """أخطر تسريب: طلب واحد كان يعيد روابط كل محاضرات الكورس."""
        res = self.student_client.get(f"/api/academic/my-courses/{self.course.id}/")
        self.assertEqual(res.status_code, 200)

        lessons = res.data["units"][0]["lessons"]
        self.assertEqual(len(lessons), 1)
        self.assertNotIn("youtube_url", lessons[0])
        self.assertIn("youtube_embed_url", lessons[0])

    def test_my_courses_list_hides_raw_url_in_nested_lessons(self):
        res = self.student_client.get("/api/academic/my-courses/")
        self.assertEqual(res.status_code, 200)

        lessons = res.data[0]["units"][0]["lessons"]
        self.assertNotIn("youtube_url", lessons[0])

    def test_raw_url_absent_from_entire_student_payload(self):
        """فحص شامل على النص الخام — يمسك أي تسريب متداخل فاتنا."""
        for url in (
            "/api/academic/my-courses/",
            f"/api/academic/my-courses/{self.course.id}/",
            f"/api/academic/my-lessons/{self.lesson.id}/",
        ):
            res = self.student_client.get(url)
            self.assertEqual(res.status_code, 200, url)
            body = res.content.decode()
            self.assertNotIn("watch?v=", body, f"رابط خام مسرَّب في {url}")
            self.assertNotIn("youtube_url", body, f"حقل خام مسرَّب في {url}")

    # ── توافق تطبيق الموبايل المنشور ─────────────────────────────────────────

    def test_embed_url_remains_parseable_by_mobile_regex(self):
        """
        تطبيق الموبايل يسقط على youtube_embed_url ويستخرج المعرّف بـ regex
        يدعم مسار /embed/. لا بد أن يبقى المعرّف قابلاً للاستخراج (11 محرفاً).
        """
        import re

        res = self.student_client.get(f"/api/academic/my-lessons/{self.lesson.id}/")
        embed = res.data["youtube_embed_url"]

        # نفس النمط المستخدم في mobile/src/components/VideoPlayer.jsx
        pattern = r"^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*"
        match = re.match(pattern, embed)
        self.assertIsNotNone(match, f"تعذّر تحليل embed url: {embed}")
        self.assertEqual(len(match.group(2)), 11)
        self.assertEqual(match.group(2), "dQw4w9WgXcQ")

    # ── واجهات الإدارة: youtube_url يبقى (حارس انحدار) ──────────────────────

    def test_admin_lesson_detail_still_exposes_raw_url(self):
        """نماذج تحرير المحاضرة في لوحة التحكم تعتمد على youtube_url."""
        res = self.admin_client.get(f"/api/academic/lessons/{self.lesson.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("youtube_url", res.data)
        self.assertEqual(res.data["youtube_url"], YOUTUBE_URL)

    def test_admin_unit_detail_still_exposes_raw_url(self):
        res = self.admin_client.get(f"/api/academic/units/{self.unit.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("youtube_url", res.data["lessons"][0])

    def test_admin_course_detail_still_exposes_raw_url(self):
        res = self.admin_client.get(f"/api/academic/courses/{self.course.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("youtube_url", res.data["units"][0]["lessons"][0])

    # ── محاضرة بلا تمرين: كانت تُسقِط الخادم (500) ──────────────────────────

    def test_lesson_without_exercise_does_not_crash(self):
        """
        العلاقة العكسية OneToOne ترمي RelatedObjectDoesNotExist لا None،
        فكان أي طالب يفتح محاضرة بلا تمرين يحصل على خطأ 500.
        """
        res = self.student_client.get(f"/api/academic/my-lessons/{self.lesson.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data["exercise"])

    def test_lesson_with_exercise_still_returns_safe_version(self):
        """الفرع الآخر: التمرين الموجود يُعاد بنسخة الطالب (بدون is_correct)."""
        from academic.models import Exercise, Question, Choice

        exercise = Exercise.objects.create(lesson=self.lesson, title="تمرين")
        question = Question.objects.create(exercise=exercise, text="سؤال")
        Choice.objects.create(question=question, text="إجابة", is_correct=True)

        res = self.student_client.get(f"/api/academic/my-lessons/{self.lesson.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertIsNotNone(res.data["exercise"])
        self.assertNotIn("is_correct", res.content.decode())

    # ── حارس: شكل الاستجابة للطالب لم يتغيّر عدا الحقل المحذوف ─────────────

    def test_student_lesson_payload_keeps_expected_fields(self):
        res = self.student_client.get(f"/api/academic/my-lessons/{self.lesson.id}/")
        for field in (
            "id", "unit", "title", "description", "youtube_embed_url",
            "pdf_file", "display_order", "duration_minutes", "is_active",
            "exercise",
        ):
            self.assertIn(field, res.data, f"حقل مفقود: {field}")
