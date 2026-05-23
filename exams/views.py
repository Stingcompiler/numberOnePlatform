"""
================================================================================
exams/views.py
================================================================================
Views لإدارة الاختبارات — CRUD + مراجعة المحاولات

الصلاحيات:
  - الإنشاء/التعديل/الحذف: مدير النظام أو المدير أو الأستاذ
  - مراجعة المحاولات: مدير النظام أو المدير أو الأستاذ
  - الأستاذ يرى فقط اختبارات كورساته
================================================================================
"""

from django.utils.translation import gettext_lazy as _
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminOrManager
from .models import Exam, ExamAttempt
from .serializers import (
    ExamListSerializer,
    ExamDetailSerializer,
    ExamBatchCreateSerializer,
    ExamBatchUpdateSerializer,
    ExamAttemptListSerializer,
    ExamAttemptDetailSerializer,
)


# ─────────────────────────────────────────────────────────────────────────────
# صلاحية مخصصة: Admin / Manager / Teacher
# ─────────────────────────────────────────────────────────────────────────────

class IsAdminOrManagerOrTeacher(IsAuthenticated):
    """السماح للمدير أو مدير النظام أو الأستاذ."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.role in ("admin", "manager", "teacher")


# ─────────────────────────────────────────────────────────────────────────────
# مساعدات — تصفية حسب الدور
# ─────────────────────────────────────────────────────────────────────────────

def get_exam_queryset(user, base_qs=None):
    """
    إذا كان المستخدم أستاذاً، يُعيد فقط اختبارات كورساته.
    المديرون يرون كل شيء.
    """
    qs = base_qs if base_qs is not None else Exam.objects.all()
    if user.role == "teacher":
        qs = qs.filter(course__teacher=user)
    return qs


# ─────────────────────────────────────────────────────────────────────────────
# 1. قائمة الاختبارات
# ─────────────────────────────────────────────────────────────────────────────

class ExamListView(generics.ListAPIView):
    """
    GET /api/exams/?course=<id>
    قائمة الاختبارات مع إمكانية التصفية حسب الكورس.
    """

    serializer_class = ExamListSerializer
    permission_classes = [IsAdminOrManagerOrTeacher]

    def get_queryset(self):
        qs = get_exam_queryset(
            self.request.user,
            Exam.objects.select_related("course", "created_by")
            .prefetch_related("questions", "attempts")
        )
        course_id = self.request.query_params.get("course")
        if course_id:
            qs = qs.filter(course_id=course_id)
        return qs.order_by("-created_at")


# ─────────────────────────────────────────────────────────────────────────────
# 2. إنشاء اختبار (دفعي)
# ─────────────────────────────────────────────────────────────────────────────

class ExamCreateView(APIView):
    """
    POST /api/exams/
    إنشاء اختبار كامل مع جميع الأسئلة والخيارات والإجابات دفعة واحدة.
    """

    permission_classes = [IsAdminOrManagerOrTeacher]

    def post(self, request):
        serializer = ExamBatchCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        exam = serializer.save()
        return Response(
            ExamDetailSerializer(exam).data,
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────────────────────
# 3. تفاصيل الاختبار
# ─────────────────────────────────────────────────────────────────────────────

class ExamDetailView(APIView):
    """
    GET    /api/exams/<id>/     — تفاصيل الاختبار الكاملة
    PUT    /api/exams/<id>/     — تحديث الاختبار (دفعي)
    DELETE /api/exams/<id>/     — حذف الاختبار
    """

    permission_classes = [IsAdminOrManagerOrTeacher]

    def get_object(self, pk, user):
        qs = get_exam_queryset(
            user,
            Exam.objects.select_related("course", "created_by")
            .prefetch_related("questions__options")
        )
        try:
            return qs.get(pk=pk)
        except Exam.DoesNotExist:
            return None

    def get(self, request, pk):
        exam = self.get_object(pk, request.user)
        if not exam:
            return Response(
                {"detail": _("الاختبار غير موجود.")},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(ExamDetailSerializer(exam).data)

    def put(self, request, pk):
        exam = self.get_object(pk, request.user)
        if not exam:
            return Response(
                {"detail": _("الاختبار غير موجود.")},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = ExamBatchUpdateSerializer(
            instance=exam, data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        updated_exam = serializer.save()
        # إعادة تحميل البيانات المحدثة
        updated_exam.refresh_from_db()
        return Response(
            ExamDetailSerializer(
                Exam.objects.select_related("course", "created_by")
                .prefetch_related("questions__options")
                .get(pk=updated_exam.pk)
            ).data
        )

    def delete(self, request, pk):
        exam = self.get_object(pk, request.user)
        if not exam:
            return Response(
                {"detail": _("الاختبار غير موجود.")},
                status=status.HTTP_404_NOT_FOUND,
            )
        # فقط Admin / Manager يمكنهم الحذف
        if request.user.role not in ("admin", "manager"):
            return Response(
                {"detail": _("ليس لديك صلاحية حذف الاختبارات.")},
                status=status.HTTP_403_FORBIDDEN,
            )
        exam.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# 4. محاولات الطلاب لاختبار محدد
# ─────────────────────────────────────────────────────────────────────────────

class ExamSubmissionsView(generics.ListAPIView):
    """
    GET /api/exams/<exam_id>/submissions/
    قائمة جميع محاولات الطلاب لاختبار محدد.
    """

    serializer_class = ExamAttemptListSerializer
    permission_classes = [IsAdminOrManagerOrTeacher]

    def get_queryset(self):
        exam_id = self.kwargs["exam_id"]
        qs = ExamAttempt.objects.filter(
            exam_id=exam_id
        ).select_related(
            "student__user", "exam"
        ).order_by("-submitted_at")

        # تصفية حسب الدور
        user = self.request.user
        if user.role == "teacher":
            qs = qs.filter(exam__course__teacher=user)

        return qs


# ─────────────────────────────────────────────────────────────────────────────
# 5. تفاصيل محاولة طالب
# ─────────────────────────────────────────────────────────────────────────────

class AttemptDetailView(APIView):
    """
    GET /api/exams/attempts/<id>/
    ورقة الإجابة الكاملة لمحاولة طالب محدد.
    """

    permission_classes = [IsAdminOrManagerOrTeacher]

    def get(self, request, pk):
        try:
            attempt = ExamAttempt.objects.select_related(
                "student__user", "exam"
            ).prefetch_related(
                "answers__question__options"
            ).get(pk=pk)
        except ExamAttempt.DoesNotExist:
            return Response(
                {"detail": _("المحاولة غير موجودة.")},
                status=status.HTTP_404_NOT_FOUND,
            )

        # تصفية حسب الدور
        if (
            request.user.role == "teacher"
            and attempt.exam.course.teacher != request.user
        ):
            return Response(
                {"detail": _("ليس لديك صلاحية عرض هذه المحاولة.")},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(ExamAttemptDetailSerializer(attempt).data)
