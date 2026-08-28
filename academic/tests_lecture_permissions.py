"""
================================================================================
academic/tests_lecture_permissions.py
================================================================================
مصفوفة صلاحيات المحتوى الأكاديمي.

القواعد المتفق عليها:
  - الكورسات والوحدات: الإدارة فقط (مدير / مانجر).
    مشرف الكورسات لا يُنشئ كورسات — نص الموديل صريح أن صلاحيته هي
    "إدارة محاضراتها" لا إنشاؤها. الواجهة تخفي الأزرار عنه أصلاً.
  - المحاضرات: الإدارة + الأستاذ + مشرف الكورسات ينشئون ويعدّلون.
    الحذف يبقى بيد الإدارة وحدها.

الأستاذ كان مستبعَداً من كتابة المحاضرات بينما تعرض له الواجهة صفحتها،
فكان يصطدم بـ 403 صامت.
================================================================================
"""

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import CustomUser
from academic.models import Level, Grade, Course, Unit, Lesson


def _user(username, role):
    return CustomUser.objects.create_user(
        username=username, password="pass12345",
        full_name=f"مستخدم {username}", role=role,
    )


class LectureWritePermissionTests(TestCase):

    def setUp(self):
        self.level = Level.objects.create(name="مرحلة")
        self.grade = Grade.objects.create(level=self.level, name="صف")
        self.course = Course.objects.create(grade=self.grade, name="الرياضيات")
        self.unit = Unit.objects.create(course=self.course, name="وحدة")
        self.lesson = Lesson.objects.create(unit=self.unit, title="محاضرة قائمة")

        self.roles = {
            "admin":      _user("lp_admin",      CustomUser.Roles.ADMIN),
            "manager":    _user("lp_manager",    CustomUser.Roles.MANAGER),
            "teacher":    _user("lp_teacher",    CustomUser.Roles.TEACHER),
            "supervisor": _user("lp_supervisor", CustomUser.Roles.LECTURE_SUPERVISOR),
        }

    def _client(self, role):
        c = APIClient()
        c.force_authenticate(user=self.roles[role])
        return c

    def _create_lesson(self, role, title="محاضرة جديدة"):
        return self._client(role).post("/api/academic/lessons/", {
            "unit": self.unit.id,
            "title": title,
        })

    # ── إنشاء المحاضرات ──────────────────────────────────────────────────────

    def test_teacher_can_create_lecture(self):
        res = self._create_lesson("teacher", "محاضرة الأستاذ")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(Lesson.objects.filter(title="محاضرة الأستاذ").exists())

    def test_admin_manager_supervisor_can_create_lecture(self):
        for role in ("admin", "manager", "supervisor"):
            with self.subTest(role=role):
                res = self._create_lesson(role, f"محاضرة {role}")
                self.assertEqual(res.status_code, 201, res.data)

    def test_student_cannot_create_lecture(self):
        student = _user("lp_student", CustomUser.Roles.STUDENT)
        c = APIClient()
        c.force_authenticate(user=student)
        res = c.post("/api/academic/lessons/", {"unit": self.unit.id, "title": "x"})
        self.assertEqual(res.status_code, 403)

    # ── تعديل وحذف المحاضرات ─────────────────────────────────────────────────

    def test_teacher_can_edit_lecture(self):
        res = self._client("teacher").patch(
            f"/api/academic/lessons/{self.lesson.id}/",
            {"title": "عنوان عدّله الأستاذ"}, format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)

    def test_teacher_cannot_delete_lecture(self):
        """الحذف يبقى بيد الإدارة."""
        res = self._client("teacher").delete(
            f"/api/academic/lessons/{self.lesson.id}/"
        )
        self.assertEqual(res.status_code, 403)
        self.assertTrue(Lesson.objects.filter(pk=self.lesson.pk).exists())

    def test_supervisor_cannot_delete_lecture(self):
        res = self._client("supervisor").delete(
            f"/api/academic/lessons/{self.lesson.id}/"
        )
        self.assertEqual(res.status_code, 403)

    def test_admin_can_delete_lecture(self):
        res = self._client("admin").delete(
            f"/api/academic/lessons/{self.lesson.id}/"
        )
        self.assertEqual(res.status_code, 204)


class CourseAndUnitWriteTests(TestCase):
    """الكورسات والوحدات للإدارة فقط — سلوك مقصود، لا علة."""

    def setUp(self):
        self.level = Level.objects.create(name="مرحلة")
        self.grade = Grade.objects.create(level=self.level, name="صف")
        self.course = Course.objects.create(grade=self.grade, name="كورس")

        self.roles = {
            "admin":      _user("cu_admin",      CustomUser.Roles.ADMIN),
            "manager":    _user("cu_manager",    CustomUser.Roles.MANAGER),
            "teacher":    _user("cu_teacher",    CustomUser.Roles.TEACHER),
            "supervisor": _user("cu_supervisor", CustomUser.Roles.LECTURE_SUPERVISOR),
        }

    def _client(self, role):
        c = APIClient()
        c.force_authenticate(user=self.roles[role])
        return c

    def test_supervisor_cannot_create_course(self):
        res = self._client("supervisor").post("/api/academic/courses/", {
            "name": "كورس من المشرف", "grade": self.grade.id,
        })
        self.assertEqual(res.status_code, 403)

    def test_teacher_cannot_create_course(self):
        res = self._client("teacher").post("/api/academic/courses/", {
            "name": "كورس من الأستاذ", "grade": self.grade.id,
        })
        self.assertEqual(res.status_code, 403)

    def test_admin_can_create_course(self):
        res = self._client("admin").post("/api/academic/courses/", {
            "name": "كورس من المدير", "grade": self.grade.id,
        })
        self.assertEqual(res.status_code, 201, res.data)

    def test_supervisor_cannot_create_unit(self):
        res = self._client("supervisor").post("/api/academic/units/", {
            "name": "وحدة من المشرف", "course": self.course.id,
        })
        self.assertEqual(res.status_code, 403)

    def test_admin_can_create_unit(self):
        res = self._client("admin").post("/api/academic/units/", {
            "name": "وحدة من المدير", "course": self.course.id,
        })
        self.assertEqual(res.status_code, 201, res.data)

    def test_all_staff_can_read_courses(self):
        for role in self.roles:
            with self.subTest(role=role):
                res = self._client(role).get("/api/academic/courses/")
                self.assertEqual(res.status_code, 200)
