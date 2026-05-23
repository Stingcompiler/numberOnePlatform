"""
================================================================================
accounts/permissions.py
================================================================================
أصناف الصلاحيات المخصصة لنظام "مدارس ومعاهد نمبر ون"

القاعدة العامة: يُفحَص `request.user.role` مقارنةً بـ CustomUser.Roles.
================================================================================
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS
from accounts.models import CustomUser


class IsAdminOrManager(BasePermission):
    """السماح فقط للمدير أو مدير النظام."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in (CustomUser.Roles.ADMIN, CustomUser.Roles.MANAGER)
        )


class IsAdmin(BasePermission):
    """مدير النظام فحسب (superadmin)."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == CustomUser.Roles.ADMIN
        )


class IsTeacher(BasePermission):
    """الأستاذ فحسب."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == CustomUser.Roles.TEACHER
        )


class IsStudent(BasePermission):
    """الطالب فحسب."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == CustomUser.Roles.STUDENT
        )


class IsAdminOrReadOnly(BasePermission):
    """
    الإدارة: صلاحيات كاملة.
    الباقون: قراءة فقط (SAFE_METHODS: GET, HEAD, OPTIONS).
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in (CustomUser.Roles.ADMIN, CustomUser.Roles.MANAGER)
        )


class IsOwnerStudentOrAdmin(BasePermission):
    """
    الطالب يرى بياناته فقط.
    الإدارة ترى بيانات أي طالب.
    """

    def has_object_permission(self, request, view, obj):
        if request.user.role in (CustomUser.Roles.ADMIN, CustomUser.Roles.MANAGER):
            return True
        # obj قد يكون StudentProfile أو CustomUser
        if hasattr(obj, "user"):
            return obj.user == request.user
        return obj == request.user
