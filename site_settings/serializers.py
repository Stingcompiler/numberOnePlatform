"""
================================================================================
site_settings/serializers.py
================================================================================
"""

from rest_framework import serializers
from .models import SiteSettings, Announcement, ContactTool, ContactMessage, StaffCard


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SiteSettings
        fields = [
            "id", "institution_name", "short_title", "logo", "favicon",
            "vision", "mission", "objectives", "history",
            "meta_description", "meta_keywords",
            "primary_email", "primary_phone", "address_text",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]


class SiteSettingsPublicSerializer(serializers.ModelSerializer):
    """نسخة للزوار (بدون meta_keywords الداخلية)."""

    class Meta:
        model  = SiteSettings
        fields = [
            "institution_name", "short_title", "logo", "favicon",
            "vision", "mission", "objectives", "history",
            "meta_description", "meta_keywords",
            "primary_email", "primary_phone", "address_text",
        ]


class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Announcement
        fields = [
            "id", "title", "body", "image", "link",
            "is_active", "display_order", "start_date", "end_date",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ContactToolSerializer(serializers.ModelSerializer):
    tool_type_display = serializers.CharField(
        source="get_tool_type_display", read_only=True
    )

    class Meta:
        model  = ContactTool
        fields = [
            "id", "tool_type", "tool_type_display",
            "label", "value", "is_active", "display_order",
        ]
        read_only_fields = ["id", "tool_type_display"]


class ContactMessageSerializer(serializers.ModelSerializer):
    """للطلب الوارد من نموذج المراسلة في صفحة الهبوط."""

    class Meta:
        model  = ContactMessage
        fields = [
            "sender_name", "sender_phone", "sender_email",
            "subject", "message",
        ]

    def create(self, validated_data):
        # التقاط IP تلقائياً
        request = self.context.get("request")
        if request:
            x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
            ip = (
                x_forwarded_for.split(",")[0].strip()
                if x_forwarded_for
                else request.META.get("REMOTE_ADDR")
            )
            validated_data["ip_address"] = ip
        return super().create(validated_data)


class ContactMessageAdminSerializer(serializers.ModelSerializer):
    """لعرض الرسائل وتغيير حالتها في لوحة التحكم."""

    status_display   = serializers.CharField(source="get_status_display", read_only=True)
    handled_by_name  = serializers.CharField(
        source="handled_by.full_name", read_only=True, default=None
    )

    class Meta:
        model  = ContactMessage
        fields = [
            "id", "sender_name", "sender_phone", "sender_email",
            "subject", "message", "ip_address",
            "status", "status_display",
            "received_at", "updated_at",
            "handled_by", "handled_by_name",
        ]
        read_only_fields = [
            "id", "sender_name", "sender_phone", "sender_email",
            "subject", "message", "ip_address",
            "received_at", "updated_at",
            "status_display", "handled_by_name",
        ]


class StaffCardSerializer(serializers.ModelSerializer):
    card_type_display = serializers.CharField(
        source="get_card_type_display", read_only=True
    )
    display_name  = serializers.SerializerMethodField()
    display_photo = serializers.SerializerMethodField()

    class Meta:
        model  = StaffCard
        fields = [
            "id", "teacher_profile", "name", "title",
            "photo", "bio", "card_type", "card_type_display",
            "is_active", "display_order",
            "display_name", "display_photo",
        ]
        read_only_fields = ["id", "card_type_display", "display_name", "display_photo"]

    def get_display_name(self, obj):
        return obj.get_display_name()

    def get_display_photo(self, obj):
        photo = obj.get_display_photo()
        if not photo:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(photo.url)
        return photo.url
