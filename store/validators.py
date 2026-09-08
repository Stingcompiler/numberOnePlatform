"""
================================================================================
store/validators.py
================================================================================
التحقق من الملفات المرفوعة إلى متجر التطبيقات.

لا توجد في المشروع طبقة تحقق للملفات — ستة عشر حقل ملف بلا أي validator —
فهذه أول واحدة. كُتبت عامة كي تُستخدم لاحقاً على نقاط الرفع الأخرى.
================================================================================
"""

import os

from django.core.exceptions import ValidationError
from django.utils.deconstruct import deconstructible
from django.utils.translation import gettext_lazy as _

#: ميجابايت بالبايت
MB = 1024 * 1024


@deconstructible
class MaxFileSizeValidator:
    """يرفض الملفات الأكبر من الحد بالميجابايت."""

    def __init__(self, max_mb):
        self.max_mb = max_mb

    def __call__(self, value):
        if value.size > self.max_mb * MB:
            raise ValidationError(
                _("حجم الملف %(size).1f م.ب يتجاوز الحد المسموح %(max)d م.ب."),
                code="file_too_large",
                params={"size": value.size / MB, "max": self.max_mb},
            )

    def __eq__(self, other):
        return isinstance(other, MaxFileSizeValidator) and self.max_mb == other.max_mb


@deconstructible
class AllowedExtensionsValidator:
    """
    يرفض الامتدادات غير المدعومة برسالة تذكر المسموح.

    FileExtensionValidator المدمج في Django يعطي رسالة إنجليزية، ورسائل
    الخطأ في هذا المشروع عربية.
    """

    def __init__(self, extensions):
        self.extensions = [e.lower().lstrip(".") for e in extensions]

    def __call__(self, value):
        ext = os.path.splitext(value.name)[1].lower().lstrip(".")
        if ext not in self.extensions:
            raise ValidationError(
                _("نوع الملف «%(ext)s» غير مدعوم. المسموح: %(allowed)s."),
                code="invalid_extension",
                params={
                    "ext": ext or _("غير معروف"),
                    "allowed": "، ".join(f".{e}" for e in self.extensions),
                },
            )

    def __eq__(self, other):
        return (
            isinstance(other, AllowedExtensionsValidator)
            and self.extensions == other.extensions
        )
