"""
================================================================================
exams/tests_exam_access_rule.py
================================================================================
قائمة اختبارات الطالب يجب أن تتبع نفس قاعدة وصول الكورسات.

‎academic/access.py‎ كُتب أصلاً لتوحيد قاعدتين متضاربتين، وذكر في توثيقه أن
‎StudentExamListView‎ هي أحد طرفَي التضارب — لكنها لم تُحوَّل إليه فعلياً، فبقيت
تقرأ ‎enrolled_grade‎ وحدها لطالب الأونلاين.

الأثر بعد توحيد قاعدة الكورسات: الطالب الأونلاين الذي مُنح كورساً خارج مرحلته
عبر ‎StudentCourseAccess‎ صار يرى الكورس ويفتح محاضراته، بينما اختبارات ذلك
الكورس تختفي عنه. أي أن الاختبار موجود ومتاح ولا سبيل له إليه.

هذه الاختبارات تُثبّت أن القائمتين تقرآن من مصدر واحد.
================================================================================
"""

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import CustomUser, StudentProfile
from academic.access import accessible_course_ids
from academic.models import Level, Grade, Course, StudentCourseAccess
from exams.models import Exam


class ExamAccessRuleTests(TestCase):

    def setUp(self):
        level = Level.objects.create(name="المرحلة الثانوية")
        self.grade = Grade.objects.create(level=level, name="الصف الثالث")
        self.other_grade = Grade.objects.create(level=level, name="الصف الثاني")

        # كورس داخل مرحلة الطالب، وآخر خارجها يُمنح له يدوياً.
        self.in_grade = Course.objects.create(
            grade=self.grade, name="الرياضيات", system_type="online",
        )
        self.out_of_grade = Course.objects.create(
            grade=self.other_grade, name="الفيزياء", system_type="online",
        )

        for course in (self.in_grade, self.out_of_grade):
            Exam.objects.create(
                course=course, title=f"اختبار {course.name}",
                duration_minutes=30, passing_score=3.0, is_active=True,
            )

        user = CustomUser.objects.create_user(
            username="online_student", password="pass12345",
            full_name="طالب أونلاين", role=CustomUser.Roles.STUDENT,
        )
        self.student = StudentProfile.objects.create(
            user=user, system_type="online", enrolled_grade=self.grade,
        )

        self.client_ = APIClient()
        self.client_.force_authenticate(user=user)

    def _exam_course_names(self):
        res = self.client_.get("/api/exams/student/list/")
        self.assertEqual(res.status_code, 200, res.data)
        return {row["course_name"] for row in res.data}

    # ── التضارب نفسه ─────────────────────────────────────────────────────────

    def test_a_manually_granted_course_outside_the_grade_shows_its_exams(self):
        """
        الخلل: الكورس يظهر ومحاضراته تُفتح، بينما اختباراته لا تظهر إطلاقاً.
        """
        StudentCourseAccess.objects.create(
            student=self.student, course=self.out_of_grade, is_active=True,
        )

        self.assertIn("الفيزياء", self._exam_course_names())

    def test_the_exam_list_matches_the_shared_access_rule_exactly(self):
        """الحارس الحقيقي: لا قائمة أوسع ولا أضيق، بل نفس المجموعة."""
        StudentCourseAccess.objects.create(
            student=self.student, course=self.out_of_grade, is_active=True,
        )

        res = self.client_.get("/api/exams/student/list/")

        self.assertEqual(
            {row["course_id"] for row in res.data},
            accessible_course_ids(self.student),
        )

    # ── ما يجب ألّا يتغيّر ────────────────────────────────────────────────────

    def test_the_grade_courses_are_still_included_without_any_access_row(self):
        """
        اشتراك الأونلاين يشمل المرحلة كاملةً. توحيد القاعدة اتحادٌ لا استبدال،
        وسحب هذا كان ليُخفي اختبارات كل طالب أونلاين لم يُمنح كورساً يدوياً.
        """
        self.assertFalse(StudentCourseAccess.objects.filter(student=self.student).exists())

        self.assertIn("الرياضيات", self._exam_course_names())

    def test_a_course_never_granted_stays_invisible(self):
        Course.objects.create(
            grade=self.other_grade, name="الكيمياء", system_type="online",
        )

        self.assertNotIn("الكيمياء", self._exam_course_names())

    def test_a_disabled_access_row_grants_nothing(self):
        StudentCourseAccess.objects.create(
            student=self.student, course=self.out_of_grade, is_active=False,
        )

        self.assertNotIn("الفيزياء", self._exam_course_names())

    def test_an_inactive_exam_is_not_listed(self):
        Exam.objects.filter(course=self.in_grade).update(is_active=False)

        self.assertNotIn("الرياضيات", self._exam_course_names())

    def test_a_flash_student_reads_only_their_granted_courses(self):
        """طالب الفلاش لم يكن طرفاً في التضارب، ويجب أن يبقى كما هو."""
        user = CustomUser.objects.create_user(
            username="flash_student", password="pass12345",
            full_name="طالب فلاش", role=CustomUser.Roles.STUDENT,
        )
        flash = StudentProfile.objects.create(
            user=user, system_type="flash", enrolled_grade=self.grade,
        )
        flash_course = Course.objects.create(
            grade=self.grade, name="الأحياء", system_type="flash",
        )
        Exam.objects.create(
            course=flash_course, title="اختبار الأحياء",
            duration_minutes=30, passing_score=3.0, is_active=True,
        )
        StudentCourseAccess.objects.create(
            student=flash, course=flash_course, is_active=True,
        )

        client = APIClient()
        client.force_authenticate(user=user)
        res = client.get("/api/exams/student/list/")

        names = {row["course_name"] for row in res.data}

        # الأحياء ممنوح له؛ الرياضيات في مرحلته لكنه ليس أونلاين فلا يُمنح بالمرحلة.
        self.assertEqual(names, {"الأحياء"})
