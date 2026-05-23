"""
================================================================================
site_settings/urls.py
================================================================================
"""

from django.urls import path
from .views import (
    PublicSiteDataView, ContactFormView,
    PublicAnnouncementsView, PublicStaffView,
    SiteSettingsView,
    AnnouncementListCreateView, AnnouncementDetailView, AnnouncementToggleView,
    ContactToolListCreateView, ContactToolDetailView,
    InboxListView, InboxDetailView, InboxUpdateStatusView,
    StaffCardListCreateView, StaffCardDetailView,
)

# ── Public (بدون مصادقة) ──────────────────────────────────────────────────────
public_urlpatterns = [
    path("site-data/",       PublicSiteDataView.as_view(),       name="public-site-data"),
    path("contact/",         ContactFormView.as_view(),           name="public-contact"),
    path("announcements/",   PublicAnnouncementsView.as_view(),   name="public-announcements"),
    path("staff/",           PublicStaffView.as_view(),           name="public-staff"),
]

# ── Admin ──────────────────────────────────────────────────────────────────────
admin_urlpatterns = [
    # ── إعدادات الموقع ────────────────────────────────────────────────────────
    path("settings/",                         SiteSettingsView.as_view(),         name="admin-settings"),

    # ── الإعلانات ─────────────────────────────────────────────────────────────
    path("announcements/",                    AnnouncementListCreateView.as_view(), name="admin-announcement-list"),
    path("announcements/<int:pk>/",           AnnouncementDetailView.as_view(),     name="admin-announcement-detail"),
    path("announcements/<int:pk>/toggle/",    AnnouncementToggleView.as_view(),     name="admin-announcement-toggle"),

    # ── أدوات التواصل ─────────────────────────────────────────────────────────
    path("contact-tools/",                    ContactToolListCreateView.as_view(),  name="admin-contact-tool-list"),
    path("contact-tools/<int:pk>/",           ContactToolDetailView.as_view(),      name="admin-contact-tool-detail"),

    # ── صندوق الوارد ──────────────────────────────────────────────────────────
    path("inbox/",                            InboxListView.as_view(),              name="admin-inbox-list"),
    path("inbox/<int:pk>/",                   InboxDetailView.as_view(),            name="admin-inbox-detail"),
    path("inbox/<int:pk>/status/",            InboxUpdateStatusView.as_view(),      name="admin-inbox-status"),

    # ── الكادر ────────────────────────────────────────────────────────────────
    path("staff/",                            StaffCardListCreateView.as_view(),    name="admin-staff-list"),
    path("staff/<int:pk>/",                   StaffCardDetailView.as_view(),        name="admin-staff-detail"),
]
