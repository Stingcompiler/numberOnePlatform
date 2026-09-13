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
        "session_name", "provider", "stream_url", "status",
    ]
    show_change_link = True


@admin.register(LiveRoom)
class LiveRoomAdmin(admin.ModelAdmin):
    list_display   = ["room_name", "room_type", "grade", "course_type", "is_active", "created_at"]
    list_filter    = ["room_type", "grade", "course_type", "is_active"]
    list_select_related = ["grade__level"]
    search_fields  = ["room_name"]
    list_editable  = ["is_active"]
    inlines        = [LiveSessionInline]
    ordering       = ["-created_at"]


@admin.register(LiveSession)
class LiveSessionAdmin(admin.ModelAdmin):
    list_display   = ["session_name", "room", "provider", "status", "created_at"]
    list_filter    = ["status", "provider", "room__room_type"]
    search_fields  = ["session_name", "room__room_name"]
    list_select_related = ["room"]
    ordering       = ["-created_at"]
    date_hierarchy = "created_at"
