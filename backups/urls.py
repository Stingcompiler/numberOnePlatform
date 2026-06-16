"""
================================================================================
backups/urls.py
================================================================================
"""

from django.urls import path
from . import views

app_name = "backups"

urlpatterns = [
    # النسخ الاحتياطي
    path("",                     views.BackupListView.as_view(),        name="list"),
    path("create/",              views.CreateBackupView.as_view(),      name="create"),
    path("<uuid:pk>/download/",  views.DownloadBackupView.as_view(),    name="download"),
    path("<uuid:pk>/restore/",   views.RestoreBackupView.as_view(),     name="restore"),
    path("<uuid:pk>/",           views.DeleteBackupView.as_view(),      name="delete"),

    # الإعدادات
    path("settings/",            views.BackupSettingsView.as_view(),    name="settings"),

    # سجلات الاستعادة
    path("restore-logs/",        views.RestoreLogListView.as_view(),    name="restore-logs"),
]
