"""
================================================================================
live/admin.py
================================================================================
Django Admin لنظام البث المباشر
================================================================================
"""

from django.contrib import admin
from .models import LiveRoom, LiveSession


class LiveSessionInline(admin.TabularInline):
    """عرض الجلسات داخل صفحة الغرفة."""
    model          = LiveSession
    extra          = 0
    fields         = [
        "session_name", "provider", "stream_url", "status", "display_order",
    ]
    show_change_link = True


@admin.register(LiveRoom)
class LiveRoomAdmin(admin.ModelAdmin):
    list_display   = ["room_name", "room_type", "grade", "course_type", "display_order", "is_active", "created_at"]
    list_filter    = ["room_type", "grade", "course_type", "is_active"]
    list_select_related = ["grade__level"]
    search_fields  = ["room_name"]
    list_editable  = ["display_order", "is_active"]
    inlines        = [LiveSessionInline]
    ordering       = ["-display_order", "room_name"]


@admin.register(LiveSession)
class LiveSessionAdmin(admin.ModelAdmin):
    list_display   = ["session_name", "room", "provider", "status", "display_order", "created_at"]
    list_filter    = ["status", "provider", "room__room_type"]
    search_fields  = ["session_name", "room__room_name"]
    list_select_related = ["room"]
    list_editable  = ["display_order"]
    ordering       = ["room", "-display_order", "session_name"]
    date_hierarchy = "created_at"
