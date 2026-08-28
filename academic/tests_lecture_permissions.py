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
from academic.models import (
    Level, Grade, Course, Unit, Lesson, Exercise, Question, Choice,
)


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


class ExerciseWriteTests(TestCase):
    """
    التمرين جزء من المحاضرة فيتبع صلاحياتها.

    كانت التمارين والأسئلة والخيارات كلها IsAdminOrManager، فكان الأستاذ
    والمشرف ينشئان محاضرة ثم يعجزان عن إضافة تمرين لها.
    """

    def setUp(self):
        self.level = Level.objects.create(name="مرحلة")
        self.grade = Grade.objects.create(level=self.level, name="صف")
        self.course = Course.objects.create(grade=self.grade, name="كورس")
        self.unit = Unit.objects.create(course=self.course, name="وحدة")
        self.lesson = Lesson.objects.create(unit=self.unit, title="محاضرة")

        self.roles = {
            "admin":      _user("ex_admin",      CustomUser.Roles.ADMIN),
            "teacher":    _user("ex_teacher",    CustomUser.Roles.TEACHER),
            "supervisor": _user("ex_supervisor", CustomUser.Roles.LECTURE_SUPERVISOR),
        }

        from accounts.models import LectureSupervisorProfile
        profile = LectureSupervisorProfile.objects.create(
            user=self.roles["supervisor"]
        )
        profile.assigned_courses.add(self.course)

    def _client(self, role):
        c = APIClient()
        c.force_authenticate(user=self.roles[role])
        return c

    def test_teacher_and_supervisor_can_create_exercise(self):
        for role in ("teacher", "supervisor", "admin"):
            with self.subTest(role=role):
                lesson = Lesson.objects.create(
                    unit=self.unit, title=f"محاضرة {role}"
                )
                res = self._client(role).post("/api/academic/exercises/", {
                    "lesson": lesson.id, "title": f"تمرين {role}",
                })
                self.assertEqual(res.status_code, 201, res.data)

    def test_teacher_can_add_question_and_choice(self):
        exercise = Exercise.objects.create(lesson=self.lesson, title="تمرين")

        res = self._client("teacher").post(
            f"/api/academic/exercises/{exercise.id}/questions/",
            {"text": "سؤال الأستاذ"},
        )
        self.assertEqual(res.status_code, 201, res.data)
        question_id = res.data["id"]

        res = self._client("teacher").post(
            f"/api/academic/questions/{question_id}/choices/",
            {"text": "إجابة", "is_correct": True},
        )
        self.assertEqual(res.status_code, 201, res.data)

    def test_teacher_can_edit_exercise(self):
        exercise = Exercise.objects.create(lesson=self.lesson, title="قديم")
        res = self._client("teacher").patch(
            f"/api/academic/exercises/{exercise.id}/",
            {"title": "محدَّث"}, format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)

    def test_teacher_cannot_delete_exercise(self):
        """الحذف يبقى بيد الإدارة، كما في المحاضرات."""
        exercise = Exercise.objects.create(lesson=self.lesson, title="تمرين")
        res = self._client("teacher").delete(
            f"/api/academic/exercises/{exercise.id}/"
        )
        self.assertEqual(res.status_code, 403)

    def test_student_cannot_create_exercise(self):
        student = _user("ex_student", CustomUser.Roles.STUDENT)
        c = APIClient()
        c.force_authenticate(user=student)
        res = c.post("/api/academic/exercises/", {
            "lesson": self.lesson.id, "title": "تسلل",
        })
        self.assertEqual(res.status_code, 403)


class ExerciseScopeTests(TestCase):
    """
    الحصر يمتد للتمارين، وإلا صار تعديل تمرين محاضرةٍ التفافاً على حصر
    المحاضرة نفسها.
    """

    def setUp(self):
        self.level = Level.objects.create(name="مرحلة")
        self.grade = Grade.objects.create(level=self.level, name="صف")

        self.mine = Course.objects.create(grade=self.grade, name="كورسي")
        self.other = Course.objects.create(grade=self.grade, name="كورس غيري")

        unit_mine = Unit.objects.create(course=self.mine, name="و1")
        unit_other = Unit.objects.create(course=self.other, name="و2")

        self.lesson_mine = Lesson.objects.create(unit=unit_mine, title="م1")
        self.lesson_other = Lesson.objects.create(unit=unit_other, title="م2")

        self.ex_other = Exercise.objects.create(
            lesson=self.lesson_other, title="تمرين خارج نطاقي"
        )
        self.q_other = Question.objects.create(
            exercise=self.ex_other, text="سؤال خارج نطاقي"
        )

        from accounts.models import LectureSupervisorProfile
        self.supervisor = _user("es_sup", CustomUser.Roles.LECTURE_SUPERVISOR)
        profile = LectureSupervisorProfile.objects.create(user=self.supervisor)
        profile.assigned_courses.add(self.mine)

        self.c = APIClient()
        self.c.force_authenticate(user=self.supervisor)

    def test_cannot_create_exercise_outside_scope(self):
        res = self.c.post("/api/academic/exercises/", {
            "lesson": self.lesson_other.id, "title": "تسلل",
        })
        self.assertEqual(res.status_code, 403)
        self.assertFalse(Exercise.objects.filter(title="تسلل").exists())

    def test_can_create_exercise_inside_scope(self):
        res = self.c.post("/api/academic/exercises/", {
            "lesson": self.lesson_mine.id, "title": "تمرين مشروع",
        })
        self.assertEqual(res.status_code, 201, res.data)

    def test_cannot_read_or_edit_exercise_outside_scope(self):
        url = f"/api/academic/exercises/{self.ex_other.id}/"
        self.assertEqual(self.c.get(url).status_code, 404)

        res = self.c.patch(url, {"title": "عبث"}, format="json")
        self.assertEqual(res.status_code, 404)

        self.ex_other.refresh_from_db()
        self.assertEqual(self.ex_other.title, "تمرين خارج نطاقي")

    def test_cannot_add_question_outside_scope(self):
        res = self.c.post(
            f"/api/academic/exercises/{self.ex_other.id}/questions/",
            {"text": "تسلل"},
        )
        self.assertEqual(res.status_code, 403)

    def test_cannot_add_choice_outside_scope(self):
        res = self.c.post(
            f"/api/academic/questions/{self.q_other.id}/choices/",
            {"text": "تسلل", "is_correct": True},
        )
        self.assertEqual(res.status_code, 403)

    def test_question_list_outside_scope_is_empty(self):
        res = self.c.get(
            f"/api/academic/exercises/{self.ex_other.id}/questions/"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(_rows(res)), 0)

    def test_teacher_is_not_scoped_on_exercises(self):
        teacher = _user("es_teacher", CustomUser.Roles.TEACHER)
        c = APIClient()
        c.force_authenticate(user=teacher)

        res = c.get(f"/api/academic/exercises/{self.ex_other.id}/")
        self.assertEqual(res.status_code, 200)


class QuestionChoiceEditTests(TestCase):
    """
    تحرير أسئلة التمرين وخياراته.

    لم تكن هناك مسارات تفصيلية للأسئلة ولا للخيارات إطلاقاً — تُنشأ وتُقرأ
    فقط — بينما لوحة التحكم تنادي DELETE /academic/questions/<id>/ فتحصل
    على 404. فكان بناء تمرين عملية بلا رجعة: أي خطأ يبقى.
    """

    def setUp(self):
        self.level = Level.objects.create(name="مرحلة")
        self.grade = Grade.objects.create(level=self.level, name="صف")
        self.course = Course.objects.create(grade=self.grade, name="كورس")
        self.unit = Unit.objects.create(course=self.course, name="وحدة")
        self.lesson = Lesson.objects.create(unit=self.unit, title="محاضرة")
        self.exercise = Exercise.objects.create(lesson=self.lesson, title="تمرين")
        self.question = Question.objects.create(
            exercise=self.exercise, text="نص السؤال الأصلي"
        )
        self.choice = Choice.objects.create(
            question=self.question, text="خيار أصلي", is_correct=False
        )

        self.roles = {
            "admin":      _user("qc_admin",      CustomUser.Roles.ADMIN),
            "teacher":    _user("qc_teacher",    CustomUser.Roles.TEACHER),
            "supervisor": _user("qc_supervisor", CustomUser.Roles.LECTURE_SUPERVISOR),
        }
        from accounts.models import LectureSupervisorProfile
        profile = LectureSupervisorProfile.objects.create(
            user=self.roles["supervisor"]
        )
        profile.assigned_courses.add(self.course)

    def _client(self, role):
        c = APIClient()
        c.force_authenticate(user=self.roles[role])
        return c

    def test_question_delete_route_exists(self):
        """المسار الذي تناديه لوحة التحكم وكان يرجع 404."""
        res = self._client("admin").delete(
            f"/api/academic/questions/{self.question.id}/"
        )
        self.assertEqual(res.status_code, 204)
        self.assertFalse(Question.objects.filter(pk=self.question.pk).exists())

    def test_teacher_and_supervisor_can_edit_question(self):
        for role in ("teacher", "supervisor"):
            with self.subTest(role=role):
                res = self._client(role).patch(
                    f"/api/academic/questions/{self.question.id}/",
                    {"text": f"نص عدّله {role}"}, format="json",
                )
                self.assertEqual(res.status_code, 200, res.data)

        self.question.refresh_from_db()
        self.assertNotEqual(self.question.text, "نص السؤال الأصلي")

    def test_teacher_and_supervisor_can_delete_question(self):
        """سحب سؤال أُضيف بالخطأ جزء من تحرير التمرين، لا حذف محتوى منشور."""
        for role in ("teacher", "supervisor"):
            with self.subTest(role=role):
                q = Question.objects.create(
                    exercise=self.exercise, text=f"سؤال {role}"
                )
                res = self._client(role).delete(
                    f"/api/academic/questions/{q.id}/"
                )
                self.assertEqual(res.status_code, 204)

    def test_teacher_can_edit_and_delete_choice(self):
        res = self._client("teacher").patch(
            f"/api/academic/choices/{self.choice.id}/",
            {"is_correct": True}, format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)

        self.choice.refresh_from_db()
        self.assertTrue(self.choice.is_correct)

        res = self._client("teacher").delete(
            f"/api/academic/choices/{self.choice.id}/"
        )
        self.assertEqual(res.status_code, 204)

    def test_lesson_and_exercise_deletion_stay_with_admins(self):
        """الحذف الموسَّع للأسئلة لا يمتد للمحاضرة أو التمرين."""
        c = self._client("teacher")
        self.assertEqual(
            c.delete(f"/api/academic/lessons/{self.lesson.id}/").status_code, 403
        )
        self.assertEqual(
            c.delete(f"/api/academic/exercises/{self.exercise.id}/").status_code, 403
        )

    def test_student_cannot_touch_questions(self):
        student = _user("qc_student", CustomUser.Roles.STUDENT)
        c = APIClient()
        c.force_authenticate(user=student)

        self.assertEqual(
            c.patch(f"/api/academic/questions/{self.question.id}/",
                    {"text": "عبث"}, format="json").status_code, 403
        )
        self.assertEqual(
            c.delete(f"/api/academic/questions/{self.question.id}/").status_code, 403
        )


class QuestionChoiceScopeTests(TestCase):
    """المسارات الجديدة محصورة كغيرها، وإلا صارت باباً خلفياً."""

    def setUp(self):
        self.level = Level.objects.create(name="مرحلة")
        self.grade = Grade.objects.create(level=self.level, name="صف")
        mine = Course.objects.create(grade=self.grade, name="كورسي")
        other = Course.objects.create(grade=self.grade, name="كورس غيري")

        u_other = Unit.objects.create(course=other, name="و")
        l_other = Lesson.objects.create(unit=u_other, title="م")
        ex_other = Exercise.objects.create(lesson=l_other, title="ت")
        self.q_other = Question.objects.create(exercise=ex_other, text="سؤال غيري")
        self.ch_other = Choice.objects.create(
            question=self.q_other, text="خيار غيري", is_correct=True
        )

        from accounts.models import LectureSupervisorProfile
        sup = _user("qs_sup", CustomUser.Roles.LECTURE_SUPERVISOR)
        LectureSupervisorProfile.objects.create(user=sup).assigned_courses.add(mine)

        self.c = APIClient()
        self.c.force_authenticate(user=sup)

    def test_cannot_edit_question_outside_scope(self):
        res = self.c.patch(
            f"/api/academic/questions/{self.q_other.id}/",
            {"text": "عبث"}, format="json",
        )
        self.assertEqual(res.status_code, 404)

        self.q_other.refresh_from_db()
        self.assertEqual(self.q_other.text, "سؤال غيري")

    def test_cannot_delete_question_outside_scope(self):
        res = self.c.delete(f"/api/academic/questions/{self.q_other.id}/")
        self.assertEqual(res.status_code, 404)
        self.assertTrue(Question.objects.filter(pk=self.q_other.pk).exists())

    def test_cannot_edit_choice_outside_scope(self):
        res = self.c.patch(
            f"/api/academic/choices/{self.ch_other.id}/",
            {"is_correct": False}, format="json",
        )
        self.assertEqual(res.status_code, 404)
