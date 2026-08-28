"""
================================================================================
backups/views.py
================================================================================
7 نقاط API لإدارة النسخ الاحتياطي والاستعادة.
يدعم SQLite (تطوير) و PostgreSQL (إنتاج) تلقائياً.
================================================================================
"""

import logging
import os
import shutil
import tempfile
import uuid
import zipfile
from datetime import datetime

from django.conf import settings
from django.core.management import call_command
from django.db import transaction
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

logger = logging.getLogger(__name__)

# ── المسارات المساعدة ─────────────────────────────────────────────────────────

BACKUP_DIR = getattr(settings, "BACKUP_STORAGE_DIR", settings.BASE_DIR / "backups_storage")
MEDIA_ROOT = settings.MEDIA_ROOT
DB_SETTINGS = settings.DATABASES["default"]
DB_ENGINE = DB_SETTINGS.get("ENGINE", "")


def _ensure_backup_dir():
    """ينشئ مجلد التخزين إن لم يكن موجوداً."""
    os.makedirs(BACKUP_DIR, exist_ok=True)


# اسم ملف البيانات داخل الأرشيف. نسخ ما قبل التحوّل إلى dumpdata كانت
# تحمل "db.sqlite3" أو "db_dump.sql" — تُرفَض صراحةً عند الاستعادة.
DB_DUMP_NAME = "db_dump.json"

# جداول تُبنى من الهجرات أو تخصّ جلسات منتهية؛ نسخها يُفشل الاستعادة
# بتضارب المفاتيح الأساسية.
DUMP_EXCLUDES = [
    "contenttypes",
    "auth.permission",
    "admin.logentry",
    "sessions.session",
    "token_blacklist",
]


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
        # لاحقة عشوائية قصيرة: _timestamp() بدقة الثانية، فنسختان تُنشآن
        # في الثانية نفسها كانتا تتشاركان الاسم — تدهس الثانية ملف الأولى،
        # ثم يحذف التنظيف ملفاً ما زال سجلٌّ آخر يشير إليه.
        ts = _timestamp()
        zip_name = f"backup_{backup_type}_{ts}_{uuid.uuid4().hex[:8]}.zip"
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

            # التتبّع كاملاً في سجلات الخادم: رسالة الواجهة وحدها لا تكفي
            # لتشخيص عطل يقع على قرص الإنتاج.
            logger.exception(
                "فشل إنشاء نسخة احتياطية (type=%s, dir=%s)",
                backup_type, BACKUP_DIR,
            )

            # اسم الاستثناء مع نصّه: بعض الاستثناءات (OSError بلا رسالة،
            # MemoryError) نصّها فارغ فتصل الواجهة رسالة مبتورة بلا سبب.
            reason = f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__
            return Response(
                {"detail": f"فشل إنشاء النسخة الاحتياطية — {reason}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    # ── مساعدات ───────────────────────────────────────────────────────────

    @staticmethod
    def _backup_database(dest_dir):
        """
        نسخ البيانات عبر dumpdata — بايثون خالص يعمل على SQLite و PostgreSQL
        بلا أدوات خارجية.

        الفرع السابق كان ينادي pg_dump، وهو غير مثبَّت في بيئة Render
        (runtime: python بلا صلاحية apt)، فكان subprocess يرمي
        FileNotFoundError قبل الوصول إلى فحص returncode أصلاً.
        """
        dump_path = os.path.join(dest_dir, DB_DUMP_NAME)
        with open(dump_path, "w", encoding="utf-8") as fh:
            call_command(
                "dumpdata",
                exclude=DUMP_EXCLUDES,
                format="json",
                indent=2,
                stdout=fh,
            )

    @staticmethod
    def _enforce_retention():
        """
        حذف النسخ الزائدة عن keep_last_n.

        كان التنظيف معلّقاً على auto_backup_enabled، وافتراضه False، بينما
        لا يوجد في المشروع أي مُشغّل للنسخ التلقائي أصلاً. فالنتيجة أن الحد
        لم يكن يُطبَّق أبداً وتتراكم النسخ بلا سقف على قرص يتشاركه مع
        الوسائط. الحد يُطبَّق الآن بعد كل نسخة أياً كان مصدرها.

        keep_last_n = 0 تعني بلا حد.
        """
        cfg = BackupSettings.get_settings()
        if cfg.keep_last_n <= 0:
            return
        to_delete = list(
            BackupFile.objects.order_by("-created_at")[cfg.keep_last_n:]
        )
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
        """
        استعادة البيانات عبر loaddata داخل معاملة واحدة.

        حدّ معروف: هذه استعادة على مستوى البيانات لا على مستوى الملف.
        loaddata يكتب فوق الصفوف المطابقة بالمفتاح الأساسي، لكنه لا يحذف
        صفوفاً أُنشئت بعد أخذ النسخة. العودة إلى حالة النسخة بالضبط تتطلب
        تفريغ القاعدة أولاً، وهو غير آمن من داخل طلب HTTP يستخدم نفس
        القاعدة للمصادقة.
        """
        json_path = os.path.join(extract_dir, DB_DUMP_NAME)
        if os.path.exists(json_path):
            with transaction.atomic():
                call_command("loaddata", json_path, verbosity=0)
            log_lines.append("تمت استعادة بيانات قاعدة البيانات بنجاح.")
            return

        # ── أرشيفات أُنشئت قبل التحوّل إلى dumpdata ────────────────────────
        if os.path.exists(os.path.join(extract_dir, "db.sqlite3")):
            raise RuntimeError(
                "أرشيف قديم بصيغة ملف SQLite. استعِده يدوياً باستبدال ملف "
                "قاعدة البيانات على الخادم."
            )
        if os.path.exists(os.path.join(extract_dir, "db_dump.sql")):
            raise RuntimeError(
                "أرشيف قديم بصيغة SQL ويتطلب psql غير المتوفر على الخادم. "
                "استعِده من جهاز مثبَّت عليه أدوات PostgreSQL."
            )

        log_lines.append("لم يُعثر على ملف بيانات داخل الأرشيف.")


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
