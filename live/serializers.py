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

    display_order فريد داخل الغرفة والأعلى أولاً. مُصرَّح به هنا لا مولَّداً
    كي تُكتب رسالة الرفض بالعربية وتسمّي الجلسة التي تحمل الرقم، ولأن
    الغرفة تأتي من المسار لا من الجسم فلا يصلح مُحقِّق DRF المشترك.
    """
    room_name     = serializers.CharField(source="room.room_name", read_only=True)
    # بلا رقم ⇒ الموديل يعطي الأعلى+1 عند الحفظ.
    display_order = serializers.IntegerField(min_value=0, required=False, allow_null=True)

    class Meta:
        model  = LiveSession
        fields = [
            "id", "room", "room_name",
            "session_name", "description",
            "provider", "stream_url",
            "status", "display_order",
            "created_at", "updated_at",
        ]
        # الغرفة تُحدَّد من المسار (save(room=...)) لا من جسم الطلب.
        read_only_fields = ["id", "room", "created_at", "updated_at", "room_name"]

    def _room_id(self):
        if self.instance is not None:
            return self.instance.room_id
        view = self.context.get("view")
        return view.kwargs.get("room_pk") if view is not None else None

    def validate_display_order(self, value):
        if value is None:
            return value
        taken = (
            LiveSession.objects
            .filter(room_id=self._room_id(), display_order=value)
            .exclude(pk=self.instance.pk if self.instance else None)
            .first()
        )
        if taken:
            raise serializers.ValidationError(
                f"الترتيب {value} مستخدم للجلسة «{taken.session_name}» — اختر رقماً آخر."
            )
        return value

    def validate_stream_url(self, value):
        """التحقق من صحة الرابط."""
        if value and not (value.startswith("http://") or value.startswith("https://")):
            raise serializers.ValidationError("الرابط يجب أن يبدأ بـ http:// أو https://")
        return value


class _RoomOrderMixin(serializers.Serializer):
    """
    display_order فريد بين كل الغرف والأعلى أولاً — قائمة المدير واحدة لكل
    الأنظمة فالتفرّد على مستواها. مُصرَّح به هنا لا مولَّداً كي تُكتب رسالة
    الرفض بالعربية وتسمّي الغرفة التي تحمل الرقم. الغرفة الجديدة بلا رقم
    تأخذ الأعلى+1 فتظهر أولاً.

    يرث Serializer لا object: حقل مُصرَّح في خليط عادي لا يلتقطه
    SerializerMetaclass، فيولّد ModelSerializer الحقل من الموديل بمُحقِّق
    التفرّد العام ورسالته العامة بدل هذه.
    """
    # بلا رقم ⇒ الموديل يعطي الأعلى+1 عند الحفظ.
    display_order = serializers.IntegerField(min_value=0, required=False, allow_null=True)

    def validate_display_order(self, value):
        if value is None:
            return value
        taken = (
            LiveRoom.objects
            .filter(display_order=value)
            .exclude(pk=self.instance.pk if self.instance else None)
            .first()
        )
        if taken:
            raise serializers.ValidationError(
                f"الترتيب {value} مستخدم للغرفة «{taken.room_name}» — اختر رقماً آخر."
            )
        return value


class _RoomGradeValidationMixin:
    """
    الفصل يجب أن يكون من نظام الغرفة نفسه.

    غرفة أونلاين بفصل فلاش لا يراها أحد: فلتر الطالب يشترط الاثنين معاً،
    وطالب الفلاش لا يمرّ من room_type ولا طالب الأونلاين من grade. الرفض
    هنا أوضح من غرفة صامتة. يقرأ الحقل غير المُرسَل من الكائن فلا يُلتفّ
    عليه بـ PATCH يغيّر أحدهما فقط.

    مشترك لأن الإنشاء يمرّ من السيريالايزر المختصر والتعديل من الكامل.
    """

    def validate(self, attrs):
        grade     = attrs.get("grade",     self.instance.grade     if self.instance else None)
        room_type = attrs.get("room_type", self.instance.room_type if self.instance else None)
        if grade and room_type and grade.system_type != room_type:
            raise serializers.ValidationError({
                "grade": "الفصل المختار من نظام آخر — اختر فصلاً من نظام الغرفة نفسه."
            })
        return attrs


class LiveRoomAdminSerializer(_RoomOrderMixin, _RoomGradeValidationMixin, serializers.ModelSerializer):
    """
    Serializer الغرفة للمسؤول — يتضمن جميع الجلسات متداخلة.
    """
    sessions       = LiveSessionAdminSerializer(many=True, read_only=True)
    sessions_count = serializers.IntegerField(source="sessions.count", read_only=True)
    grade_name     = serializers.CharField(source="grade.name",       read_only=True, default=None)
    level_name     = serializers.CharField(source="grade.level.name", read_only=True, default=None)

    class Meta:
        model  = LiveRoom
        fields = [
            "id", "room_name", "room_type", "course_type",
            "grade", "grade_name", "level_name",
            "description", "display_order", "is_active",
            "sessions_count", "sessions",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "grade_name", "level_name"]

    def validate_room_name(self, value):
        """التحقق من أن اسم الغرفة ليس فارغاً."""
        if not value or not value.strip():
            raise serializers.ValidationError("اسم الغرفة لا يمكن أن يكون فارغاً.")
        return value.strip()


class LiveRoomListAdminSerializer(_RoomOrderMixin, _RoomGradeValidationMixin, serializers.ModelSerializer):
    """
    Serializer مختصر للغرفة — يُستخدم في قوائم الغرف (بدون جلسات متداخلة).
    """
    sessions_count = serializers.IntegerField(source="sessions.count", read_only=True)
    grade_name     = serializers.CharField(source="grade.name",       read_only=True, default=None)
    level_name     = serializers.CharField(source="grade.level.name", read_only=True, default=None)

    class Meta:
        model  = LiveRoom
        fields = [
            "id", "room_name", "room_type", "course_type",
            "grade", "grade_name", "level_name",
            "description", "display_order", "is_active",
            "sessions_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "grade_name", "level_name"]


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
            "status", "status_display",
        ]


class LiveRoomStudentSerializer(serializers.ModelSerializer):
    """
    Serializer الغرفة للطالب — يتضمن جميع جلساتها متداخلة.
    الاستجابة مُهيأة: كل غرفة تحتوي على sessions داخلها.
    """
    sessions   = LiveSessionStudentSerializer(many=True, read_only=True)
    grade_name = serializers.CharField(source="grade.name", read_only=True, default=None)

    class Meta:
        model  = LiveRoom
        fields = [
            "id", "room_name", "room_type", "grade_name",
            "description", "sessions",
        ]
