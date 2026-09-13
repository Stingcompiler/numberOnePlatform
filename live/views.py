"""
================================================================================
live/views.py
================================================================================
Views نظام البث المباشر

مجموعتان:
  1. Admin Views: CRUD كامل للغرف والجلسات (للمسؤولين فقط)
  2. Student Views: Endpoint خاص بالطالب (يرى فقط الغرف المطابقة)

الأمان:
  - IsAdminOrManager : يحمي جميع endpoints الإدارة
  - IsStudent        : يحمي endpoint الطالب
  - الطالب لا يستطيع الوصول لأي endpoint إداري
================================================================================
"""

import logging

from django.db.models import Q
from django.utils.translation import gettext_lazy as _
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LiveRoom, LiveSession
from .permissions import IsAdminOrManager, IsStudent
from .serializers import (
    LiveRoomAdminSerializer,
    LiveRoomListAdminSerializer,
    LiveSessionAdminSerializer,
    LiveRoomStudentSerializer,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Admin — إدارة الغرف
# ─────────────────────────────────────────────────────────────────────────────

class LiveRoomListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/live/rooms/  → قائمة الغرف (مع عدد الجلسات لكل غرفة)
    POST /api/live/rooms/  → إنشاء غرفة جديدة
    """
    permission_classes = [IsAdminOrManager]
    # استخدام Serializer مختصر في القائمة لتجنب تحميل الجلسات غير الضرورية
    serializer_class   = LiveRoomListAdminSerializer
    queryset           = (
        LiveRoom.objects
        .select_related("grade__level")
        .prefetch_related("sessions")
        .order_by("-created_at")
    )

    def perform_create(self, serializer):
        serializer.save()
        logger.info(
            f"[LiveRoom] Created room '{serializer.instance.room_name}' "
            f"by user {self.request.user.username}."
        )


class LiveRoomDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/live/rooms/<pk>/  → تفاصيل غرفة مع جميع جلساتها
    PUT    /api/live/rooms/<pk>/  → تعديل كامل
    PATCH  /api/live/rooms/<pk>/  → تعديل جزئي
    DELETE /api/live/rooms/<pk>/  → حذف الغرفة وجميع جلساتها
    """
    permission_classes = [IsAdminOrManager]
    serializer_class   = LiveRoomAdminSerializer
    queryset           = LiveRoom.objects.select_related("grade__level").prefetch_related("sessions")

    def destroy(self, request, *args, **kwargs):
        room = self.get_object()
        room_name = room.room_name
        self.perform_destroy(room)
        logger.info(
            f"[LiveRoom] Deleted room '{room_name}' by user {request.user.username}."
        )
        return Response(
            {"detail": f"تم حذف الغرفة «{room_name}» وجميع جلساتها بنجاح."},
            status=status.HTTP_200_OK,
        )


class LiveRoomToggleActiveView(APIView):
    """
    POST /api/live/rooms/<pk>/toggle-active/
    تفعيل أو تعطيل الغرفة.
    """
    permission_classes = [IsAdminOrManager]

    def post(self, request, pk):
        try:
            room = LiveRoom.objects.get(pk=pk)
        except LiveRoom.DoesNotExist:
            return Response(
                {"detail": "الغرفة غير موجودة."},
                status=status.HTTP_404_NOT_FOUND,
            )

        room.is_active = not room.is_active
        room.save(update_fields=["is_active", "updated_at"])

        state = "مفعّلة" if room.is_active else "معطّلة"
        logger.info(
            f"[LiveRoom] Room '{room.room_name}' set to is_active={room.is_active} "
            f"by user {request.user.username}."
        )
        return Response({
            "id":        room.pk,
            "room_name": room.room_name,
            "is_active": room.is_active,
            "detail":    f"الغرفة «{room.room_name}» أصبحت {state}.",
        })


# ─────────────────────────────────────────────────────────────────────────────
# 2. Admin — إدارة الجلسات
# ─────────────────────────────────────────────────────────────────────────────

class LiveSessionListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/live/rooms/<room_pk>/sessions/  → جلسات غرفة محددة
    POST /api/live/rooms/<room_pk>/sessions/  → إنشاء جلسة جديدة
    """
    permission_classes = [IsAdminOrManager]
    serializer_class   = LiveSessionAdminSerializer

    def get_queryset(self):
        """
        نُقيّد الجلسات بالغرفة المحددة في الـ URL.
        select_related لتجنب N+1 queries.
        """
        return (
            LiveSession.objects
            .filter(room_id=self.kwargs["room_pk"])
            .select_related("room")
            .order_by("-created_at")
        )

    def get_room(self):
        """التحقق من وجود الغرفة قبل إنشاء الجلسة."""
        try:
            return LiveRoom.objects.get(pk=self.kwargs["room_pk"])
        except LiveRoom.DoesNotExist:
            return None

    def perform_create(self, serializer):
        room = self.get_room()
        if not room:
            from rest_framework.exceptions import NotFound
            raise NotFound("الغرفة غير موجودة.")

        serializer.save(room=room)
        logger.info(
            f"[LiveSession] Created session '{serializer.instance.session_name}' "
            f"in room '{room.room_name}' by user {self.request.user.username}."
        )

    def create(self, request, *args, **kwargs):
        # نضمن وجود الغرفة قبل المتابعة
        if not self.get_room():
            return Response(
                {"detail": "الغرفة غير موجودة."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return super().create(request, *args, **kwargs)


class LiveSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/live/rooms/<room_pk>/sessions/<pk>/  → تفاصيل جلسة
    PUT    /api/live/rooms/<room_pk>/sessions/<pk>/  → تعديل كامل
    PATCH  /api/live/rooms/<room_pk>/sessions/<pk>/  → تعديل جزئي
    DELETE /api/live/rooms/<room_pk>/sessions/<pk>/  → حذف جلسة
    """
    permission_classes = [IsAdminOrManager]
    serializer_class   = LiveSessionAdminSerializer

    def get_queryset(self):
        """نُقيّد بالغرفة لمنع الوصول المتقاطع بين الغرف."""
        return LiveSession.objects.filter(
            room_id=self.kwargs["room_pk"]
        ).select_related("room")

    def destroy(self, request, *args, **kwargs):
        session = self.get_object()
        name    = session.session_name
        self.perform_destroy(session)
        logger.info(
            f"[LiveSession] Deleted session '{name}' by user {request.user.username}."
        )
        return Response(
            {"detail": f"تم حذف الجلسة «{name}» بنجاح."},
            status=status.HTTP_200_OK,
        )

    def partial_update(self, request, *args, **kwargs):
        """
        PATCH — يدعم تغيير حالة الجلسة بمفرده.
        مثال: { "status": "live" }
        """
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Student — واجهة الطالب
# ─────────────────────────────────────────────────────────────────────────────

class MyLiveSessionsView(APIView):
    """
    GET /api/live/my-sessions/
    ──────────────────────────────────────────────────────────────
    يُعيد جميع الغرف المطابقة للطالب مع جلساتها متداخلة.

    الفلترة:
      1. قراءة StudentProfile من request.user
      2. مطابقة room.room_type مع student.system_type (online/flash)
      3. مطابقة room.grade مع student.enrolled_grade — أو غرفة بلا فصل
         (بثّ عام لكل فصول النظام). كان الفلتر بالنظام وحده، فيرى طالب
         الصف الأول بثّ كل الصفوف الأونلاين.
      4. عرض الغرف النشطة فقط (is_active=True)

    البنية المُعادة:
      [
        {
          "id": 1,
          "room_name": "...",
          "room_type": "online",
          "sessions": [ {...}, {...} ]
        },
        ...
      ]
    ──────────────────────────────────────────────────────────────
    """
    permission_classes = [IsStudent]

    def get(self, request):
        try:
            student = request.user.student_profile
        except Exception:
            return Response(
                {"detail": "لم يتم العثور على ملف الطالب."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── فلترة الغرف المطابقة لنظام الطالب ────────────────────────────
        # select_related + prefetch_related لتجنب N+1 queries
        # الغرفة بلا فصل تُرى من كل فصول نظامها. الطالب بلا فصل مسجّل
        # (فلاش عادةً) لا يرى إلا تلك.
        in_my_grade = Q(grade__isnull=True)
        if student.enrolled_grade_id:
            in_my_grade |= Q(grade_id=student.enrolled_grade_id)

        rooms = (
            LiveRoom.objects
            .filter(
                in_my_grade,
                room_type=student.system_type,
                is_active=True,
            )
            .select_related("grade")
            .prefetch_related("sessions")
            .order_by("-created_at")
        )

        serializer = LiveRoomStudentSerializer(rooms, many=True)
        return Response(serializer.data)
