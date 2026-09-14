"""
================================================================================
live/models.py
================================================================================
نماذج نظام البث المباشر

التسلسل الهرمي:
  LiveRoom (الغرفة التنظيمية) → LiveSession (جلسة البث الفعلية)

منطق الفلترة (للطالب):
  - room_type (online / flash) يُطابق StudentProfile.system_type
  - grade يُطابق StudentProfile.enrolled_grade؛ غرفة بلا فصل تُرى من كل
    فصول نظامها (بثّ عام لنظام كامل)
  - course_type بيانات تنظيمية للمسؤول فقط، لا تُستخدم لتصفية الطلاب

لا مواعيد للجلسات: الحالة (upcoming / live / ended) هي ما يُدار ويُعرَض.
================================================================================
"""

from django.db import models
from django.utils.translation import gettext_lazy as _


def next_display_order(qs) -> int:
    """الأعلى الحالي + 1 فيظهر الجديد أولاً؛ والأول على الإطلاق يأخذ 1."""
    top = qs.order_by("-display_order").values_list("display_order", flat=True).first()
    return (top or 0) + 1


# ─────────────────────────────────────────────────────────────────────────────
# 1. LiveRoom — الغرفة التنظيمية للبث
# ─────────────────────────────────────────────────────────────────────────────

class LiveRoom(models.Model):
    """
    الغرفة التنظيمية: تجمع جلسات البث المتعلقة بنظام دراسي معين.

    room_type  → يُحدد نوع الطلاب الذين يرون هذه الغرفة:
                 online = طلاب الأونلاين
                 flash  = طلاب الفلاش

    grade      → الفصل الدراسي الذي تخصّه الغرفة. فارغ = كل فصول نظامها.
                 كانت الغرف بلا فصل، فيرى طالب الصف الأول بثّ كل الصفوف
                 الأونلاين. الحقل اختياري كي لا تختفي الغرف القائمة فجأة
                 عن الطلاب حتى تُعيَّن فصولها.

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
    grade       = models.ForeignKey(
        "academic.Grade",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="live_rooms",
        verbose_name=_("الفصل الدراسي"),
        help_text=_("الطلاب المسجّلون في هذا الفصل وحدهم يرون الغرفة. فارغ = كل فصول النظام."),
    )
    course_type = models.CharField(
        _("نوع الكورس"),
        max_length=20,
        choices=CourseType.choices,
        default=CourseType.GENERAL,
        help_text=_("معلومة تنظيمية للمسؤول — لا تؤثر في فلترة الطلاب."),
    )
    description = models.TextField(_("الوصف"), blank=True)
    # الترتيب اليدوي: الأعلى رقماً أولاً، ولا تتشارك غرفتان رقماً واحداً
    # (قيد فريد أدناه). بلا رقم ⇒ save() يعطي الأعلى+1 فتظهر الجديدة أولاً؛
    # في الموديل لا في السيريالايزر كي يسلك Django admin والـ ORM المباشر
    # المسلك نفسه ولا يصطدما بالقيد. كانت الغرف تُعرض بالأحدث أولاً بلا تحكّم.
    display_order = models.PositiveSmallIntegerField(
        _("ترتيب العرض"), null=True, blank=True, default=None,
        help_text=_("الأعلى يظهر أولاً. اتركه فارغاً ليأخذ الأعلى تلقائياً."),
    )
    is_active   = models.BooleanField(_("نشطة"), default=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _("غرفة بث")
        verbose_name_plural = _("غرف البث")
        ordering            = ["-display_order", "room_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["display_order"], name="liveroom_display_order_unique",
            ),
        ]
        indexes = [
            # Indexes للحقول المستخدمة في الفلترة — يحسّن أداء استعلامات الطلاب
            models.Index(fields=["room_type"],  name="liveroom_room_type_idx"),
            models.Index(fields=["is_active"],  name="liveroom_is_active_idx"),
            models.Index(fields=["room_type", "is_active"], name="liveroom_type_active_idx"),
            models.Index(fields=["grade"],      name="liveroom_grade_idx"),
        ]

    def save(self, *args, **kwargs):
        if self.display_order is None:
            self.display_order = next_display_order(LiveRoom.objects.all())
        super().save(*args, **kwargs)

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
    status          = models.CharField(
        _("الحالة"),
        max_length=20,
        choices=Status.choices,
        default=Status.UPCOMING,
    )
    # الترتيب اليدوي داخل الغرفة: الأعلى رقماً أولاً، وفريد داخل الغرفة.
    # بلا رقم ⇒ save() يعطي الأعلى+1 داخل الغرفة.
    display_order   = models.PositiveSmallIntegerField(
        _("ترتيب العرض"), null=True, blank=True, default=None,
        help_text=_("الأعلى يظهر أولاً. اتركه فارغاً ليأخذ الأعلى تلقائياً."),
    )
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _("جلسة بث")
        verbose_name_plural = _("جلسات البث")
        ordering            = ["room", "-display_order", "session_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["room", "display_order"], name="livesession_room_order_unique",
            ),
        ]
        indexes = [
            # Indexes للحقول المستخدمة في الفلترة والترتيب
            models.Index(fields=["status"],           name="livesession_status_idx"),
            models.Index(fields=["room"],             name="livesession_room_idx"),
            models.Index(fields=["room", "status"],   name="livesession_room_status_idx"),
        ]

    def save(self, *args, **kwargs):
        if self.display_order is None:
            self.display_order = next_display_order(
                LiveSession.objects.filter(room_id=self.room_id)
            )
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.session_name} ({self.room.room_name})"
