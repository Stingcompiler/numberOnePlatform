"""
================================================================================
store/models.py
================================================================================
متجر تطبيقات "مدارس ومعاهد نمبر ون".

الهيكل:
  App           : التطبيق — الاسم والوصف والأيقونة وحالة النشر.
  AppPlatform   : توفّر التطبيق على منصة واحدة (رابط متجر / رابط مباشر / ملف).
  AppScreenshot : صور معرض اختيارية.

قابلية التوسع: المنصة قيمة في Platform.choices ومتطلباتها سطر في
PLATFORM_SPECS. إضافة لينكس أو ويب لاحقاً = قيمة وسطر، بلا تغيير بنيوي.

سياسة الإصدارات: صف واحد لكل (تطبيق، منصة) — يُستبدل عند التحديث ولا
يُراكَم. الطالب ينزّل الأحدث دائماً، ولا نسخة قديمة تخالف الـ API.
================================================================================
"""

import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _

from .validators import AllowedExtensionsValidator, MaxFileSizeValidator

# ─────────────────────────────────────────────────────────────────────────────
# حدود الرفع
# ─────────────────────────────────────────────────────────────────────────────

#: الصور (الأيقونة ولقطات المعرض)
MAX_IMAGE_MB = 5

#: حزم التطبيقات. القرص ١٠ ج.ب مشترك مع الوسائط والنسخ الاحتياطية،
#: والتنزيل يُخدَم من نفس الخادم — فالحد يحمي المساحة والنطاق الترددي معاً.
MAX_PACKAGE_MB = 500

IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"]


# ─────────────────────────────────────────────────────────────────────────────
# دوال مساعدة
# ─────────────────────────────────────────────────────────────────────────────

def app_icon_upload_path(instance, filename):
    ext = filename.split(".")[-1]
    return f"store/icons/{uuid.uuid4().hex}.{ext}"


def app_screenshot_upload_path(instance, filename):
    ext = filename.split(".")[-1]
    return f"store/screenshots/{uuid.uuid4().hex}.{ext}"


def app_package_upload_path(instance, filename):
    ext = filename.split(".")[-1]
    return f"store/packages/{instance.platform}/{uuid.uuid4().hex}.{ext}"


# ─────────────────────────────────────────────────────────────────────────────
# 1. App — التطبيق
# ─────────────────────────────────────────────────────────────────────────────

class App(models.Model):
    """
    تطبيق معروض في المتجر.

    is_published يفصل التحضير عن العرض: التطبيق يُبنى بمنصاته وصوره ثم
    يُنشر بخطوة واحدة. الواجهة العامة لا ترى غير المنشور.
    """

    name        = models.CharField(_("اسم التطبيق"), max_length=150)
    short_description = models.CharField(
        _("وصف مختصر"),
        max_length=200,
        blank=True,
        help_text=_("يظهر في بطاقة التطبيق داخل قائمة المتجر."),
    )
    description = models.TextField(_("الوصف"), blank=True)
    icon        = models.ImageField(
        _("أيقونة التطبيق"),
        upload_to=app_icon_upload_path,
        blank=True,
        null=True,
        validators=[
            MaxFileSizeValidator(MAX_IMAGE_MB),
            AllowedExtensionsValidator(IMAGE_EXTENSIONS),
        ],
    )
    is_published  = models.BooleanField(
        _("منشور"),
        default=False,
        help_text=_("غير المنشور لا يظهر في المتجر العام."),
    )
    display_order = models.PositiveSmallIntegerField(_("ترتيب العرض"), default=0)
    created_at    = models.DateTimeField(_("تاريخ الإنشاء"), auto_now_add=True)
    updated_at    = models.DateTimeField(_("آخر تحديث"), auto_now=True)

    class Meta:
        verbose_name        = _("تطبيق")
        verbose_name_plural = _("التطبيقات")
        ordering            = ["display_order", "name"]
        indexes = [
            models.Index(fields=["is_published"], name="store_app_published_idx"),
        ]

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────────────────────────────────────
# 2. AppPlatform — توفّر التطبيق على منصة
# ─────────────────────────────────────────────────────────────────────────────

class AppPlatform(models.Model):
    """
    منصة واحدة يتوفّر عليها التطبيق.

    ثلاث طرق للتنزيل، وأيّها يكفي يعتمد على المنصة (انظر PLATFORM_SPECS):
      store_url    : متجر رسمي (Google Play / App Store)
      external_url : رابط تنزيل خارجي مباشر
      file         : حزمة مرفوعة على الخادم

    التحقق من استيفاء المتطلبات يقع في الـ serializer، حيث تُبنى رسائل
    الخطأ العربية وتُنسب إلى حقولها.
    """

    class Platform(models.TextChoices):
        ANDROID = "android", _("أندرويد")
        IOS     = "ios",     _("آي أو إس")
        WINDOWS = "windows", _("ويندوز")
        MACOS   = "macos",   _("ماك أو إس")

    app          = models.ForeignKey(
        App,
        on_delete=models.CASCADE,
        related_name="platforms",
        verbose_name=_("التطبيق"),
    )
    platform     = models.CharField(
        _("المنصة"),
        max_length=20,
        choices=Platform.choices,
    )
    store_url    = models.URLField(
        _("رابط المتجر"),
        max_length=500,
        blank=True,
        help_text=_("Google Play أو App Store."),
    )
    external_url = models.URLField(
        _("رابط تنزيل خارجي"),
        max_length=500,
        blank=True,
        help_text=_("رابط مباشر خارج الخادم."),
    )
    file         = models.FileField(
        _("ملف التطبيق"),
        upload_to=app_package_upload_path,
        blank=True,
        null=True,
        validators=[MaxFileSizeValidator(MAX_PACKAGE_MB)],
        help_text=_("الامتدادات المسموحة تختلف حسب المنصة."),
    )
    updated_at   = models.DateTimeField(_("آخر تحديث"), auto_now=True)

    class Meta:
        verbose_name        = _("منصة تطبيق")
        verbose_name_plural = _("منصات التطبيقات")
        ordering            = ["platform"]
        constraints = [
            # إصدار واحد لكل منصة: التحديث يستبدل ولا يُضيف صفاً ثانياً.
            models.UniqueConstraint(
                fields=["app", "platform"],
                name="store_unique_app_platform",
            ),
        ]

    def __str__(self):
        return f"{self.app.name} — {self.get_platform_display()}"

    @property
    def file_size_mb(self):
        """حجم الحزمة بالميجابايت، أو None إن لم يُرفع ملف."""
        if not self.file:
            return None
        try:
            return round(self.file.size / (1024 * 1024), 1)
        except (OSError, ValueError):
            # السجل يشير إلى ملف غير موجود على القرص — لا نُسقط الاستجابة.
            return None

    @property
    def download_url(self):
        """
        الوجهة التي يفتحها زر التنزيل، بترتيب الأفضلية:
        المتجر الرسمي، ثم الرابط الخارجي، ثم الملف المرفوع.
        """
        if self.store_url:
            return self.store_url
        if self.external_url:
            return self.external_url
        if self.file:
            return self.file.url
        return None


# ─────────────────────────────────────────────────────────────────────────────
# 3. AppScreenshot — صور المعرض
# ─────────────────────────────────────────────────────────────────────────────

class AppScreenshot(models.Model):
    """لقطة من التطبيق تُعرض في صفحة تفاصيله."""

    app           = models.ForeignKey(
        App,
        on_delete=models.CASCADE,
        related_name="screenshots",
        verbose_name=_("التطبيق"),
    )
    image         = models.ImageField(
        _("الصورة"),
        upload_to=app_screenshot_upload_path,
        validators=[
            MaxFileSizeValidator(MAX_IMAGE_MB),
            AllowedExtensionsValidator(IMAGE_EXTENSIONS),
        ],
    )
    caption       = models.CharField(_("تعليق"), max_length=200, blank=True)
    display_order = models.PositiveSmallIntegerField(_("ترتيب العرض"), default=0)

    class Meta:
        verbose_name        = _("لقطة شاشة")
        verbose_name_plural = _("لقطات الشاشة")
        ordering            = ["display_order", "id"]

    def __str__(self):
        return f"{self.app.name} — لقطة {self.display_order}"


# ─────────────────────────────────────────────────────────────────────────────
# متطلبات المنصات
# ─────────────────────────────────────────────────────────────────────────────
# مرجع واحد يقرأ منه الـ serializer والاختبارات والواجهة. إضافة منصة جديدة
# تعني قيمة في Platform.choices وسطراً هنا — لا أكثر.
#
#   extensions : امتدادات الملف المقبولة (فارغة = لا يُقبل رفع ملف)
#   requires   : أقل ما يجعل المنصة صالحة
#       "store_url"    → رابط متجر رسمي حصراً
#       "any_link"     → رابط متجر أو رابط خارجي (والملف اختياري)
#       "file_or_link" → ملف مرفوع أو رابط خارجي

PLATFORM_SPECS = {
    AppPlatform.Platform.ANDROID: {
        "extensions": ["apk", "aab"],
        "requires":   "any_link",
    },
    AppPlatform.Platform.IOS: {
        "extensions": [],
        "requires":   "store_url",
    },
    AppPlatform.Platform.WINDOWS: {
        "extensions": ["exe", "msi", "zip"],
        "requires":   "file_or_link",
    },
    AppPlatform.Platform.MACOS: {
        "extensions": ["dmg", "pkg", "zip"],
        "requires":   "file_or_link",
    },
}
