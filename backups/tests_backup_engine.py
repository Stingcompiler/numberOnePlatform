"""
================================================================================
backups/tests_backup_engine.py
================================================================================
النسخ الاحتياطي بعد التحوّل من pg_dump إلى dumpdata.

الخلفية: كان إنشاء النسخة ينادي pg_dump عبر subprocess. الأداة غير مثبَّتة
في بيئة Render (runtime: python بلا صلاحية apt)، فكان الطلب يفشل دائماً في
الإنتاج بينما ينجح محلياً لأن فرع SQLite ينسخ الملف بـ shutil.

تغطي الاختبارات:
  - الإنشاء ينجح ويُنتج أرشيفاً يحوي db_dump.json صالحاً
  - الأرشيف يستثني الجداول التي تُبنى من الهجرات
  - دورة كاملة: نسخة ← تعديل بيانات ← استعادة ← عودة البيانات
  - الأرشيفات القديمة تُرفض برسالة مفهومة لا بانهيار
  - الصلاحيات: الإدارة فقط
  - مجلد النسخ لا يُخدَم عبر مسار /media/ العام
================================================================================
"""

import json
import os
import tempfile
import zipfile
from unittest import mock

from django.test import TestCase
from django.urls import Resolver404, resolve
from rest_framework.test import APIClient

from accounts.models import CustomUser
from academic.models import Level
from backups import views as backup_views
from backups.models import BackupFile


class BackupEngineTests(TestCase):

    def setUp(self):
        self.admin = CustomUser.objects.create_user(
            username="bk_admin", password="pass12345",
            full_name="مدير النسخ", role=CustomUser.Roles.ADMIN,
        )
        self.teacher = CustomUser.objects.create_user(
            username="bk_teacher", password="pass12345",
            full_name="أستاذ", role=CustomUser.Roles.TEACHER,
        )
        self.client_admin = APIClient()
        self.client_admin.force_authenticate(user=self.admin)

        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        patcher = mock.patch.object(backup_views, "BACKUP_DIR", self._tmp.name)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _create_backup(self, backup_type="db_only"):
        return self.client_admin.post("/api/backups/create/", {
            "backup_type": backup_type,
            "notes": "اختبار",
        })

    # ── الإنشاء ──────────────────────────────────────────────────────────────

    def test_create_backup_succeeds_without_pg_dump(self):
        Level.objects.create(name="مرحلة الاختبار")

        res = self._create_backup()
        self.assertEqual(res.status_code, 201, res.data)

        record = BackupFile.objects.get(pk=res.data["id"])
        path = os.path.join(self._tmp.name, record.filename)
        self.assertTrue(os.path.exists(path), "لم يُكتب ملف الأرشيف")
        self.assertGreater(record.size_bytes, 0)

    def test_archive_contains_valid_json_dump(self):
        Level.objects.create(name="مرحلة داخل النسخة")

        res = self._create_backup()
        record = BackupFile.objects.get(pk=res.data["id"])
        path = os.path.join(self._tmp.name, record.filename)

        with zipfile.ZipFile(path) as zf:
            self.assertIn("db_dump.json", zf.namelist())
            data = json.loads(zf.read("db_dump.json").decode("utf-8"))

        self.assertIsInstance(data, list)
        models = {row["model"] for row in data}
        self.assertIn("academic.level", models)

    def test_archive_excludes_migration_built_tables(self):
        res = self._create_backup()
        record = BackupFile.objects.get(pk=res.data["id"])
        path = os.path.join(self._tmp.name, record.filename)

        with zipfile.ZipFile(path) as zf:
            data = json.loads(zf.read("db_dump.json").decode("utf-8"))

        models = {row["model"] for row in data}
        for excluded in (
            "contenttypes.contenttype",
            "auth.permission",
            "admin.logentry",
            "sessions.session",
        ):
            self.assertNotIn(excluded, models, f"{excluded} ما زال في النسخة")

    def test_backup_does_not_depend_on_database_engine(self):
        """
        الفرع القديم كان يتشعّب على المحرّك وينادي pg_dump عند PostgreSQL،
        وهي أداة غير موجودة على الخادم. الآن المسار واحد لا يعتمد على أي
        أداة خارجية — نثبت ذلك بادّعاء أن المحرّك بوستجرس أثناء الإنشاء.

        هذا الاختبار يفشل على الكود القديم بخطأ 500 (FileNotFoundError).
        """
        with mock.patch.object(
            backup_views, "DB_ENGINE", "django.db.backends.postgresql"
        ):
            res = self._create_backup()

        self.assertEqual(res.status_code, 201, res.data)

    # ── دورة كاملة ───────────────────────────────────────────────────────────

    def test_restore_brings_back_changed_data(self):
        level = Level.objects.create(name="الاسم الأصلي")

        res = self._create_backup()
        self.assertEqual(res.status_code, 201, res.data)
        backup_id = res.data["id"]

        level.name = "اسم مُعدَّل بعد النسخة"
        level.save(update_fields=["name"])

        restore = self.client_admin.post(
            f"/api/backups/{backup_id}/restore/", {"confirm": True}, format="json"
        )
        self.assertEqual(restore.status_code, 200, restore.data)

        level.refresh_from_db()
        self.assertEqual(level.name, "الاسم الأصلي")

    def test_restore_requires_confirm(self):
        res = self._create_backup()
        backup_id = res.data["id"]

        restore = self.client_admin.post(
            f"/api/backups/{backup_id}/restore/", {}, format="json"
        )
        self.assertEqual(restore.status_code, 400)

    def test_legacy_archive_reports_clear_error(self):
        """أرشيف ما قبل dumpdata يجب أن يُرفض برسالة مفهومة لا بانهيار."""
        record = BackupFile.objects.create(
            filename="backup_legacy.zip", size_bytes=10,
            backup_type="db_only", created_by=self.admin,
        )
        legacy = os.path.join(self._tmp.name, record.filename)
        with zipfile.ZipFile(legacy, "w") as zf:
            zf.writestr("db_dump.sql", "-- old postgres dump")

        res = self.client_admin.post(
            f"/api/backups/{record.pk}/restore/", {"confirm": True}, format="json"
        )
        self.assertEqual(res.status_code, 500)
        self.assertIn("psql", res.data.get("log_text", ""))

    # ── الصلاحيات ────────────────────────────────────────────────────────────

    def test_teacher_cannot_create_backup(self):
        client = APIClient()
        client.force_authenticate(user=self.teacher)
        res = client.post("/api/backups/create/", {"backup_type": "db_only"})
        self.assertEqual(res.status_code, 403)

    def test_anonymous_cannot_list_backups(self):
        res = APIClient().get("/api/backups/")
        self.assertIn(res.status_code, (401, 403))


class BackupStorageExposureTests(TestCase):
    """
    مجلد النسخ يقع داخل MEDIA_ROOT على القرص الدائم في Render، ومسار
    /media/ عام بلا مصادقة — فلولا الاستثناء لأمكن تنزيل قاعدة البيانات
    كاملةً من الإنترنت.
    """

    def test_backups_directory_is_not_routed_under_media(self):
        with self.assertRaises(Resolver404):
            resolve("/media/.backups/backup_full_20260828.zip")

    def test_normal_media_is_still_routed(self):
        match = resolve("/media/avatars/photo.png")
        self.assertEqual(match.kwargs.get("path"), "avatars/photo.png")

    def test_nested_backup_path_is_not_routed(self):
        with self.assertRaises(Resolver404):
            resolve("/media/.backups/nested/dump.json")
