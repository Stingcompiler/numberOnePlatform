"""
================================================================================
accounts/tests_account_deletion.py
================================================================================
حذف الحساب يجب أن يحرّر اسم المستخدم.

العلة: نقاط الحذف تعمل على الملف الشخصي (StudentProfile / TeacherProfile /
LectureSupervisorProfile) لا على CustomUser. العلاقة OneToOne تتتالى من
المستخدم إلى الملف لا العكس، فحذف الملف يترك صف المستخدم يتيماً واسمه
محجوزاً إلى الأبد.

النتيجة التي رآها المستخدم: حذف طالب ثم محاولة تسجيله من جديد بنفس اسم
المستخدم ترفض بـ "اسم المستخدم مسجّل مسبقاً" — وهو حساب لم يعد ظاهراً في
أي قائمة.
================================================================================
"""

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import (
    CustomUser, StudentProfile, TeacherProfile, LectureSupervisorProfile,
)


class StudentDeletionTests(TestCase):

    def setUp(self):
        self.admin = CustomUser.objects.create_user(
            username="del_admin", password="pass12345",
            full_name="مدير", role=CustomUser.Roles.ADMIN,
        )
        self.client_admin = APIClient()
        self.client_admin.force_authenticate(user=self.admin)

    def _create_student(self, username="ahmed_2026"):
        return self.client_admin.post("/api/students/", {
            "username": username,
            "full_name": "أحمد محمود",
            "password": "pass12345",
            "guardian_name": "محمود سالم",
            "guardian_phone": "0900000000",
        })

    def test_deleting_student_frees_the_username(self):
        """السيناريو المُبلَّغ عنه حرفياً."""
        res = self._create_student()
        self.assertEqual(res.status_code, 201, res.data)
        profile_id = res.data["id"]

        res = self.client_admin.delete(f"/api/students/{profile_id}/")
        self.assertEqual(res.status_code, 204)

        # لا ملف ولا مستخدم يتيم
        self.assertFalse(StudentProfile.objects.filter(pk=profile_id).exists())
        self.assertFalse(
            CustomUser.objects.filter(username="ahmed_2026").exists(),
            "بقي صف CustomUser يتيماً بعد حذف الملف",
        )

        # وإعادة التسجيل بنفس الاسم تنجح
        res = self._create_student()
        self.assertEqual(res.status_code, 201, res.data)

    def test_deletion_removes_dependent_records(self):
        """المالية والوصول للكورسات تتفرّع عن الملف فتذهب معه."""
        from finance.models import FinancialFile

        res = self._create_student("student_cascade")
        profile_id = res.data["id"]
        self.assertTrue(
            FinancialFile.objects.filter(student_id=profile_id).exists(),
            "الـ signal لم يُنشئ الملف المالي — الافتراض الذي يقوم عليه الاختبار",
        )

        self.client_admin.delete(f"/api/students/{profile_id}/")
        self.assertFalse(FinancialFile.objects.filter(student_id=profile_id).exists())

    def test_device_id_is_released_for_reuse(self):
        """
        device_id فريد على مستوى الجدول. لو بقي الصف بعد الحذف، لتعذّر على
        الطالب الجديد الربط بنفس الحاسوب.
        """
        res = self._create_student("device_holder")
        profile = StudentProfile.objects.get(pk=res.data["id"])
        profile.bind_device("hw-win-shared-lab")

        self.client_admin.delete(f"/api/students/{profile.pk}/")

        res = self._create_student("device_holder")
        new_profile = StudentProfile.objects.get(pk=res.data["id"])
        new_profile.bind_device("hw-win-shared-lab")  # يجب ألا يرفع استثناء
        self.assertEqual(new_profile.device_id, "hw-win-shared-lab")


class StaffDeletionTests(TestCase):
    """نفس العلة تصيب الأستاذ ومشرف الكورسات."""

    def setUp(self):
        self.admin = CustomUser.objects.create_user(
            username="staff_admin", password="pass12345",
            full_name="مدير", role=CustomUser.Roles.ADMIN,
        )
        self.client_admin = APIClient()
        self.client_admin.force_authenticate(user=self.admin)

    def test_deleting_teacher_frees_the_username(self):
        user = CustomUser.objects.create_user(
            username="teacher_x", password="pass12345",
            full_name="أستاذ", role=CustomUser.Roles.TEACHER,
        )
        profile = TeacherProfile.objects.create(user=user)

        res = self.client_admin.delete(f"/api/teachers/{profile.pk}/")
        self.assertEqual(res.status_code, 204)

        self.assertFalse(TeacherProfile.objects.filter(pk=profile.pk).exists())
        self.assertFalse(CustomUser.objects.filter(username="teacher_x").exists())

    def test_deleting_lecture_supervisor_frees_the_username(self):
        user = CustomUser.objects.create_user(
            username="supervisor_x", password="pass12345",
            full_name="مشرف", role=CustomUser.Roles.LECTURE_SUPERVISOR,
        )
        profile = LectureSupervisorProfile.objects.create(user=user)

        res = self.client_admin.delete(f"/api/lecture-supervisors/{profile.pk}/")
        self.assertEqual(res.status_code, 204)

        self.assertFalse(
            LectureSupervisorProfile.objects.filter(pk=profile.pk).exists()
        )
        self.assertFalse(CustomUser.objects.filter(username="supervisor_x").exists())

    def test_deletion_does_not_wipe_authored_content(self):
        """
        حقول التأليف على CustomUser كلها SET_NULL، فحذف أستاذ لا يجرّ معه
        الكورسات التي كان مسؤولاً عنها.
        """
        from academic.models import Level, Grade, Course

        user = CustomUser.objects.create_user(
            username="teacher_author", password="pass12345",
            full_name="أستاذ", role=CustomUser.Roles.TEACHER,
        )
        profile = TeacherProfile.objects.create(user=user)

        level = Level.objects.create(name="مرحلة")
        grade = Grade.objects.create(level=level, name="صف")
        course = Course.objects.create(grade=grade, name="كورس", teacher=user)

        self.client_admin.delete(f"/api/teachers/{profile.pk}/")

        course.refresh_from_db()
        self.assertIsNone(course.teacher, "الكورس فقد أستاذه لكنه يجب أن يبقى")


class AtomicCreationTests(TestCase):
    """
    إنشاء الحساب والملف الشخصي كان جملتين منفصلتين بلا معاملة، فأي فشل في
    الثانية يترك نفس اليتيم الذي خلّفه الحذف — مصدر ثانٍ مستقل للعَرَض نفسه.
    """

    def test_failed_profile_creation_leaves_no_orphan_user(self):
        from unittest import mock
        from accounts.serializers import StudentCreateSerializer

        data = {
            "username": "atomic_test",
            "full_name": "طالب",
            "password": "pass12345",
            "guardian_name": "ولي",
            "guardian_phone": "0900000000",
        }
        serializer = StudentCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

        with mock.patch.object(
            StudentProfile.objects, "create", side_effect=RuntimeError("فشل مفتعل")
        ):
            with self.assertRaises(RuntimeError):
                serializer.save()

        self.assertFalse(
            CustomUser.objects.filter(username="atomic_test").exists(),
            "بقي المستخدم رغم فشل إنشاء ملفه",
        )


class PruneOrphanAccountsTests(TestCase):
    """أمر تنظيف الصفوف التي خلّفها الكود القديم في الإنتاج."""

    def setUp(self):
        self.orphan = CustomUser.objects.create_user(
            username="orphan_student", password="pass12345",
            full_name="يتيم", role=CustomUser.Roles.STUDENT,
        )
        self.healthy = CustomUser.objects.create_user(
            username="healthy_student", password="pass12345",
            full_name="سليم", role=CustomUser.Roles.STUDENT,
        )
        StudentProfile.objects.create(user=self.healthy)

        self.admin = CustomUser.objects.create_user(
            username="prune_admin", password="pass12345",
            full_name="مدير", role=CustomUser.Roles.ADMIN,
        )

    def _run(self, *args):
        from io import StringIO
        from django.core.management import call_command
        out = StringIO()
        call_command("prune_orphan_accounts", *args, stdout=out)
        return out.getvalue()

    def test_dry_run_reports_without_deleting(self):
        out = self._run()
        self.assertIn("orphan_student", out)
        self.assertNotIn("healthy_student", out)
        self.assertTrue(CustomUser.objects.filter(pk=self.orphan.pk).exists())

    def test_delete_removes_only_orphans(self):
        self._run("--delete")

        self.assertFalse(CustomUser.objects.filter(pk=self.orphan.pk).exists())
        self.assertTrue(CustomUser.objects.filter(pk=self.healthy.pk).exists())
        self.assertTrue(CustomUser.objects.filter(pk=self.admin.pk).exists())

    def test_admins_are_never_treated_as_orphans(self):
        """المدير لا ملف شخصي له بحكم التصميم — لا يجوز عدّه يتيماً."""
        out = self._run()
        self.assertNotIn("prune_admin", out)

    def test_freed_username_can_be_reused(self):
        self._run("--delete")

        client = APIClient()
        client.force_authenticate(user=self.admin)
        res = client.post("/api/students/", {
            "username": "orphan_student",
            "full_name": "طالب جديد",
            "password": "pass12345",
            "guardian_name": "ولي",
            "guardian_phone": "0900000000",
        })
        self.assertEqual(res.status_code, 201, res.data)
