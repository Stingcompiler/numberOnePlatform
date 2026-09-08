"""
================================================================================
store/urls.py
================================================================================
مسارات متجر التطبيقات، مقسّمة كما في site_settings: مجموعة عامة تُركَّب تحت
/api/public/ وأخرى إدارية تحت /api/admin/.
================================================================================
"""

from django.urls import path

from .views import (
    PublicAppListView, PublicAppDetailView,
    AdminAppListCreateView, AdminAppDetailView, AdminAppPublishView,
    AdminPlatformListCreateView, AdminPlatformDetailView,
    AdminScreenshotListCreateView, AdminScreenshotDetailView,
    PlatformOptionsView,
)

# ── Public (بدون مصادقة) ──────────────────────────────────────────────────────
public_urlpatterns = [
    path("apps/",            PublicAppListView.as_view(),   name="public-app-list"),
    path("apps/<int:pk>/",   PublicAppDetailView.as_view(), name="public-app-detail"),
]

# ── Admin ──────────────────────────────────────────────────────────────────────
admin_urlpatterns = [
    path("platform-options/",            PlatformOptionsView.as_view(),         name="admin-platform-options"),

    path("apps/",                        AdminAppListCreateView.as_view(),      name="admin-app-list"),
    path("apps/<int:pk>/",               AdminAppDetailView.as_view(),          name="admin-app-detail"),
    path("apps/<int:pk>/publish/",       AdminAppPublishView.as_view(),         name="admin-app-publish"),

    path("apps/<int:app_id>/platforms/",   AdminPlatformListCreateView.as_view(),   name="admin-platform-list"),
    path("platforms/<int:pk>/",            AdminPlatformDetailView.as_view(),       name="admin-platform-detail"),

    path("apps/<int:app_id>/screenshots/", AdminScreenshotListCreateView.as_view(), name="admin-screenshot-list"),
    path("screenshots/<int:pk>/",          AdminScreenshotDetailView.as_view(),     name="admin-screenshot-detail"),
]
