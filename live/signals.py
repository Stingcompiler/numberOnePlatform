"""
================================================================================
live/signals.py
================================================================================
Signals نظام البث المباشر

عند إنشاء LiveSession جديدة:
  post_save → notify_new_live_session (في services.py)

لا يوجد أي منطق إشعارات هنا — فقط تسجيل الـ Signal واستدعاء الخدمة.
================================================================================
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import LiveSession
from .services import notify_new_live_session


@receiver(post_save, sender=LiveSession)
def on_live_session_created(sender, instance, created, **kwargs):
    """
    يُفعَّل بعد حفظ LiveSession.

    الإشعار يُرسل فقط عند إنشاء جلسة جديدة (created=True).
    عند التعديل لا يُرسل إشعار (يمكن إضافة منطق مشروط مستقبلاً
    مثل: إرسال إشعار إذا تغير موعد البداية فقط).
    """
    if created:
        # تفويض منطق الإشعار كاملاً للخدمة المستقلة
        notify_new_live_session(instance)
