"""
================================================================================
store/views.py
================================================================================
Views متجر التطبيقات.

الفصل يتبع نمط site_settings تماماً:
  · العام  — بلا مصادقة. المتجر يجب أن يعمل قبل أن يملك الزائر تطبيقاً
             يسجّل به الدخول أصلاً؛ اشتراط المصادقة يخلق حلقة مغلقة.
  · الإدارة — IsAdminOrManager، كبقية أقسام لوحة التحكم.

كل شيء هنا إضافي: لا view قائم يتغيّر.
================================================================================
"""

from django.db.models import Prefetch
from django.utils.translation import gettext_lazy as _
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminOrManager

from .models import App, AppPlatform, AppScreenshot
from .serializers import (
    AdminAppSerializer, AppPlatformSerializer, AppPublishSerializer,
    AppScreenshotSerializer, PublicAppDetailSerializer, PublicAppListSerializer,
)


def _with_relations(qs):
    return qs.prefetch_related("platforms", "screenshots")


# ─────────────────────────────────────────────────────────────────────────────
# 1. الواجهة العامة
# ─────────────────────────────────────────────────────────────────────────────

class PublicAppListView(generics.ListAPIView):
    """GET /api/public/store/apps/ — التطبيقات المنشورة."""

    permission_classes = [AllowAny]
    serializer_class   = PublicAppListSerializer
    pagination_class   = None

    def get_queryset(self):
        qs = _with_relations(App.objects.filter(is_published=True))

        platform = self.request.query_params.get("platform")
        if platform:
            qs = qs.filter(platforms__platform=platform).distinct()

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)

        return qs.order_by("display_order", "name")


class PublicAppDetailView(generics.RetrieveAPIView):
    """GET /api/public/store/apps/<id>/ — تفاصيل تطبيق منشور."""

    permission_classes = [AllowAny]
    serializer_class   = PublicAppDetailSerializer

    def get_queryset(self):
        return _with_relations(App.objects.filter(is_published=True))


# ─────────────────────────────────────────────────────────────────────────────
# 2. الإدارة — التطبيقات
# ─────────────────────────────────────────────────────────────────────────────

class AdminAppListCreateView(generics.ListCreateAPIView):
    """GET /api/admin/store/apps/ | POST"""

    permission_classes = [IsAdminOrManager]
    serializer_class   = AdminAppSerializer
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = _with_relations(App.objects.all())

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)

        platform = self.request.query_params.get("platform")
        if platform:
            qs = qs.filter(platforms__platform=platform).distinct()

        published = self.request.query_params.get("is_published")
        if published in ("true", "false"):
            qs = qs.filter(is_published=(published == "true"))

        return qs.order_by("display_order", "name")


class AdminAppDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/admin/store/apps/<id>/"""

    permission_classes = [IsAdminOrManager]
    serializer_class   = AdminAppSerializer
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    queryset           = _with_relations(App.objects.all())

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class AdminAppPublishView(APIView):
    """POST /api/admin/store/apps/<pk>/publish/ — نشر أو سحب."""

    permission_classes = [IsAdminOrManager]

    def post(self, request, pk):
        try:
            app = App.objects.prefetch_related("platforms").get(pk=pk)
        except App.DoesNotExist:
            return Response(
                {"detail": _("التطبيق غير موجود.")},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = AppPublishSerializer(
            data=request.data, context={"app": app}
        )
        serializer.is_valid(raise_exception=True)

        app.is_published = serializer.validated_data["is_published"]
        app.save(update_fields=["is_published", "updated_at"])

        return Response(AdminAppSerializer(app).data)


# ─────────────────────────────────────────────────────────────────────────────
# 3. الإدارة — المنصات
# ─────────────────────────────────────────────────────────────────────────────

class AdminPlatformListCreateView(generics.ListCreateAPIView):
    """GET /api/admin/store/apps/<app_id>/platforms/ | POST"""

    permission_classes = [IsAdminOrManager]
    serializer_class   = AppPlatformSerializer
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    pagination_class   = None

    def get_queryset(self):
        return AppPlatform.objects.filter(app_id=self.kwargs["app_id"])

    def get_serializer_context(self):
        # الـ serializer يحتاجه ليمنع تكرار المنصة قبل أن يصطدم القيد الفريد
        return {**super().get_serializer_context(), "app_id": self.kwargs["app_id"]}

    def perform_create(self, serializer):
        serializer.save(app_id=self.kwargs["app_id"])


class AdminPlatformDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/admin/store/platforms/<id>/"""

    permission_classes = [IsAdminOrManager]
    serializer_class   = AppPlatformSerializer
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    queryset           = AppPlatform.objects.select_related("app")

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# 4. الإدارة — لقطات الشاشة
# ─────────────────────────────────────────────────────────────────────────────

class AdminScreenshotListCreateView(generics.ListCreateAPIView):
    """GET /api/admin/store/apps/<app_id>/screenshots/ | POST"""

    permission_classes = [IsAdminOrManager]
    serializer_class   = AppScreenshotSerializer
    parser_classes     = [MultiPartParser, FormParser]
    pagination_class   = None

    def get_queryset(self):
        return AppScreenshot.objects.filter(app_id=self.kwargs["app_id"])

    def perform_create(self, serializer):
        serializer.save(app_id=self.kwargs["app_id"])


class AdminScreenshotDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/admin/store/screenshots/<id>/"""

    permission_classes = [IsAdminOrManager]
    serializer_class   = AppScreenshotSerializer
    parser_classes     = [MultiPartParser, FormParser]
    queryset           = AppScreenshot.objects.all()

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# 5. المنصات المتاحة — مرجع للواجهة
# ─────────────────────────────────────────────────────────────────────────────

class PlatformOptionsView(APIView):
    """
    GET /api/admin/store/platform-options/

    تقرأ الواجهة المنصات ومتطلباتها من هنا بدل تكرارها في JavaScript،
    فإضافة منصة جديدة في الباك إند تظهر في نموذج الإدارة تلقائياً.
    """

    permission_classes = [IsAdminOrManager]

    def get(self, request):
        from .models import PLATFORM_SPECS, MAX_PACKAGE_MB, MAX_IMAGE_MB

        return Response({
            "platforms": [
                {
                    "value": value,
                    "label": label,
                    "extensions": [
                        f".{e}" for e in PLATFORM_SPECS[value]["extensions"]
                    ],
                    "requires": PLATFORM_SPECS[value]["requires"],
                }
                for value, label in AppPlatform.Platform.choices
            ],
            "limits": {
                "package_mb": MAX_PACKAGE_MB,
                "image_mb":   MAX_IMAGE_MB,
            },
        })
