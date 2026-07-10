"""
================================================================================
live/apps.py
================================================================================
إعدادات تطبيق نظام البث المباشر (Live Rooms & Sessions)
================================================================================
"""

from django.apps import AppConfig


class LiveConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "live"
    verbose_name = "البث المباشر"

    def ready(self):
        # تسجيل الـ Signals عند بدء تشغيل التطبيق
        import live.signals  # noqa: F401
