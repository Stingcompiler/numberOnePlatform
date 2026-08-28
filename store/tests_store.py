"""
================================================================================
store/tests_store.py
================================================================================
اختبارات متجر التطبيقات.

تُغطّي:
  - العام: المنشور فقط، وبلا حقول خام
  - الصلاحيات: الإدارة تكتب، ومن عداها لا
  - التحقق: متطلبات كل منصة، والامتدادات، والأحجام
  - النشر: يتطلب منصة صالحة
  - البحث والفلترة
  - حارس انحدار: نقاط النهاية القائمة لم تتأثر
================================================================================
"""

import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import CustomUser
from store.models import App, AppPlatform, AppScreenshot, MAX_PACKAGE_MB


#: الاختبارات ترفع ملفات فعلية. بلا هذا يكتب الرفع في MEDIA_ROOT الحقيقي
#: فتتسرّب ملفات الاختبار إلى شجرة المشروع — وقد وصلت إلى commit بالفعل.
_TEST_MEDIA = tempfile.mkdtemp(prefix="store-tests-")


def _isolated_media(cls):
    """يعزل MEDIA_ROOT للصنف وينظّفه بعده."""
    cls = override_settings(MEDIA_ROOT=_TEST_MEDIA)(cls)
    original = cls.tearDownClass

    @classmethod
    def tearDownClass(inner_cls):
        original.__func__(inner_cls)
        shutil.rmtree(_TEST_MEDIA, ignore_errors=True)

    cls.tearDownClass = tearDownClass
    return cls


def _user(username, role):
    return CustomUser.objects.create_user(
        username=username, password="pass12345",
        full_name=f"مستخدم {username}", role=role,
    )


def _upload(name, size_mb=0.001):
    return SimpleUploadedFile(
        name, b"x" * int(size_mb * 1024 * 1024) or b"x",
        content_type="application/octet-stream",
    )


class PublicStoreTests(TestCase):
    """المتجر العام: بلا مصادقة — الزائر لا يملك تطبيقاً يسجّل به بعد."""

    def setUp(self):
        self.published = App.objects.create(
            name="تطبيق الطالب", short_description="للمحاضرات والاختبارات",
            is_published=True,
        )
        AppPlatform.objects.create(
            app=self.published, platform="android",
            store_url="https://play.google.com/store/apps/details?id=one.number",
        )

        self.draft = App.objects.create(name="تطبيق قيد الإعداد", is_published=False)
        AppPlatform.objects.create(
            app=self.draft, platform="android",
            store_url="https://play.google.com/store/apps/details?id=draft",
        )

        self.client = APIClient()

    def test_list_is_reachable_without_authentication(self):
        res = self.client.get("/api/public/store/apps/")
        self.assertEqual(res.status_code, 200)

    def test_list_shows_only_published_apps(self):
        res = self.client.get("/api/public/store/apps/")
        names = {row["name"] for row in res.data}
        self.assertIn("تطبيق الطالب", names)
        self.assertNotIn("تطبيق قيد الإعداد", names)

    def test_unpublished_detail_is_404(self):
        res = self.client.get(f"/api/public/store/apps/{self.draft.id}/")
        self.assertEqual(res.status_code, 404)

    def test_published_detail_is_readable(self):
        res = self.client.get(f"/api/public/store/apps/{self.published.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("screenshots", res.data)

    def test_public_payload_hides_raw_source_fields(self):
        """
        الواجهة تحصل على download_url محسوباً. إرسال الحقول الثلاثة الخام
        يدعو الواجهة لبناء منطق أولوية ثانٍ يخالف منطق الموديل.
        """
        res = self.client.get("/api/public/store/apps/")
        platform = res.data[0]["platforms"][0]

        self.assertIn("download_url", platform)
        for raw in ("store_url", "external_url", "file"):
            self.assertNotIn(raw, platform)

    def test_platform_without_destination_is_not_listed(self):
        """صف بلا رابط ولا ملف = بيانات ناقصة، لا زر معطّل."""
        AppPlatform.objects.create(app=self.published, platform="windows")

        res = self.client.get("/api/public/store/apps/")
        platforms = {p["platform"] for p in res.data[0]["platforms"]}
        self.assertNotIn("windows", platforms)
        self.assertIn("android", platforms)

    def test_store_link_is_distinguishable_from_direct_download(self):
        res = self.client.get("/api/public/store/apps/")
        self.assertTrue(res.data[0]["platforms"][0]["is_store_link"])

    def test_filter_by_platform(self):
        res = self.client.get("/api/public/store/apps/", {"platform": "ios"})
        self.assertEqual(len(res.data), 0)

        res = self.client.get("/api/public/store/apps/", {"platform": "android"})
        self.assertEqual(len(res.data), 1)

    def test_search_by_name(self):
        res = self.client.get("/api/public/store/apps/", {"search": "الطالب"})
        self.assertEqual(len(res.data), 1)

        res = self.client.get("/api/public/store/apps/", {"search": "لا يوجد"})
        self.assertEqual(len(res.data), 0)


class StorePermissionTests(TestCase):

    def setUp(self):
        self.app = App.objects.create(name="تطبيق")
        self.roles = {
            "admin":   _user("st_admin",   CustomUser.Roles.ADMIN),
            "manager": _user("st_manager", CustomUser.Roles.MANAGER),
            "teacher": _user("st_teacher", CustomUser.Roles.TEACHER),
            "student": _user("st_student", CustomUser.Roles.STUDENT),
        }

    def _client(self, role):
        c = APIClient()
        c.force_authenticate(user=self.roles[role])
        return c

    def test_admin_and_manager_can_create(self):
        for role in ("admin", "manager"):
            with self.subTest(role=role):
                res = self._client(role).post(
                    "/api/admin/store/apps/", {"name": f"تطبيق {role}"}
                )
                self.assertEqual(res.status_code, 201, res.data)

    def test_teacher_and_student_cannot_write(self):
        for role in ("teacher", "student"):
            with self.subTest(role=role):
                res = self._client(role).post(
                    "/api/admin/store/apps/", {"name": "تسلل"}
                )
                self.assertEqual(res.status_code, 403)

    def test_teacher_and_student_cannot_read_admin_list(self):
        for role in ("teacher", "student"):
            with self.subTest(role=role):
                res = self._client(role).get("/api/admin/store/apps/")
                self.assertEqual(res.status_code, 403)

    def test_anonymous_cannot_reach_admin_endpoints(self):
        res = APIClient().get("/api/admin/store/apps/")
        self.assertIn(res.status_code, (401, 403))

    def test_admin_can_delete(self):
        res = self._client("admin").delete(f"/api/admin/store/apps/{self.app.id}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(App.objects.filter(pk=self.app.pk).exists())


@_isolated_media
class PlatformValidationTests(TestCase):
    """كل منصة تحقّق متطلباتها الخاصة، برسائل عربية منسوبة لحقولها."""

    def setUp(self):
        self.admin = _user("pv_admin", CustomUser.Roles.ADMIN)
        self.client_admin = APIClient()
        self.client_admin.force_authenticate(user=self.admin)
        self.app = App.objects.create(name="تطبيق")

    def _post(self, **data):
        return self.client_admin.post(
            f"/api/admin/store/apps/{self.app.id}/platforms/", data
        )

    # ── آي أو إس: رابط المتجر حصراً ───────────────────────────────────────

    def test_ios_requires_store_url(self):
        res = self._post(platform="ios")
        self.assertEqual(res.status_code, 400)
        self.assertIn("store_url", res.data)

    def test_ios_accepts_store_url(self):
        res = self._post(
            platform="ios",
            store_url="https://apps.apple.com/app/id123456789",
        )
        self.assertEqual(res.status_code, 201, res.data)

    def test_ios_rejects_uploaded_package(self):
        res = self._post(
            platform="ios",
            store_url="https://apps.apple.com/app/id1",
            file=_upload("app.ipa"),
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("file", res.data)

    # ── أندرويد: رابط متجر أو رابط مباشر ──────────────────────────────────

    def test_android_requires_a_link(self):
        res = self._post(platform="android")
        self.assertEqual(res.status_code, 400)

    def test_android_accepts_direct_link(self):
        res = self._post(
            platform="android",
            external_url="https://numberoneschools.com/dl/app.apk",
        )
        self.assertEqual(res.status_code, 201, res.data)

    # ── ويندوز وماك: ملف أو رابط خارجي ────────────────────────────────────

    def test_windows_requires_file_or_link(self):
        res = self._post(platform="windows")
        self.assertEqual(res.status_code, 400)
        self.assertIn("file", res.data)

    def test_windows_accepts_exe(self):
        res = self._post(platform="windows", file=_upload("setup.exe"))
        self.assertEqual(res.status_code, 201, res.data)

    def test_windows_rejects_wrong_extension(self):
        res = self._post(platform="windows", file=_upload("setup.dmg"))
        self.assertEqual(res.status_code, 400)
        self.assertIn("file", res.data)

    def test_macos_accepts_dmg(self):
        res = self._post(platform="macos", file=_upload("app.dmg"))
        self.assertEqual(res.status_code, 201, res.data)

    def test_macos_rejects_exe(self):
        res = self._post(platform="macos", file=_upload("app.exe"))
        self.assertEqual(res.status_code, 400)

    # ── الحجم ─────────────────────────────────────────────────────────────

    def test_oversized_package_is_rejected(self):
        big = SimpleUploadedFile("huge.exe", b"", content_type="application/octet-stream")
        big.size = (MAX_PACKAGE_MB + 1) * 1024 * 1024

        res = self._post(platform="windows", file=big)
        self.assertEqual(res.status_code, 400)
        self.assertIn("file", res.data)

    # ── إصدار واحد لكل منصة ───────────────────────────────────────────────

    def test_one_row_per_platform(self):
        self._post(platform="windows", file=_upload("a.exe"))
        res = self._post(platform="windows", file=_upload("b.exe"))
        self.assertEqual(res.status_code, 400)

    def test_updating_a_platform_replaces_it(self):
        res = self._post(platform="windows", file=_upload("v1.exe"))
        platform_id = res.data["id"]

        res = self.client_admin.patch(
            f"/api/admin/store/platforms/{platform_id}/",
            {"external_url": "https://example.com/v2.exe"}, format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(AppPlatform.objects.filter(app=self.app).count(), 1)


class PublishTests(TestCase):

    def setUp(self):
        self.admin = _user("pub_admin", CustomUser.Roles.ADMIN)
        self.client_admin = APIClient()
        self.client_admin.force_authenticate(user=self.admin)
        self.app = App.objects.create(name="تطبيق")

    def _publish(self, value):
        return self.client_admin.post(
            f"/api/admin/store/apps/{self.app.id}/publish/",
            {"is_published": value}, format="json",
        )

    def test_cannot_publish_app_without_a_usable_platform(self):
        """تطبيق منشور بلا زر تنزيل صفحة ميتة يراها الزائر."""
        res = self._publish(True)
        self.assertEqual(res.status_code, 400)
        self.assertIn("is_published", res.data)

    def test_can_publish_once_a_platform_is_usable(self):
        AppPlatform.objects.create(
            app=self.app, platform="ios",
            store_url="https://apps.apple.com/app/id1",
        )
        res = self._publish(True)
        self.assertEqual(res.status_code, 200, res.data)

        self.app.refresh_from_db()
        self.assertTrue(self.app.is_published)

    def test_unpublishing_never_blocked(self):
        AppPlatform.objects.create(
            app=self.app, platform="ios",
            store_url="https://apps.apple.com/app/id1",
        )
        self._publish(True)

        res = self._publish(False)
        self.assertEqual(res.status_code, 200)
        self.app.refresh_from_db()
        self.assertFalse(self.app.is_published)


class AppValidationTests(TestCase):

    def setUp(self):
        self.admin = _user("av_admin", CustomUser.Roles.ADMIN)
        self.client_admin = APIClient()
        self.client_admin.force_authenticate(user=self.admin)

    def test_name_is_required(self):
        res = self.client_admin.post("/api/admin/store/apps/", {"name": ""})
        self.assertEqual(res.status_code, 400)
        self.assertIn("name", res.data)

    def test_whitespace_name_is_rejected(self):
        res = self.client_admin.post("/api/admin/store/apps/", {"name": "   "})
        self.assertEqual(res.status_code, 400)

    def test_description_and_icon_are_optional(self):
        res = self.client_admin.post("/api/admin/store/apps/", {"name": "بلا وصف"})
        self.assertEqual(res.status_code, 201, res.data)

    def test_invalid_url_is_rejected(self):
        app = App.objects.create(name="تطبيق")
        res = self.client_admin.post(
            f"/api/admin/store/apps/{app.id}/platforms/",
            {"platform": "ios", "store_url": "ليس رابطاً"},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("store_url", res.data)

    def test_platform_options_expose_specs_to_the_frontend(self):
        res = self.client_admin.get("/api/admin/store/platform-options/")
        self.assertEqual(res.status_code, 200)

        values = {p["value"] for p in res.data["platforms"]}
        self.assertEqual(values, {"android", "ios", "windows", "macos"})

        windows = next(p for p in res.data["platforms"] if p["value"] == "windows")
        self.assertIn(".exe", windows["extensions"])
        self.assertEqual(res.data["limits"]["package_mb"], MAX_PACKAGE_MB)


@_isolated_media
class NoRegressionTests(TestCase):
    """المتجر إضافي بالكامل — لا يمسّ نقطة نهاية قائمة."""

    def test_existing_public_endpoints_still_answer(self):
        client = APIClient()
        for url in ("/api/public/site-data/", "/api/public/announcements/"):
            with self.subTest(url=url):
                res = client.get(url)
                self.assertEqual(res.status_code, 200)

    def test_students_remain_blocked_from_admin_store(self):
        student = _user("reg_student", CustomUser.Roles.STUDENT)
        c = APIClient()
        c.force_authenticate(user=student)
        self.assertEqual(c.get("/api/admin/store/apps/").status_code, 403)

    def test_screenshots_cascade_with_the_app(self):
        app = App.objects.create(name="تطبيق")
        AppScreenshot.objects.create(
            app=app,
            image=SimpleUploadedFile("s.png", b"x", content_type="image/png"),
        )
        app.delete()
        self.assertEqual(AppScreenshot.objects.count(), 0)
