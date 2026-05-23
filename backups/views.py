"""
================================================================================
backups/views.py
================================================================================
7 نقاط API لإدارة النسخ الاحتياطي والاستعادة.
يدعم SQLite (تطوير) و PostgreSQL (إنتاج) تلقائياً.
================================================================================
"""

import os
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime

from django.conf import settings
from django.http import FileResponse
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminOrManager
from .models import BackupFile, BackupSettings, RestoreLog
from .serializers import (
    BackupFileSerializer,
    BackupSettingsSerializer,
    CreateBackupSerializer,
    RestoreLogSerializer,
)

# ── المسارات المساعدة ─────────────────────────────────────────────────────────

BACKUP_DIR = getattr(settings, "BACKUP_STORAGE_DIR", settings.BASE_DIR / "backups_storage")
MEDIA_ROOT = settings.MEDIA_ROOT
DB_SETTINGS = settings.DATABASES["default"]
DB_ENGINE = DB_SETTINGS.get("ENGINE", "")


def _ensure_backup_dir():
    """ينشئ مجلد التخزين إن لم يكن موجوداً."""
    os.makedirs(BACKUP_DIR, exist_ok=True)


def _is_sqlite():
    return "sqlite3" in DB_ENGINE


def _is_postgres():
    return "postgresql" in DB_ENGINE


def _timestamp():
    return datetime.now().strftime("%Y%m%d_%H%M%S")


# ─────────────────────────────────────────────────────────────────────────────
# 1. إنشاء نسخة احتياطية
# ─────────────────────────────────────────────────────────────────────────────

class CreateBackupView(APIView):
    """POST /api/backups/create/"""

    permission_classes = [IsAdminOrManager]

    def post(self, request):
        serializer = CreateBackupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        backup_type = serializer.validated_data["backup_type"]
        notes = serializer.validated_data.get("notes", "")

        _ensure_backup_dir()
        ts = _timestamp()
        zip_name = f"backup_{backup_type}_{ts}.zip"
        zip_path = os.path.join(str(BACKUP_DIR), zip_name)

        try:
            with tempfile.TemporaryDirectory() as tmp:
                # ── نسخ قاعدة البيانات ────────────────────────────────────
                if backup_type in ("full", "db_only"):
                    self._backup_database(tmp)

                # ── نسخ الملفات المرفوعة ──────────────────────────────────
                if backup_type in ("full", "media_only"):
                    media_src = str(MEDIA_ROOT)
                    if os.path.isdir(media_src):
                        shutil.copytree(media_src, os.path.join(tmp, "media"))

                # ── إنشاء الأرشيف المضغوط ────────────────────────────────
                with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                    for root, _dirs, files in os.walk(tmp):
                        for f in files:
                            abs_path = os.path.join(root, f)
                            arc_name = os.path.relpath(abs_path, tmp)
                            zf.write(abs_path, arc_name)

            # ── حفظ السجل ─────────────────────────────────────────────
            size = os.path.getsize(zip_path)
            record = BackupFile.objects.create(
                filename=zip_name,
                size_bytes=size,
                backup_type=backup_type,
                notes=notes,
                created_by=request.user,
            )

            # ── تنظيف النسخ القديمة ────────────────────────────────────
            self._enforce_retention()

            return Response(
                BackupFileSerializer(record).data,
                status=status.HTTP_201_CREATED,
            )

        except Exception as exc:
            # حذف الأرشيف المعطوب إن وُجد
            if os.path.exists(zip_path):
                os.remove(zip_path)
            return Response(
                {"detail": f"فشل إنشاء النسخة الاحتياطية: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    # ── مساعدات ───────────────────────────────────────────────────────────

    @staticmethod
    def _backup_database(dest_dir):
        """نسخ قاعدة البيانات حسب المحرّك."""
        if _is_sqlite():
            db_path = DB_SETTINGS["NAME"]
            shutil.copy2(db_path, os.path.join(dest_dir, "db.sqlite3"))

        elif _is_postgres():
            dump_path = os.path.join(dest_dir, "db_dump.sql")
            env = os.environ.copy()
            if DB_SETTINGS.get("PASSWORD"):
                env["PGPASSWORD"] = DB_SETTINGS["PASSWORD"]

            cmd = [
                "pg_dump",
                "--clean", "--if-exists",
                "--no-owner", "--no-acl",
                "-h", DB_SETTINGS.get("HOST", "localhost"),
                "-p", str(DB_SETTINGS.get("PORT", "5432")),
                "-U", DB_SETTINGS.get("USER", "postgres"),
                "-d", DB_SETTINGS["NAME"],
                "-f", dump_path,
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, env=env)
            if result.returncode != 0:
                raise RuntimeError(f"pg_dump failed: {result.stderr}")

        else:
            raise RuntimeError(f"محرّك قاعدة البيانات غير مدعوم: {DB_ENGINE}")

    @staticmethod
    def _enforce_retention():
        """حذف النسخ الزائدة عن الحد المسموح."""
        cfg = BackupSettings.get_settings()
        if not cfg.auto_backup_enabled or cfg.keep_last_n <= 0:
            return
        backups = BackupFile.objects.order_by("-created_at")
        to_delete = backups[cfg.keep_last_n:]
        for b in to_delete:
            path = os.path.join(str(BACKUP_DIR), b.filename)
            if os.path.exists(path):
                os.remove(path)
            b.delete()


# ─────────────────────────────────────────────────────────────────────────────
# 2. قائمة النسخ الاحتياطية
# ─────────────────────────────────────────────────────────────────────────────

class BackupListView(generics.ListAPIView):
    """GET /api/backups/"""

    queryset = BackupFile.objects.all()
    serializer_class = BackupFileSerializer
    permission_classes = [IsAdminOrManager]
    pagination_class = None  # عرض الكل بدون Pagination


# ─────────────────────────────────────────────────────────────────────────────
# 3. تحميل النسخة الاحتياطية
# ─────────────────────────────────────────────────────────────────────────────

class DownloadBackupView(APIView):
    """GET /api/backups/<id>/download/"""

    permission_classes = [IsAdminOrManager]

    def get(self, request, pk):
        try:
            record = BackupFile.objects.get(pk=pk)
        except BackupFile.DoesNotExist:
            return Response(
                {"detail": _("النسخة غير موجودة.")},
                status=status.HTTP_404_NOT_FOUND,
            )

        file_path = os.path.join(str(BACKUP_DIR), record.filename)
        if not os.path.exists(file_path):
            return Response(
                {"detail": _("ملف النسخة غير موجود على القرص.")},
                status=status.HTTP_404_NOT_FOUND,
            )

        return FileResponse(
            open(file_path, "rb"),
            as_attachment=True,
            filename=record.filename,
            content_type="application/zip",
        )


# ─────────────────────────────────────────────────────────────────────────────
# 4. استعادة نسخة احتياطية
# ─────────────────────────────────────────────────────────────────────────────

class RestoreBackupView(APIView):
    """POST /api/backups/<id>/restore/  — يتطلب confirm: true"""

    permission_classes = [IsAdminOrManager]

    def post(self, request, pk):
        if not request.data.get("confirm"):
            return Response(
                {"detail": _("يجب تأكيد عملية الاستعادة بإرسال confirm: true.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            record = BackupFile.objects.get(pk=pk)
        except BackupFile.DoesNotExist:
            return Response(
                {"detail": _("النسخة غير موجودة.")},
                status=status.HTTP_404_NOT_FOUND,
            )

        zip_path = os.path.join(str(BACKUP_DIR), record.filename)
        if not os.path.exists(zip_path):
            return Response(
                {"detail": _("ملف النسخة غير موجود على القرص.")},
                status=status.HTTP_404_NOT_FOUND,
            )

        log_lines = []
        restore_status = RestoreLog.Status.SUCCESS

        try:
            with tempfile.TemporaryDirectory() as tmp:
                # فك الضغط
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(tmp)
                log_lines.append("تم فك ضغط الأرشيف بنجاح.")

                # ── استعادة قاعدة البيانات ─────────────────────────────
                if record.backup_type in ("full", "db_only"):
                    self._restore_database(tmp, log_lines)

                # ── استعادة الملفات المرفوعة ───────────────────────────
                if record.backup_type in ("full", "media_only"):
                    media_backup = os.path.join(tmp, "media")
                    if os.path.isdir(media_backup):
                        media_dst = str(MEDIA_ROOT)
                        if os.path.isdir(media_dst):
                            shutil.rmtree(media_dst)
                        shutil.copytree(media_backup, media_dst)
                        log_lines.append("تم استعادة مجلد الوسائط بنجاح.")
                    else:
                        log_lines.append("لم يتم العثور على مجلد الوسائط في الأرشيف.")

            log_lines.append("اكتملت عملية الاستعادة بنجاح.")

        except Exception as exc:
            restore_status = RestoreLog.Status.FAILED
            log_lines.append(f"خطأ أثناء الاستعادة: {exc}")

        # ── تسجيل العملية ──────────────────────────────────────────
        log_entry = RestoreLog.objects.create(
            backup_file=record,
            backup_filename=record.filename,
            restored_by=request.user,
            status=restore_status,
            log_text="\n".join(log_lines),
        )

        resp_status = (
            status.HTTP_200_OK
            if restore_status == RestoreLog.Status.SUCCESS
            else status.HTTP_500_INTERNAL_SERVER_ERROR
        )
        return Response(RestoreLogSerializer(log_entry).data, status=resp_status)

    # ── مساعدات ───────────────────────────────────────────────────────────

    @staticmethod
    def _restore_database(extract_dir, log_lines):
        """استعادة قاعدة البيانات حسب المحرّك."""
        if _is_sqlite():
            src = os.path.join(extract_dir, "db.sqlite3")
            if os.path.exists(src):
                dst = DB_SETTINGS["NAME"]
                shutil.copy2(src, dst)
                log_lines.append("تم استعادة قاعدة بيانات SQLite بنجاح.")
            else:
                log_lines.append("لم يتم العثور على ملف db.sqlite3 في الأرشيف.")

        elif _is_postgres():
            dump_path = os.path.join(extract_dir, "db_dump.sql")
            if os.path.exists(dump_path):
                env = os.environ.copy()
                if DB_SETTINGS.get("PASSWORD"):
                    env["PGPASSWORD"] = DB_SETTINGS["PASSWORD"]

                cmd = [
                    "psql",
                    "-h", DB_SETTINGS.get("HOST", "localhost"),
                    "-p", str(DB_SETTINGS.get("PORT", "5432")),
                    "-U", DB_SETTINGS.get("USER", "postgres"),
                    "-d", DB_SETTINGS["NAME"],
                    "-f", dump_path,
                ]
                result = subprocess.run(cmd, capture_output=True, text=True, env=env)
                if result.returncode != 0:
                    raise RuntimeError(f"psql restore failed: {result.stderr}")
                log_lines.append("تم استعادة قاعدة بيانات PostgreSQL بنجاح.")
            else:
                log_lines.append("لم يتم العثور على ملف db_dump.sql في الأرشيف.")

        else:
            raise RuntimeError(f"محرّك قاعدة البيانات غير مدعوم: {DB_ENGINE}")


# ─────────────────────────────────────────────────────────────────────────────
# 5. حذف نسخة احتياطية
# ─────────────────────────────────────────────────────────────────────────────

class DeleteBackupView(APIView):
    """DELETE /api/backups/<id>/"""

    permission_classes = [IsAdminOrManager]

    def delete(self, request, pk):
        try:
            record = BackupFile.objects.get(pk=pk)
        except BackupFile.DoesNotExist:
            return Response(
                {"detail": _("النسخة غير موجودة.")},
                status=status.HTTP_404_NOT_FOUND,
            )

        # حذف الملف من القرص
        file_path = os.path.join(str(BACKUP_DIR), record.filename)
        if os.path.exists(file_path):
            os.remove(file_path)

        record.delete()
        return Response(
            {"detail": _("تم حذف النسخة الاحتياطية بنجاح.")},
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
# 6. إعدادات النسخ التلقائي
# ─────────────────────────────────────────────────────────────────────────────

class BackupSettingsView(APIView):
    """GET / PATCH /api/backups/settings/"""

    permission_classes = [IsAdminOrManager]

    def get(self, request):
        obj = BackupSettings.get_settings()
        return Response(BackupSettingsSerializer(obj).data)

    def patch(self, request):
        obj = BackupSettings.get_settings()
        serializer = BackupSettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ─────────────────────────────────────────────────────────────────────────────
# 7. سجلات الاستعادة
# ─────────────────────────────────────────────────────────────────────────────

class RestoreLogListView(generics.ListAPIView):
    """GET /api/backups/restore-logs/"""

    queryset = RestoreLog.objects.all()
    serializer_class = RestoreLogSerializer
    permission_classes = [IsAdminOrManager]
    pagination_class = None
