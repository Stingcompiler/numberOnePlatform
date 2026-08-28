"""
================================================================================
store/serializers.py
================================================================================
Serializers متجر التطبيقات.

الفصل بين العام والإداري يتبع نمط site_settings: الواجهة العامة تحصل على
ما يلزم للعرض والتنزيل فقط، والإدارة على الحقول القابلة للتحرير.

التحقق من متطلبات كل منصة يقع هنا لا في الموديل، لأن رسائل الخطأ يجب أن
تُنسب إلى حقولها كي تعرضها الواجهة تحت الحقل الصحيح.
================================================================================
"""

import os

from rest_framework import serializers
from django.utils.translation import gettext_lazy as _

from .models import (
    App, AppPlatform, AppScreenshot, PLATFORM_SPECS,
    MAX_PACKAGE_MB, MAX_IMAGE_MB,
)


# ─────────────────────────────────────────────────────────────────────────────
# 1. لقطات الشاشة
# ─────────────────────────────────────────────────────────────────────────────

class AppScreenshotSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AppScreenshot
        fields = ["id", "image", "caption", "display_order"]


# ─────────────────────────────────────────────────────────────────────────────
# 2. المنصات
# ─────────────────────────────────────────────────────────────────────────────

class AppPlatformSerializer(serializers.ModelSerializer):
    """
    منصة واحدة، للقراءة والكتابة.

    download_url و file_size_mb محسوبان في الموديل: الواجهة تعرض زراً واحداً
    لكل منصة ولا يعنيها من أي مصدر جاء الرابط.
    """

    platform_display = serializers.CharField(
        source="get_platform_display", read_only=True
    )
    download_url = serializers.CharField(read_only=True)
    file_size_mb = serializers.FloatField(read_only=True)

    class Meta:
        model  = AppPlatform
        fields = [
            "id", "platform", "platform_display",
            "store_url", "external_url", "file",
            "download_url", "file_size_mb", "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]

    def _app_id(self):
        """التطبيق المالك: من الكائن عند التعديل، ومن السياق عند الإنشاء."""
        if self.instance is not None:
            return self.instance.app_id
        return self.context.get("app_id")

    def validate(self, attrs):
        platform = attrs.get("platform") or getattr(self.instance, "platform", None)
        spec = PLATFORM_SPECS.get(platform)
        if spec is None:
            raise serializers.ValidationError(
                {"platform": _("منصة غير معروفة.")}
            )

        # ── إصدار واحد لكل منصة ───────────────────────────────────────────
        # القيد الفريد معرَّف في Meta.constraints، وDRF لا يشتقّ منه validator
        # (يفعلها لـ unique_together فقط) — فبلا هذا الفحص يرتد التصادم
        # كـ IntegrityError أي خطأ 500 بدل رسالة مفهومة.
        app_id = self._app_id()
        if app_id is not None:
            clash = AppPlatform.objects.filter(app_id=app_id, platform=platform)
            if self.instance is not None:
                clash = clash.exclude(pk=self.instance.pk)
            if clash.exists():
                raise serializers.ValidationError({
                    "platform": _(
                        "هذه المنصة مضافة لهذا التطبيق بالفعل. "
                        "عدّل الصف القائم بدل إضافة صف ثانٍ."
                    )
                })

        def current(field):
            if field in attrs:
                return attrs[field]
            return getattr(self.instance, field, None)

        store_url    = current("store_url")
        external_url = current("external_url")
        uploaded     = current("file")

        # ── امتداد الحزمة ─────────────────────────────────────────────────
        if uploaded and getattr(uploaded, "name", None):
            allowed = spec["extensions"]
            ext = os.path.splitext(uploaded.name)[1].lower().lstrip(".")
            if not allowed:
                raise serializers.ValidationError({
                    "file": _("لا يُقبل رفع ملف لمنصة %(platform)s.") % {
                        "platform": dict(AppPlatform.Platform.choices)[platform]
                    }
                })
            if ext not in allowed:
                raise serializers.ValidationError({
                    "file": _("نوع الملف «%(ext)s» غير مدعوم لهذه المنصة. المسموح: %(allowed)s.") % {
                        "ext": ext or _("غير معروف"),
                        "allowed": "، ".join(f".{e}" for e in allowed),
                    }
                })

        # ── الحد الأدنى الذي يجعل المنصة صالحة ────────────────────────────
        requirement = spec["requires"]

        if requirement == "store_url" and not store_url:
            raise serializers.ValidationError({
                "store_url": _("رابط المتجر مطلوب لهذه المنصة.")
            })

        if requirement == "any_link" and not (store_url or external_url):
            raise serializers.ValidationError({
                "store_url": _(
                    "يلزم رابط متجر أو رابط تنزيل مباشر لهذه المنصة."
                )
            })

        if requirement == "file_or_link" and not (uploaded or external_url):
            raise serializers.ValidationError({
                "file": _(
                    "يلزم رفع ملف التطبيق أو تزويد رابط تنزيل خارجي لهذه المنصة."
                )
            })

        return attrs


class PublicAppPlatformSerializer(serializers.ModelSerializer):
    """
    ما تحتاجه الواجهة العامة لرسم زر التنزيل — ولا شيء غيره.

    الحقول الثلاثة الخام (store_url / external_url / file) لا تُرسل: الواجهة
    لا يجب أن تبني منطق أولوية ثانياً يخالف منطق الموديل.
    """

    platform_display = serializers.CharField(
        source="get_platform_display", read_only=True
    )
    download_url = serializers.CharField(read_only=True)
    file_size_mb = serializers.FloatField(read_only=True)
    is_store_link = serializers.SerializerMethodField()

    class Meta:
        model  = AppPlatform
        fields = [
            "platform", "platform_display",
            "download_url", "file_size_mb", "is_store_link",
        ]

    def get_is_store_link(self, obj):
        """يميّز «افتح في المتجر» عن «تنزيل مباشر» في نص الزر."""
        return bool(obj.store_url)


# ─────────────────────────────────────────────────────────────────────────────
# 3. التطبيقات — الواجهة العامة
# ─────────────────────────────────────────────────────────────────────────────

class PublicAppListSerializer(serializers.ModelSerializer):
    platforms = serializers.SerializerMethodField()

    class Meta:
        model  = App
        fields = ["id", "name", "short_description", "icon", "platforms"]

    def get_platforms(self, obj):
        return PublicAppPlatformSerializer(
            self._usable(obj), many=True, context=self.context
        ).data

    @staticmethod
    def _usable(obj):
        """
        المنصات التي لها وجهة تنزيل فعلية.

        صف بلا رابط ولا ملف يعني بياناتٍ ناقصة لا زراً معطّلاً — فلا يُعرض.
        """
        return [p for p in obj.platforms.all() if p.download_url]


class PublicAppDetailSerializer(PublicAppListSerializer):
    screenshots = AppScreenshotSerializer(many=True, read_only=True)

    class Meta(PublicAppListSerializer.Meta):
        fields = PublicAppListSerializer.Meta.fields + [
            "description", "screenshots", "updated_at",
        ]


# ─────────────────────────────────────────────────────────────────────────────
# 4. التطبيقات — الإدارة
# ─────────────────────────────────────────────────────────────────────────────

class AdminAppSerializer(serializers.ModelSerializer):
    platforms   = AppPlatformSerializer(many=True, read_only=True)
    screenshots = AppScreenshotSerializer(many=True, read_only=True)
    platform_count = serializers.SerializerMethodField()

    class Meta:
        model  = App
        fields = [
            "id", "name", "short_description", "description", "icon",
            "is_published", "display_order",
            "platforms", "screenshots", "platform_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_platform_count(self, obj):
        return obj.platforms.count()

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError(_("اسم التطبيق مطلوب."))
        return value.strip()


class AppPublishSerializer(serializers.Serializer):
    """
    نشر التطبيق أو سحبه.

    النشر يتطلب منصة صالحة واحدة على الأقل: تطبيق منشور بلا زر تنزيل هو
    صفحة ميتة يراها الزائر.
    """

    is_published = serializers.BooleanField()

    def validate(self, attrs):
        app = self.context["app"]
        if attrs["is_published"]:
            usable = [p for p in app.platforms.all() if p.download_url]
            if not usable:
                raise serializers.ValidationError({
                    "is_published": _(
                        "لا يمكن نشر تطبيق بلا منصة واحدة صالحة للتنزيل."
                    )
                })
        return attrs
