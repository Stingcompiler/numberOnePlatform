"""
================================================================================
live/permissions.py
================================================================================
Permissions مخصصة لنظام البث المباشر
================================================================================
"""

from rest_framework.permissions import BasePermission


class IsAdminOrManager(BasePermission):
    """
    يسمح فقط للمستخدمين من نوع admin أو manager.
    يمنع الطلاب والمعلمين من الوصول إلى APIs الإدارة.
    """
    message = "ليس لديك صلاحية للوصول إلى هذا المورد."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ("admin", "manager")
        )


class IsStudent(BasePermission):
    """
    يسمح فقط للطلاب بالوصول.
    """
    message = "هذه الواجهة مخصصة للطلاب فقط."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "student"
        )
