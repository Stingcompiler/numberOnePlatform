"""
================================================================================
accounts/tests_device_binding.py
================================================================================
اختبارات ربط الجهاز — سياسة "جهاز واحد حصري لكل طالب".

تُغطّي:
  - الربط الأول يملأ device_type تلقائياً من سابقة المعرّف.
  - رفض جهاز ثانٍ لنفس الطالب (السياسة الحصرية).
  - رفض جهاز مرتبط بحساب طالب آخر (الحاسوب المشترك) برسالة واضحة
    بدلاً من IntegrityError.
  - فك الربط يمسح device_type أيضاً.
  - device_type الصريح من العميل يتقدّم على الاستنتاج.
================================================================================
"""

from django.test import TestCase

from accounts.models import CustomUser, StudentProfile
from accounts.serializers import LoginSerializer


def _make_student(username: str) -> StudentProfile:
    user = CustomUser.objects.create_user(
        username=username,
        password="pass12345",
        full_name=f"طالب {username}",
        role=CustomUser.Roles.STUDENT,
    )
    return StudentProfile.objects.create(user=user)


class BindDeviceTests(TestCase):

    def test_first_bind_infers_device_type_from_prefix(self):
        profile = _make_student("s1")
        profile.bind_device("hw-android-abc123")

        profile.refresh_from_db()
        self.assertEqual(profile.device_id, "hw-android-abc123")
        self.assertEqual(profile.device_type, "Android")
        self.assertIsNotNone(profile.device_bound_at)

    def test_desktop_prefixes_are_recognised(self):
        win = _make_student("s_win")
        win.bind_device("hw-win-0000")
        self.assertEqual(win.device_type, "Windows")

        mac = _make_student("s_mac")
        mac.bind_device("hw-mac-1111")
        self.assertEqual(mac.device_type, "macOS")

    def test_unknown_prefix_falls_back_gracefully(self):
        profile = _make_student("s_unknown")
        profile.bind_device("fallback-device-id-something")
        self.assertEqual(profile.device_type, "غير معروف")

    def test_explicit_device_type_wins_over_inference(self):
        profile = _make_student("s_explicit")
        profile.bind_device("hw-win-2222", device_type="Windows 11 Pro")
        self.assertEqual(profile.device_type, "Windows 11 Pro")

    def test_rebinding_same_device_is_idempotent(self):
        profile = _make_student("s_same")
        profile.bind_device("hw-android-same")
        bound_at = profile.device_bound_at

        profile.bind_device("hw-android-same")  # must not raise
        profile.refresh_from_db()
        self.assertEqual(profile.device_bound_at, bound_at)

    def test_second_device_for_same_student_is_rejected(self):
        """السياسة الحصرية: الطالب المرتبط بهاتفه لا يستطيع استخدام الديسكتوب."""
        profile = _make_student("s_two")
        profile.bind_device("hw-android-phone")

        with self.assertRaises(PermissionError) as ctx:
            profile.bind_device("hw-win-desktop")
        self.assertIn("مرتبط بجهاز آخر", str(ctx.exception))

        profile.refresh_from_db()
        self.assertEqual(profile.device_id, "hw-android-phone")

    def test_shared_device_across_students_raises_permission_error(self):
        """
        الحاسوب المشترك: طالب آخر على نفس الجهاز.
        يجب أن تكون النتيجة PermissionError (تتحوّل إلى 400)
        لا IntegrityError من قيد unique (تتحوّل إلى 500).
        """
        first = _make_student("s_first")
        first.bind_device("hw-win-shared-pc")

        second = _make_student("s_second")
        with self.assertRaises(PermissionError) as ctx:
            second.bind_device("hw-win-shared-pc")
        self.assertIn("مرتبط بحساب طالب آخر", str(ctx.exception))

        second.refresh_from_db()
        self.assertIsNone(second.device_id)

    def test_unbind_clears_device_type_too(self):
        profile = _make_student("s_unbind")
        profile.bind_device("hw-android-xyz")
        self.assertEqual(profile.device_type, "Android")

        profile.unbind_device()
        profile.refresh_from_db()
        self.assertIsNone(profile.device_id)
        self.assertIsNone(profile.device_bound_at)
        self.assertIsNone(profile.device_type)

        # بعد الفك يمكن ربط جهاز جديد
        profile.bind_device("hw-win-new")
        self.assertEqual(profile.device_type, "Windows")


class LoginSerializerDeviceTests(TestCase):
    """يتحقّق أن طبقة تسجيل الدخول تمرّر device_type وتظل متوافقة مع العملاء القدامى."""

    def test_login_without_device_type_still_works(self):
        """عميل الموبايل المنشور لا يرسل device_type — يجب ألا ينكسر."""
        profile = _make_student("s_login_old")

        serializer = LoginSerializer(data={
            "username": "s_login_old",
            "password": "pass12345",
            "device_id": "hw-android-legacy",
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)

        profile.refresh_from_db()
        self.assertEqual(profile.device_id, "hw-android-legacy")
        self.assertEqual(profile.device_type, "Android")

    def test_login_with_device_type_is_stored(self):
        profile = _make_student("s_login_new")

        serializer = LoginSerializer(data={
            "username": "s_login_new",
            "password": "pass12345",
            "device_id": "hw-win-desk",
            "device_type": "Windows 11 — Dell OptiPlex",
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)

        profile.refresh_from_db()
        self.assertEqual(profile.device_type, "Windows 11 — Dell OptiPlex")

    def test_device_mismatch_surfaces_as_validation_error(self):
        """PermissionError يجب أن يصير خطأ تحقّق (400) لا استثناء غير معالَج (500)."""
        profile = _make_student("s_login_mismatch")
        profile.bind_device("hw-android-bound")

        serializer = LoginSerializer(data={
            "username": "s_login_mismatch",
            "password": "pass12345",
            "device_id": "hw-win-other",
        })
        self.assertFalse(serializer.is_valid())

    def test_shared_device_surfaces_as_validation_error(self):
        owner = _make_student("s_owner")
        owner.bind_device("hw-win-lab-pc")
        _make_student("s_visitor")

        serializer = LoginSerializer(data={
            "username": "s_visitor",
            "password": "pass12345",
            "device_id": "hw-win-lab-pc",
        })
        self.assertFalse(serializer.is_valid())

    def test_login_without_device_id_does_not_bind(self):
        """تسجيل الدخول من لوحة التحكم لا يمرّر device_id — يجب ألا يربط شيئاً."""
        profile = _make_student("s_no_device")

        serializer = LoginSerializer(data={
            "username": "s_no_device",
            "password": "pass12345",
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)

        profile.refresh_from_db()
        self.assertIsNone(profile.device_id)
