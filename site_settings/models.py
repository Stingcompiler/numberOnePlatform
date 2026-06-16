"""
================================================================================
site_settings/models.py
================================================================================
جداول إدارة موقع "مدارس ومعاهد نمبر ون"

تشمل:
  - SiteSettings  : إعدادات الموقع (Singleton Pattern) — الاسم، الشعار، الرؤية...
  - Announcement  : الإعلانات (Slider) المعروضة في صفحة الهبوط.
  - ContactTool   : أدوات التواصل (روابط سريعة، أرقام الهاتف).
  - ContactMessage: رسائل نموذج المراسلة الواردة من الزوار (Inbox).
  - StaffCard     : بطاقات الكادر المعروضة في صفحة الهبوط.
================================================================================
"""

import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _


# ─────────────────────────────────────────────────────────────────────────────
# دوال مساعدة
# ─────────────────────────────────────────────────────────────────────────────

def site_logo_upload_path(instance, filename):
    ext = filename.split(".")[-1]
    return f"site/logo/{uuid.uuid4().hex}.{ext}"


def announcement_image_upload_path(instance, filename):
    ext = filename.split(".")[-1]
    return f"site/announcements/{uuid.uuid4().hex}.{ext}"


def staff_card_photo_upload_path(instance, filename):
    ext = filename.split(".")[-1]
    return f"site/staff/{uuid.uuid4().hex}.{ext}"


# ─────────────────────────────────────────────────────────────────────────────
# 1. SiteSettings – إعدادات الموقع (Singleton)
# ─────────────────────────────────────────────────────────────────────────────

class SiteSettings(models.Model):
    """
    إعدادات الموقع العامة — نمط Singleton (سجل واحد دائماً).

    تُستخدم في:
    - قسم Hero & CTA: الشعار، الاسم، العنوان المختصر.
    - قسم التعريف: الرؤية، الرسالة، الأهداف، التاريخ.
    - Meta Tags (SEO via react-helmet-async).

    كيفية ضمان Singleton: تتجاوز save() لرفض الإنشاء إذا وُجد سجل.
    """

    # ── هوية المؤسسة ──────────────────────────────────────────────────────────
    institution_name   = models.CharField(
        _("اسم المؤسسة"),
        max_length=200,
        default="مدارس ومعاهد نمبر ون",
    )
    short_title        = models.CharField(
        _("العنوان المختصر (Tagline)"),
        max_length=300,
        blank=True,
        help_text=_("يظهر أسفل الاسم في قسم الـ Hero."),
    )
    logo               = models.ImageField(
        _("الشعار"),
        upload_to=site_logo_upload_path,
        blank=True,
        null=True,
    )
    favicon            = models.ImageField(
        _("الأيقونة (Favicon)"),
        upload_to="site/favicon/",
        blank=True,
        null=True,
    )

    # ── قسم التعريف بالمؤسسة ──────────────────────────────────────────────────
    vision       = models.TextField(_("الرؤية"), blank=True)
    mission      = models.TextField(_("الرسالة"), blank=True)
    objectives   = models.TextField(
        _("الأهداف"),
        blank=True,
        help_text=_("يمكن استخدام فواصل السطر لتحديد الأهداف."),
    )
    history      = models.TextField(_("التاريخ / القصة"), blank=True)

    # ── SEO ───────────────────────────────────────────────────────────────────
    meta_description = models.CharField(
        _("وصف الـ Meta (SEO)"),
        max_length=300,
        blank=True,
    )
    meta_keywords    = models.CharField(
        _("كلمات الـ Meta (SEO)"),
        max_length=300,
        blank=True,
    )

    # ── معلومات الاتصال العامة ────────────────────────────────────────────────
    primary_email    = models.EmailField(_("البريد الإلكتروني الرئيسي"), blank=True)
    primary_phone    = models.CharField(_("الهاتف الرئيسي"), max_length=30, blank=True)
    address_text     = models.CharField(_("العنوان التفصيلي"), max_length=300, blank=True)

    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _("إعدادات الموقع")
        verbose_name_plural = _("إعدادات الموقع")

    def __str__(self):
        return f"إعدادات الموقع — {self.institution_name}"

    def save(self, *args, **kwargs):
        """
        تطبيق نمط Singleton: يُلغي الـ pk الجديد ليُجبر Django على
        التحديث بدلاً من الإنشاء.
        """
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """يمنع حذف إعدادات الموقع."""
        pass

    @classmethod
    def get_settings(cls):
        """الطريقة المعيارية للحصول على إعدادات الموقع."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


# ─────────────────────────────────────────────────────────────────────────────
# 2. Announcement – الإعلانات (Slider في صفحة الهبوط)
# ─────────────────────────────────────────────────────────────────────────────

class Announcement(models.Model):
    """
    الإعلانات المعروضة في شريط Slider في صفحة الهبوط.
    يمكن للمدير تفعيلها وإيقافها وترتيبها.
    """

    title         = models.CharField(_("عنوان الإعلان"), max_length=200)
    body          = models.TextField(_("نص الإعلان"), blank=True)
    image         = models.ImageField(
        _("صورة الإعلان"),
        upload_to=announcement_image_upload_path,
        blank=True,
        null=True,
    )
    link          = models.URLField(_("رابط اختياري"), blank=True)
    is_active     = models.BooleanField(_("نشط (ظاهر في الـ Slider)"), default=True)
    display_order = models.PositiveSmallIntegerField(_("ترتيب العرض"), default=0)
    start_date    = models.DateField(
        _("تاريخ بداية العرض"),
        null=True,
        blank=True,
    )
    end_date      = models.DateField(
        _("تاريخ نهاية العرض"),
        null=True,
        blank=True,
    )
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _("إعلان")
        verbose_name_plural = _("الإعلانات")
        ordering            = ["display_order", "-created_at"]

    def __str__(self):
        status = "✓" if self.is_active else "✗"
        return f"{status} {self.title}"


# ─────────────────────────────────────────────────────────────────────────────
# 3. ContactTool – أدوات التواصل (روابط سريعة)
# ─────────────────────────────────────────────────────────────────────────────

class ContactTool(models.Model):
    """
    روابط التواصل السريع المعروضة في صفحة الهبوط.
    (واتساب، تيليغرام، فيسبوك، إنستغرام، إكس، يوتيوب، هاتف...)
    """

    class ToolType(models.TextChoices):
        WHATSAPP  = "whatsapp",  _("واتساب")
        TELEGRAM  = "telegram",  _("تيليغرام")
        FACEBOOK  = "facebook",  _("فيسبوك")
        INSTAGRAM = "instagram", _("إنستغرام")
        TWITTER   = "twitter",   _("إكس (تويتر)")
        YOUTUBE   = "youtube",   _("يوتيوب")
        PHONE     = "phone",     _("هاتف")
        EMAIL     = "email",     _("بريد إلكتروني")
        WEBSITE   = "website",   _("موقع إلكتروني")
        OTHER     = "other",     _("أخرى")

    tool_type     = models.CharField(
        _("نوع الأداة"),
        max_length=20,
        choices=ToolType.choices,
    )
    label         = models.CharField(_("التسمية"), max_length=100, blank=True)
    value         = models.CharField(
        _("الرابط أو الرقم"),
        max_length=500,
        help_text=_("مثال: https://wa.me/xxxx أو +249xxxxxxxxx"),
    )
    is_active     = models.BooleanField(_("نشط"), default=True)
    display_order = models.PositiveSmallIntegerField(_("ترتيب العرض"), default=0)

    class Meta:
        verbose_name        = _("أداة تواصل")
        verbose_name_plural = _("أدوات التواصل")
        ordering            = ["display_order", "tool_type"]

    def __str__(self):
        return f"{self.get_tool_type_display()} — {self.value[:50]}"


# ─────────────────────────────────────────────────────────────────────────────
# 4. ContactMessage – رسائل نموذج المراسلة (Inbox)
# ─────────────────────────────────────────────────────────────────────────────

class ContactMessage(models.Model):
    """
    رسائل الزوار الواردة عبر نموذج المراسلة في صفحة الهبوط.

    لوحة التحكم تعرضها في "صندوق الوارد (Inbox)"
    مع إمكانية تغيير الحالة.
    """

    class Status(models.TextChoices):
        UNREAD      = "unread",    _("جديد / غير مقروء")
        SEEN        = "seen",      _("تمت المشاهدة")
        CONTACTED   = "contacted", _("تم التواصل")
        PENDING     = "pending",   _("معلق")

    sender_name  = models.CharField(_("اسم المُرسِل"), max_length=150)
    sender_phone = models.CharField(_("رقم الهاتف"), max_length=30, blank=True)
    sender_email = models.EmailField(_("البريد الإلكتروني"), blank=True)
    subject      = models.CharField(_("الموضوع"), max_length=200, blank=True)
    message      = models.TextField(_("الرسالة"))
    status       = models.CharField(
        _("الحالة"),
        max_length=15,
        choices=Status.choices,
        default=Status.UNREAD,
    )
    # يُسجَّل تلقائياً
    ip_address   = models.GenericIPAddressField(
        _("عنوان IP"),
        null=True,
        blank=True,
    )
    received_at  = models.DateTimeField(_("وقت الاستلام"), auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)
    handled_by   = models.ForeignKey(
        "accounts.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="handled_messages",
        verbose_name=_("تولّى المعالجة"),
    )

    class Meta:
        verbose_name        = _("رسالة واردة")
        verbose_name_plural = _("صندوق الوارد")
        ordering            = ["-received_at"]

    def __str__(self):
        return f"[{self.get_status_display()}] {self.sender_name} — {self.subject or self.message[:40]}"


# ─────────────────────────────────────────────────────────────────────────────
# 5. StaffCard – بطاقات الكادر (في صفحة الهبوط)
# ─────────────────────────────────────────────────────────────────────────────

class StaffCard(models.Model):
    """
    بطاقات عرض الكادر في صفحة الهبوط.

    يمكن ربطها بـ TeacherProfile (إن كان الشخص مسجلاً في النظام)
    أو إضافتها يدوياً لأشخاص خارج النظام.

    نوع الكادر:
    - academic       : هيئة التدريس.
    - administrative : هيئة الإدارة.
    """

    class CardType(models.TextChoices):
        ACADEMIC       = "academic",       _("هيئة تدريس")
        ADMINISTRATIVE = "administrative", _("هيئة إدارة")

    # ربط اختياري بالأستاذ المسجّل في النظام
    teacher_profile = models.OneToOneField(
        "accounts.TeacherProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff_card",
        verbose_name=_("ملف الأستاذ (اختياري)"),
    )

    # البيانات اليدوية (تُستخدَم إذا لم يكن مرتبطاً بأستاذ)
    name          = models.CharField(_("الاسم"), max_length=150)
    title         = models.CharField(
        _("المسمى الوظيفي"),
        max_length=200,
        blank=True,
    )
    photo         = models.ImageField(
        _("الصورة"),
        upload_to=staff_card_photo_upload_path,
        blank=True,
        null=True,
    )
    bio           = models.TextField(_("نبذة مختصرة"), blank=True)
    card_type     = models.CharField(
        _("نوع الكادر"),
        max_length=20,
        choices=CardType.choices,
        default=CardType.ACADEMIC,
    )
    is_active     = models.BooleanField(_("ظاهر في صفحة الهبوط"), default=True)
    display_order = models.PositiveSmallIntegerField(_("ترتيب العرض"), default=0)

    class Meta:
        verbose_name        = _("بطاقة كادر")
        verbose_name_plural = _("بطاقات الكادر")
        ordering            = ["card_type", "display_order", "name"]

    def __str__(self):
        return f"{self.name} — {self.get_card_type_display()}"

    def get_display_name(self):
        """يُعيد اسم الشخص من TeacherProfile إن وُجد، وإلا من حقل name."""
        if self.teacher_profile:
            return self.teacher_profile.user.full_name
        return self.name

    def get_display_photo(self):
        """يُعيد صورة الشخص من TeacherProfile إن وُجدت، وإلا من حقل photo."""
        if self.teacher_profile and self.teacher_profile.user.avatar:
            return self.teacher_profile.user.avatar
        return self.photo
