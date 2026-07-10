"""
================================================================================
live/services.py
================================================================================
خدمة إرسال الإشعارات لنظام البث المباشر

منطق الإشعارات مُعزول تماماً هنا — لا يوجد أي منطق إشعارات في الـ Views.
الـ Signal في live/signals.py يستدعي هذه الخدمة.
================================================================================
"""

import logging
from accounts.models import StudentProfile
from notifications.services import create_and_send_notification
from notifications.models import Notification

logger = logging.getLogger(__name__)


def notify_new_live_session(session):
    """
    يُرسل إشعار Push لجميع الطلاب الذين يطابق نظامهم الدراسي نوع الغرفة.

    منطق الفلترة:
      - room.room_type == "online"  → إرسال لجميع طلاب الأونلاين
      - room.room_type == "flash"   → إرسال لجميع طلاب الفلاش

    يتجنب إرسال إشعار مكرر إذا كان الإشعار أُرسل مسبقاً لنفس الجلسة.
    """
    try:
        room = session.room

        # ── التحقق من عدم التكرار ──────────────────────────────────────────
        already_sent = Notification.objects.filter(
            notification_type=Notification.NotificationType.LIVE_SESSION,
            related_object_id=str(session.id),
        ).exists()

        if already_sent:
            logger.info(
                f"[LiveSession] Notification already sent for session id={session.id}. Skipping."
            )
            return

        # ── فلترة الطلاب المطابقين ─────────────────────────────────────────
        # الفلترة تعتمد فقط على system_type لأن الطلاب لا يُصنَّفون بغير ذلك
        students = StudentProfile.objects.filter(
            system_type=room.room_type,
            user__is_active=True,
        ).select_related("user")

        if not students.exists():
            logger.info(
                f"[LiveSession] No matching students for room_type='{room.room_type}'. "
                f"No notification sent for session id={session.id}."
            )
            return

        # ── بناء رسالة الإشعار ─────────────────────────────────────────────
        title   = f"🔴 جلسة بث مباشر جديدة: {session.session_name}"
        message = (
            f"تم جدولة جلسة بث مباشر جديدة في غرفة «{room.room_name}» "
            f"عبر {session.get_provider_display()}."
        )

        # ── إرسال الإشعار ─────────────────────────────────────────────────
        create_and_send_notification(
            students=students,
            title=title,
            message=message,
            notification_type=Notification.NotificationType.LIVE_SESSION,
            related_object_id=str(session.id),
        )

        logger.info(
            f"[LiveSession] Notification sent to {students.count()} students "
            f"for session id={session.id}."
        )

    except Exception as exc:
        # لا نسمح لأي خطأ في الإشعارات بإيقاف إنشاء الجلسة
        logger.error(
            f"[LiveSession] Failed to send notification for session id={session.id}: {exc}",
            exc_info=True,
        )
