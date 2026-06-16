"""
================================================================================
backups/models.py
================================================================================
نماذج النسخ الاحتياطي — BackupFile, BackupSettings (Singleton), RestoreLog
================================================================================
"""

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


# ─────────────────────────────────────────────────────────────────────────────
# 1. BackupFile — سجل النسخة الاحتياطية
# ─────────────────────────────────────────────────────────────────────────────

class BackupFile(models.Model):
    """كل صف يمثّل ملف نسخة احتياطية محفوظ على القرص."""

    class BackupType(models.TextChoices):
        FULL       = "full",       _("كامل (قاعدة بيانات + ملفات)")
        DB_ONLY    = "db_only",    _("قاعدة البيانات فقط")
        MEDIA_ONLY = "media_only", _("الملفات المرفوعة فقط")

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    filename   = models.CharField(_("اسم الملف"), max_length=255)
    size_bytes = models.BigIntegerField(_("الحجم (بايت)"), default=0)
    backup_type = models.CharField(
        _("نوع النسخة"),
        max_length=20,
        choices=BackupType.choices,
        default=BackupType.FULL,
    )
    notes      = models.TextField(_("ملاحظات"), blank=True)
    created_at = models.DateTimeField(_("تاريخ الإنشاء"), default=timezone.now)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="backups_created",
        verbose_name=_("أنشأها"),
    )

    class Meta:
        verbose_name        = _("نسخة احتياطية")
        verbose_name_plural = _("النسخ الاحتياطية")
        ordering            = ["-created_at"]

    def __str__(self):
        return f"{self.filename} ({self.get_backup_type_display()})"


# ─────────────────────────────────────────────────────────────────────────────
# 2. BackupSettings — إعدادات النسخ التلقائي (Singleton)
# ─────────────────────────────────────────────────────────────────────────────

class BackupSettings(models.Model):
    """إعدادات النسخ التلقائي — صف واحد فقط في الجدول."""

    class Frequency(models.TextChoices):
        DAILY   = "daily",   _("يومي")
        WEEKLY  = "weekly",  _("أسبوعي")
        MONTHLY = "monthly", _("شهري")

    auto_backup_enabled = models.BooleanField(_("النسخ التلقائي مفعّل"), default=False)
    frequency = models.CharField(
        _("التكرار"),
        max_length=10,
        choices=Frequency.choices,
        default=Frequency.WEEKLY,
    )
    keep_last_n = models.PositiveIntegerField(_("الاحتفاظ بآخر"), default=5)
    last_auto_backup_at = models.DateTimeField(_("آخر نسخ تلقائي"), null=True, blank=True)

    class Meta:
        verbose_name        = _("إعدادات النسخ الاحتياطي")
        verbose_name_plural = _("إعدادات النسخ الاحتياطي")

    def __str__(self):
        return "إعدادات النسخ الاحتياطي"

    @classmethod
    def get_settings(cls):
        """يعيد الصف الوحيد أو ينشئه إن لم يوجد."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


# ─────────────────────────────────────────────────────────────────────────────
# 3. RestoreLog — سجل عمليات الاستعادة
# ─────────────────────────────────────────────────────────────────────────────

class RestoreLog(models.Model):
    """سجل لكل عملية استعادة — للمراجعة والتدقيق."""

    class Status(models.TextChoices):
        SUCCESS = "success", _("ناجحة")
        FAILED  = "failed",  _("فاشلة")

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    backup_file = models.ForeignKey(
        BackupFile,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="restore_logs",
        verbose_name=_("النسخة الاحتياطية"),
    )
    backup_filename = models.CharField(_("اسم ملف النسخة"), max_length=255, blank=True)
    restored_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="restores_performed",
        verbose_name=_("استعادها"),
    )
    restored_at = models.DateTimeField(_("تاريخ الاستعادة"), default=timezone.now)
    status      = models.CharField(
        _("الحالة"),
        max_length=10,
        choices=Status.choices,
        default=Status.SUCCESS,
    )
    log_text    = models.TextField(_("سجل التفاصيل"), blank=True)

    class Meta:
        verbose_name        = _("سجل استعادة")
        verbose_name_plural = _("سجلات الاستعادة")
        ordering            = ["-restored_at"]

    def __str__(self):
        return f"استعادة {self.backup_filename} — {self.get_status_display()}"
