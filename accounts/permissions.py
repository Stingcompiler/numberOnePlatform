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


class IsStudentReadOnly(BasePermission):
    """
    الطلاب: قراءة فقط — يُرفض أي طلب تعديل أو حذف أو إنشاء.
    المديرون والمشرفون: صلاحيات كاملة.
    يُستخدم لحماية نقاط نهاية الحسابات من تعديلات الطلاب.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role == CustomUser.Roles.STUDENT:
            # الطلاب: قراءة فقط
            return request.method in SAFE_METHODS
        return True


# ─────────────────────────────────────────────────────────────────────────────
# صلاحيات مشرف المحاضرات
# ─────────────────────────────────────────────────────────────────────────────

class IsLectureSupervisor(BasePermission):
    """مشرف الكورسات فحسب."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == CustomUser.Roles.LECTURE_SUPERVISOR
        )


class IsAdminManagerOrLectureSupervisor(BasePermission):
    """
    المدير أو مدير النظام أو مشرف الكورسات.
    يُستخدَم لنقاط نهاية المحاضرات (قراءة وكتابة).
    """

    ALLOWED_ROLES = (
        CustomUser.Roles.ADMIN,
        CustomUser.Roles.MANAGER,
        CustomUser.Roles.LECTURE_SUPERVISOR,
    )

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in self.ALLOWED_ROLES
        )


class LectureWritePermission(BasePermission):
    """
    صلاحية الكتابة على المحاضرات:
    - القراءة (GET/HEAD/OPTIONS): مدير، أستاذ، مشرف الكورسات
    - الإنشاء/التعديل (POST/PATCH/PUT): مدير + مشرف الكورسات
    - الحذف (DELETE): مدير فقط (admin/manager)
    """

    WRITE_ROLES = (
        CustomUser.Roles.ADMIN,
        CustomUser.Roles.MANAGER,
        CustomUser.Roles.LECTURE_SUPERVISOR,
    )

    DELETE_ROLES = (
        CustomUser.Roles.ADMIN,
        CustomUser.Roles.MANAGER,
    )

    READ_ROLES = (
        CustomUser.Roles.ADMIN,
        CustomUser.Roles.MANAGER,
        CustomUser.Roles.TEACHER,
        CustomUser.Roles.LECTURE_SUPERVISOR,
    )

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return request.user.role in self.READ_ROLES
        if request.method == "DELETE":
            return request.user.role in self.DELETE_ROLES
        # POST / PUT / PATCH
        return request.user.role in self.WRITE_ROLES
