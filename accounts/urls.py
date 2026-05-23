"""
================================================================================
accounts/urls.py
================================================================================
"""

from django.urls import path
from .views import (
    LoginView, LogoutView, TokenRefreshCookieView,
    MeView, ChangePasswordView,
    StudentListCreateView, StudentDetailView, StudentUnbindDeviceView,
    TeacherListCreateView, TeacherDetailView,
    SupervisorListCreateView, SupervisorDetailView,
    SupervisorStudentReportView, AllSupervisorsReportView,
    PublicStudentRequestCreateView, AdminStudentRequestListView, AdminStudentRequestDetailView,
    PublicNewRegistrationCreateView, AdminNewRegistrationListView, AdminNewRegistrationDetailView,
    PublicRegistrationConditionsView, AdminRegistrationConditionsListCreateView, AdminRegistrationConditionDetailView,
    PublicSupervisorMiniListView,
)

urlpatterns = [
    # ── المصادقة ──────────────────────────────────────────────────────────────
    path("auth/login/",           LoginView.as_view(),              name="auth-login"),
    path("auth/logout/",          LogoutView.as_view(),             name="auth-logout"),
    path("auth/refresh/",         TokenRefreshCookieView.as_view(), name="auth-refresh"),
    path("auth/me/",              MeView.as_view(),                 name="auth-me"),
    path("auth/change-password/", ChangePasswordView.as_view(),     name="auth-change-password"),

    # ── الطلاب ───────────────────────────────────────────────────────────────
    path("students/",                          StudentListCreateView.as_view(),  name="student-list"),
    path("students/<int:pk>/",                 StudentDetailView.as_view(),      name="student-detail"),
    path("students/<int:pk>/unbind-device/",   StudentUnbindDeviceView.as_view(), name="student-unbind-device"),

    # ── الأساتذة ─────────────────────────────────────────────────────────────
    path("teachers/",              TeacherListCreateView.as_view(), name="teacher-list"),
    path("teachers/<int:pk>/",     TeacherDetailView.as_view(),     name="teacher-detail"),

    # ── المشرفات ─────────────────────────────────────────────────────────────
    path("supervisors/",                       SupervisorListCreateView.as_view(), name="supervisor-list"),
    path("supervisors/public/",                PublicSupervisorMiniListView.as_view(), name="supervisor-public-list"),
    path("supervisors/report/all/",            AllSupervisorsReportView.as_view(),  name="supervisor-report-all"),
    path("supervisors/<int:pk>/",              SupervisorDetailView.as_view(),     name="supervisor-detail"),
    path("supervisors/<int:pk>/report/",       SupervisorStudentReportView.as_view(), name="supervisor-report"),

    # ── طلبات تسجيل الطلاب (النافذة العامة القديمة) ──────────────────────────
    path("student-requests/public/",           PublicStudentRequestCreateView.as_view(), name="student-request-public"),
    path("student-requests/",                  AdminStudentRequestListView.as_view(),    name="student-request-list"),
    path("student-requests/<int:pk>/",         AdminStudentRequestDetailView.as_view(),  name="student-request-detail"),

    # ── طلبات التسجيل الجديدة ─────────────────────────────────────────────────
    path("student-registration/public/",       PublicNewRegistrationCreateView.as_view(), name="new-registration-public"),
    path("student-registration/",              AdminNewRegistrationListView.as_view(),    name="new-registration-list"),
    path("student-registration/<int:pk>/",     AdminNewRegistrationDetailView.as_view(),  name="new-registration-detail"),

    # ── شروط التسجيل الإلكتروني ───────────────────────────────────────────────
    path("registration-conditions/public/",    PublicRegistrationConditionsView.as_view(), name="reg-conditions-public"),
    path("registration-conditions/",           AdminRegistrationConditionsListCreateView.as_view(), name="reg-conditions-list"),
    path("registration-conditions/<int:pk>/",  AdminRegistrationConditionDetailView.as_view(), name="reg-conditions-detail"),
]

