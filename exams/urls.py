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
    # Student views
    StudentExamListView,
    StudentExamDetailView,
    StudentSubmitExamView,
    StudentAttemptDetailView,
)

urlpatterns = [
    # ── الاختبارات CRUD ──────────────────────────────────────────────────────
    path("",                             ExamListView.as_view(),         name="exam-list"),
    path("create/",                      ExamCreateView.as_view(),       name="exam-create"),
    path("<int:pk>/",                    ExamDetailView.as_view(),       name="exam-detail"),

    # ── محاولات الطلاب ────────────────────────────────────────────────────────
    path("<int:exam_id>/submissions/",   ExamSubmissionsView.as_view(),  name="exam-submissions"),
    path("attempts/<int:pk>/",           AttemptDetailView.as_view(),    name="attempt-detail"),

    # ── واجهات الطالب ─────────────────────────────────────────────────────────
    path("student/list/",                StudentExamListView.as_view(),  name="student-exam-list"),
    path("student/<int:pk>/",            StudentExamDetailView.as_view(), name="student-exam-detail"),
    path("student/<int:exam_id>/submit/", StudentSubmitExamView.as_view(), name="student-exam-submit"),
    path("student/attempts/<int:pk>/",   StudentAttemptDetailView.as_view(), name="student-attempt-detail"),
]
