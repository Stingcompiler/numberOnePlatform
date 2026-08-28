"""
================================================================================
accounts/tests_password_policy.py
================================================================================
سياسة كلمات المرور: الطالب لا يغيّر كلمته بنفسه.

القاعدة:
  - الطالب  → ممنوع (403) من /api/auth/change-password/
  - الأستاذ / مشرف الكورسات / المدير → مسموح (تغيير ذاتي من لوحة التحكم)
  - المدير  → يعيد تعيين كلمة الطالب عبر /api/admin/reset-password/

الحماية كانت قبل هذا الاختبار مجرد غياب زر في الواجهة؛ الـ endpoint كان
مفتوحاً لأي مستخدم مصادق عليه بما فيهم الطالب.
================================================================================
"""

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import CustomUser, StudentProfile


def _make_user(username, role):
    return CustomUser.objects.create_user(
        username=username,
        password="oldpass123",
        full_name=f"مستخدم {username}",
        role=role,
    )


class ChangePasswordPolicyTests(TestCase):

    def setUp(self):
        self.student = _make_user("pw_student", CustomUser.Roles.STUDENT)
        StudentProfile.objects.create(user=self.student)
        self.teacher    = _make_user("pw_teacher",    CustomUser.Roles.TEACHER)
        self.supervisor = _make_user("pw_supervisor", CustomUser.Roles.LECTURE_SUPERVISOR)
        self.manager    = _make_user("pw_manager",    CustomUser.Roles.MANAGER)
        self.admin      = _make_user("pw_admin",      CustomUser.Roles.ADMIN)

    def _change(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client.post("/api/auth/change-password/", {
            "old_password": "oldpass123",
            "new_password": "newpass456",
        })

    # ── الطالب ممنوع ─────────────────────────────────────────────────────────

    def test_student_cannot_change_own_password(self):
        res = self._change(self.student)
        self.assertEqual(res.status_code, 403)

        self.student.refresh_from_db()
        self.assertTrue(
            self.student.check_password("oldpass123"),
            "كلمة مرور الطالب تغيّرت رغم الرفض",
        )

    def test_anonymous_cannot_change_password(self):
        res = APIClient().post("/api/auth/change-password/", {
            "old_password": "oldpass123",
            "new_password": "newpass456",
        })
        self.assertIn(res.status_code, (401, 403))

    # ── بقية الأدوار مسموح لها (حارس انحدار للوحة التحكم) ───────────────────

    def test_teacher_can_still_change_own_password(self):
        res = self._change(self.teacher)
        self.assertEqual(res.status_code, 200)

        self.teacher.refresh_from_db()
        self.assertTrue(self.teacher.check_password("newpass456"))

    def test_lecture_supervisor_can_still_change_own_password(self):
        self.assertEqual(self._change(self.supervisor).status_code, 200)

    def test_manager_can_still_change_own_password(self):
        self.assertEqual(self._change(self.manager).status_code, 200)

    def test_admin_can_still_change_own_password(self):
        self.assertEqual(self._change(self.admin).status_code, 200)

    # ── المسار المسموح للطالب: إعادة التعيين من الإدارة ─────────────────────

    def test_admin_can_reset_student_password(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)
        res = client.post("/api/admin/reset-password/", {
            "user_id": str(self.student.pk),
            "new_password": "adminset789",
            "confirm_password": "adminset789",
        })
        self.assertEqual(res.status_code, 200, res.data)

        self.student.refresh_from_db()
        self.assertTrue(self.student.check_password("adminset789"))

    def test_student_cannot_use_admin_reset(self):
        client = APIClient()
        client.force_authenticate(user=self.student)
        res = client.post("/api/admin/reset-password/", {
            "user_id": str(self.student.pk),
            "new_password": "selfset789",
            "confirm_password": "selfset789",
        })
        self.assertEqual(res.status_code, 403)
