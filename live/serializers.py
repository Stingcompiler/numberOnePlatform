"""
================================================================================
live/serializers.py
================================================================================
Serializers لنظام البث المباشر

مجموعتان:
  - Admin Serializers : تكشف جميع الحقول للمسؤولين
  - Student Serializers: تكشف فقط الحقول الآمنة للطلاب
================================================================================
"""

from rest_framework import serializers
from .models import LiveRoom, LiveSession


# ─────────────────────────────────────────────────────────────────────────────
# Admin Serializers — للمسؤولين (CRUD كامل)
# ─────────────────────────────────────────────────────────────────────────────

class LiveSessionAdminSerializer(serializers.ModelSerializer):
    """
    Serializer جلسة البث للمسؤول — يكشف جميع الحقول مع التحقق الكامل.
    """
    room_name = serializers.CharField(source="room.room_name", read_only=True)

    class Meta:
        model  = LiveSession
        fields = [
            "id", "room", "room_name",
            "session_name", "description",
            "provider", "stream_url",
            "scheduled_start", "scheduled_end",
            "status",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "room_name"]

    def validate(self, attrs):
        """التحقق من أن موعد النهاية بعد موعد البداية."""
        start = attrs.get("scheduled_start") or (self.instance and self.instance.scheduled_start)
        end   = attrs.get("scheduled_end")   or (self.instance and self.instance.scheduled_end)

        if start and end and end <= start:
            raise serializers.ValidationError({
                "scheduled_end": "موعد النهاية يجب أن يكون بعد موعد البداية."
            })
        return attrs

    def validate_stream_url(self, value):
        """التحقق من صحة الرابط."""
        if value and not (value.startswith("http://") or value.startswith("https://")):
            raise serializers.ValidationError("الرابط يجب أن يبدأ بـ http:// أو https://")
        return value


class LiveRoomAdminSerializer(serializers.ModelSerializer):
    """
    Serializer الغرفة للمسؤول — يتضمن جميع الجلسات متداخلة.
    """
    sessions       = LiveSessionAdminSerializer(many=True, read_only=True)
    sessions_count = serializers.IntegerField(source="sessions.count", read_only=True)

    class Meta:
        model  = LiveRoom
        fields = [
            "id", "room_name", "room_type", "course_type",
            "description", "is_active",
            "sessions_count", "sessions",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_room_name(self, value):
        """التحقق من أن اسم الغرفة ليس فارغاً."""
        if not value or not value.strip():
            raise serializers.ValidationError("اسم الغرفة لا يمكن أن يكون فارغاً.")
        return value.strip()


class LiveRoomListAdminSerializer(serializers.ModelSerializer):
    """
    Serializer مختصر للغرفة — يُستخدم في قوائم الغرف (بدون جلسات متداخلة).
    """
    sessions_count = serializers.IntegerField(source="sessions.count", read_only=True)

    class Meta:
        model  = LiveRoom
        fields = [
            "id", "room_name", "room_type", "course_type",
            "description", "is_active",
            "sessions_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# ─────────────────────────────────────────────────────────────────────────────
# Student Serializers — للطلاب (قراءة فقط، حقول محدودة آمنة)
# ─────────────────────────────────────────────────────────────────────────────

class LiveSessionStudentSerializer(serializers.ModelSerializer):
    """
    Serializer جلسة البث للطالب — يكشف الحقول الضرورية فقط.
    """
    provider_display = serializers.CharField(source="get_provider_display", read_only=True)
    status_display   = serializers.CharField(source="get_status_display",   read_only=True)

    class Meta:
        model  = LiveSession
        fields = [
            "id", "session_name", "description",
            "provider", "provider_display",
            "stream_url",
            "scheduled_start", "scheduled_end",
            "status", "status_display",
        ]


class LiveRoomStudentSerializer(serializers.ModelSerializer):
    """
    Serializer الغرفة للطالب — يتضمن جميع جلساتها متداخلة.
    الاستجابة مُهيأة: كل غرفة تحتوي على sessions داخلها.
    """
    sessions = LiveSessionStudentSerializer(many=True, read_only=True)

    class Meta:
        model  = LiveRoom
        fields = [
            "id", "room_name", "room_type",
            "description", "sessions",
        ]
