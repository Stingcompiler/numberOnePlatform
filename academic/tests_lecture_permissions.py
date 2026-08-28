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


def _rows(res):
    """صفوف الاستجابة سواء كانت مُصفَّحة أم لا (قائمة فارغة ليست غياباً)."""
    data = res.data
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return data


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

        # المشرف محصور في assigned_courses، فيلزم تخصيصه لهذا الكورس
        # حتى تختبر هذه الحالات الصلاحية لا الحصر.
        from accounts.models import LectureSupervisorProfile
        profile = LectureSupervisorProfile.objects.create(
            user=self.roles["supervisor"]
        )
        profile.assigned_courses.add(self.course)

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


class SupervisorCourseScopeTests(TestCase):
    """
    مشرف الكورسات محصور في assigned_courses.

    كان الحصر موصوفاً في الموديل وفي الواجهة لكنه غير مطبَّق: أي مشرف
    كان يقرأ ويعدّل ويضيف محاضرات لأي كورس في النظام.
    """

    def setUp(self):
        self.level = Level.objects.create(name="مرحلة")
        self.grade = Grade.objects.create(level=self.level, name="صف")

        self.mine = Course.objects.create(grade=self.grade, name="كورسي")
        self.other = Course.objects.create(grade=self.grade, name="كورس غيري")

        self.unit_mine = Unit.objects.create(course=self.mine, name="وحدتي")
        self.unit_other = Unit.objects.create(course=self.other, name="وحدة غيري")

        self.lesson_mine = Lesson.objects.create(
            unit=self.unit_mine, title="محاضرة داخل نطاقي"
        )
        self.lesson_other = Lesson.objects.create(
            unit=self.unit_other, title="محاضرة خارج نطاقي"
        )

        from accounts.models import LectureSupervisorProfile
        self.supervisor = _user("sc_supervisor", CustomUser.Roles.LECTURE_SUPERVISOR)
        profile = LectureSupervisorProfile.objects.create(user=self.supervisor)
        profile.assigned_courses.add(self.mine)

        self.client_sup = APIClient()
        self.client_sup.force_authenticate(user=self.supervisor)

    # ── القراءة ──────────────────────────────────────────────────────────────

    def test_list_shows_only_assigned_courses(self):
        res = self.client_sup.get("/api/academic/lessons/")
        self.assertEqual(res.status_code, 200)

        titles = {row["title"] for row in _rows(res)}
        self.assertIn("محاضرة داخل نطاقي", titles)
        self.assertNotIn("محاضرة خارج نطاقي", titles)

    def test_detail_of_out_of_scope_lesson_is_404(self):
        res = self.client_sup.get(f"/api/academic/lessons/{self.lesson_other.id}/")
        self.assertEqual(res.status_code, 404)

    def test_detail_of_assigned_lesson_is_readable(self):
        res = self.client_sup.get(f"/api/academic/lessons/{self.lesson_mine.id}/")
        self.assertEqual(res.status_code, 200)

    # ── الكتابة ──────────────────────────────────────────────────────────────

    def test_cannot_create_lesson_outside_scope(self):
        res = self.client_sup.post("/api/academic/lessons/", {
            "unit": self.unit_other.id, "title": "تسلل",
        })
        self.assertEqual(res.status_code, 403)
        self.assertFalse(Lesson.objects.filter(title="تسلل").exists())

    def test_can_create_lesson_inside_scope(self):
        res = self.client_sup.post("/api/academic/lessons/", {
            "unit": self.unit_mine.id, "title": "محاضرة مشروعة",
        })
        self.assertEqual(res.status_code, 201, res.data)

    def test_cannot_edit_lesson_outside_scope(self):
        res = self.client_sup.patch(
            f"/api/academic/lessons/{self.lesson_other.id}/",
            {"title": "عبث"}, format="json",
        )
        self.assertEqual(res.status_code, 404)

        self.lesson_other.refresh_from_db()
        self.assertEqual(self.lesson_other.title, "محاضرة خارج نطاقي")

    def test_can_edit_lesson_inside_scope(self):
        res = self.client_sup.patch(
            f"/api/academic/lessons/{self.lesson_mine.id}/",
            {"title": "عنوان محدَّث"}, format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)

    # ── حالات حدّية ──────────────────────────────────────────────────────────

    def test_supervisor_without_assignments_sees_nothing(self):
        from accounts.models import LectureSupervisorProfile
        lonely = _user("sc_lonely", CustomUser.Roles.LECTURE_SUPERVISOR)
        LectureSupervisorProfile.objects.create(user=lonely)

        c = APIClient()
        c.force_authenticate(user=lonely)
        res = c.get("/api/academic/lessons/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(_rows(res)), 0)

    def test_supervisor_without_profile_is_denied(self):
        """دور مشرف بلا ملف: لا ينهار الطلب ولا يُمنح وصولاً واسعاً."""
        orphan = _user("sc_orphan", CustomUser.Roles.LECTURE_SUPERVISOR)
        c = APIClient()
        c.force_authenticate(user=orphan)

        res = c.get("/api/academic/lessons/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(_rows(res)), 0)

    def test_other_roles_are_not_scoped(self):
        """المدير والأستاذ يريان كل المحاضرات."""
        for name, role in (
            ("sc_admin", CustomUser.Roles.ADMIN),
            ("sc_teacher", CustomUser.Roles.TEACHER),
        ):
            with self.subTest(role=role):
                c = APIClient()
                c.force_authenticate(user=_user(name, role))
                res = c.get("/api/academic/lessons/")
                titles = {r["title"] for r in _rows(res)}
                self.assertIn("محاضرة خارج نطاقي", titles)
