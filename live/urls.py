"""
================================================================================
live/urls.py
================================================================================
URL patterns لنظام البث المباشر

Admin:
  GET/POST   /api/live/rooms/
  GET/PUT/PATCH/DELETE  /api/live/rooms/<pk>/
  POST       /api/live/rooms/<pk>/toggle-active/
  GET/POST   /api/live/rooms/<pk>/sessions/
  GET/PUT/PATCH/DELETE  /api/live/rooms/<pk>/sessions/<session_pk>/

Student:
  GET        /api/live/my-sessions/
================================================================================
"""

from django.urls import path
from .views import (
    LiveRoomListCreateView,
    LiveRoomDetailView,
    LiveRoomToggleActiveView,
    LiveSessionListCreateView,
    LiveSessionDetailView,
    MyLiveSessionsView,
)

urlpatterns = [
    # ── Admin: إدارة الغرف ────────────────────────────────────────────────────
    path("rooms/",
         LiveRoomListCreateView.as_view(),
         name="live-room-list"),

    path("rooms/<int:pk>/",
         LiveRoomDetailView.as_view(),
         name="live-room-detail"),

    path("rooms/<int:pk>/toggle-active/",
         LiveRoomToggleActiveView.as_view(),
         name="live-room-toggle"),

    # ── Admin: إدارة الجلسات داخل الغرف ──────────────────────────────────────
    path("rooms/<int:room_pk>/sessions/",
         LiveSessionListCreateView.as_view(),
         name="live-session-list"),

    path("rooms/<int:room_pk>/sessions/<int:pk>/",
         LiveSessionDetailView.as_view(),
         name="live-session-detail"),

    # ── Student: جلسات البث الخاصة بالطالب ───────────────────────────────────
    path("my-sessions/",
         MyLiveSessionsView.as_view(),
         name="my-live-sessions"),
]
