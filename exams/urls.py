"""
================================================================================
exams/urls.py
================================================================================
"""

from django.urls import path
from .views import (
    ExamListView,
    ExamCreateView,
    ExamDetailView,
    ExamSubmissionsView,
    AttemptDetailView,
)

urlpatterns = [
    # ── الاختبارات CRUD ──────────────────────────────────────────────────────
    path("",                             ExamListView.as_view(),         name="exam-list"),
    path("create/",                      ExamCreateView.as_view(),       name="exam-create"),
    path("<int:pk>/",                    ExamDetailView.as_view(),       name="exam-detail"),

    # ── محاولات الطلاب ────────────────────────────────────────────────────────
    path("<int:exam_id>/submissions/",   ExamSubmissionsView.as_view(),  name="exam-submissions"),
    path("attempts/<int:pk>/",           AttemptDetailView.as_view(),    name="attempt-detail"),
]
