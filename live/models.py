"""
================================================================================
live/models.py
================================================================================
نماذج نظام البث المباشر

التسلسل الهرمي:
  LiveRoom (الغرفة التنظيمية) → LiveSession (جلسة البث الفعلية)

منطق الفلترة:
  - كل غرفة لها room_type (online / flash) يُطابق StudentProfile.system_type
  - course_type بيانات تنظيمية للمسؤول فقط، لا تُستخدم لتصفية الطلاب
================================================================================
"""

from django.db import models
from django.utils.translation import gettext_lazy as _


# ─────────────────────────────────────────────────────────────────────────────
# 1. LiveRoom — الغرفة التنظيمية للبث
# ─────────────────────────────────────────────────────────────────────────────

class LiveRoom(models.Model):
    """
    الغرفة التنظيمية: تجمع جلسات البث المتعلقة بنظام دراسي معين.

    room_type  → يُحدد نوع الطلاب الذين يرون هذه الغرفة:
                 online = طلاب الأونلاين
                 flash  = طلاب الفلاش

    course_type → معلومة تنظيمية/وصفية للمسؤول فقط.
    """

    class RoomType(models.TextChoices):
        ONLINE = "online", _("أونلاين")
        FLASH  = "flash",  _("فلاش")

    class CourseType(models.TextChoices):
        SCIENTIFIC = "scientific", _("علمي")
        LITERARY   = "literary",   _("أدبي")
        GENERAL    = "general",    _("عام")

    room_name   = models.CharField(_("اسم الغرفة"), max_length=150)
    room_type   = models.CharField(
        _("نوع النظام"),
        max_length=10,
        choices=RoomType.choices,
        default=RoomType.ONLINE,
        help_text=_("يُحدد أي الطلاب يرون هذه الغرفة: أونلاين أم فلاش."),
    )
    course_type = models.CharField(
        _("نوع الكورس"),
        max_length=20,
        choices=CourseType.choices,
        default=CourseType.GENERAL,
        help_text=_("معلومة تنظيمية للمسؤول — لا تؤثر في فلترة الطلاب."),
    )
    description = models.TextField(_("الوصف"), blank=True)
    is_active   = models.BooleanField(_("نشطة"), default=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _("غرفة بث")
        verbose_name_plural = _("غرف البث")
        ordering            = ["-created_at"]
        indexes = [
            # Indexes للحقول المستخدمة في الفلترة — يحسّن أداء استعلامات الطلاب
            models.Index(fields=["room_type"],  name="liveroom_room_type_idx"),
            models.Index(fields=["is_active"],  name="liveroom_is_active_idx"),
            models.Index(fields=["room_type", "is_active"], name="liveroom_type_active_idx"),
        ]

    def __str__(self):
        return f"{self.room_name} ({self.get_room_type_display()})"


# ─────────────────────────────────────────────────────────────────────────────
# 2. LiveSession — جلسة البث الفعلية
# ─────────────────────────────────────────────────────────────────────────────

class LiveSession(models.Model):
    """
    جلسة بث واحدة داخل الغرفة.
    كل غرفة يمكن أن تحتوي على عدد غير محدود من الجلسات.

    قابلية التوسع المستقبلية (بدون تغيير البنية الحالية):
      - recording_url  : رابط التسجيل
      - password       : كلمة مرور الجلسة
      - attendance     : تتبع الحضور
      - instructor     : ربط بمحاضر
    """

    class Provider(models.TextChoices):
        ZOOM        = "zoom",        _("Zoom")
        GOOGLE_MEET = "google_meet", _("Google Meet")
        TEAMS       = "teams",       _("Microsoft Teams")
        YOUTUBE     = "youtube",     _("YouTube Live")
        OTHER       = "other",       _("أخرى")

    class Status(models.TextChoices):
        UPCOMING = "upcoming", _("قادمة")
        LIVE     = "live",     _("مباشرة الآن")
        ENDED    = "ended",    _("انتهت")
        ARCHIVED = "archived", _("مؤرشفة")

    room            = models.ForeignKey(
        LiveRoom,
        on_delete=models.CASCADE,
        related_name="sessions",
        verbose_name=_("الغرفة"),
    )
    session_name    = models.CharField(_("اسم الجلسة"), max_length=200)
    description     = models.TextField(_("الوصف"), blank=True)
    provider        = models.CharField(
        _("مزود البث"),
        max_length=20,
        choices=Provider.choices,
        default=Provider.ZOOM,
    )
    stream_url      = models.URLField(
        _("رابط البث"),
        help_text=_("رابط Zoom / Google Meet / YouTube أو أي منصة بث."),
    )
    scheduled_start = models.DateTimeField(_("موعد البداية"))
    scheduled_end   = models.DateTimeField(_("موعد النهاية"))
    status          = models.CharField(
        _("الحالة"),
        max_length=20,
        choices=Status.choices,
        default=Status.UPCOMING,
    )
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _("جلسة بث")
        verbose_name_plural = _("جلسات البث")
        ordering            = ["scheduled_start"]
        indexes = [
            # Indexes للحقول المستخدمة في الفلترة والترتيب
            models.Index(fields=["status"],           name="livesession_status_idx"),
            models.Index(fields=["room"],             name="livesession_room_idx"),
            models.Index(fields=["scheduled_start"],  name="livesession_start_idx"),
            models.Index(fields=["room", "status"],   name="livesession_room_status_idx"),
        ]

    def __str__(self):
        return f"{self.session_name} ({self.room.room_name})"
