"""
================================================================================
site_settings/views.py
================================================================================
"""

from django.utils.translation import gettext_lazy as _
from rest_framework import generics, status
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminOrManager
from .models import SiteSettings, Announcement, ContactTool, ContactMessage, StaffCard
from .serializers import (
    SiteSettingsSerializer, SiteSettingsPublicSerializer,
    AnnouncementSerializer,
    ContactToolSerializer,
    ContactMessageSerializer, ContactMessageAdminSerializer,
    StaffCardSerializer,
)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Public Endpoints
# ─────────────────────────────────────────────────────────────────────────────

class PublicSiteDataView(APIView):
    """
    GET /api/public/site-data/
    كل بيانات صفحة الهبوط في استدعاء واحد.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        settings_obj  = SiteSettings.get_settings()
        announcements = Announcement.objects.filter(is_active=True).order_by("display_order")
        tools         = ContactTool.objects.filter(is_active=True).order_by("display_order")
        staff         = StaffCard.objects.filter(is_active=True).order_by("card_type", "display_order")

        return Response({
            "settings":      SiteSettingsPublicSerializer(settings_obj, context={"request": request}).data,
            "announcements": AnnouncementSerializer(announcements, many=True, context={"request": request}).data,
            "contact_tools": ContactToolSerializer(tools, many=True).data,
            "staff":         StaffCardSerializer(staff, many=True, context={"request": request}).data,
        })


class ContactFormView(APIView):
    """POST /api/public/contact/ — نموذج المراسلة بدون مصادقة"""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ContactMessageSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": _("تم إرسال رسالتك بنجاح. سنتواصل معك قريباً.")},
            status=status.HTTP_201_CREATED,
        )


class PublicAnnouncementsView(generics.ListAPIView):
    """GET /api/public/announcements/"""

    permission_classes = [AllowAny]
    serializer_class   = AnnouncementSerializer

    def get_queryset(self):
        return Announcement.objects.filter(is_active=True).order_by("display_order")


class PublicStaffView(generics.ListAPIView):
    """GET /api/public/staff/?type=academic|administrative"""

    permission_classes = [AllowAny]
    serializer_class   = StaffCardSerializer

    def get_queryset(self):
        qs = StaffCard.objects.filter(is_active=True)
        card_type = self.request.query_params.get("type")
        if card_type:
            qs = qs.filter(card_type=card_type)
        return qs.order_by("card_type", "display_order")


# ─────────────────────────────────────────────────────────────────────────────
# 2. Admin — إعدادات الموقع (Singleton)
# ─────────────────────────────────────────────────────────────────────────────

class SiteSettingsView(APIView):
    """GET / PATCH /api/admin/settings/"""

    permission_classes = [IsAdminOrManager]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        settings_obj = SiteSettings.get_settings()
        return Response(
            SiteSettingsSerializer(settings_obj, context={"request": request}).data
        )

    def patch(self, request):
        settings_obj = SiteSettings.get_settings()
        serializer   = SiteSettingsSerializer(
            settings_obj, data=request.data, partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Admin — الإعلانات
# ─────────────────────────────────────────────────────────────────────────────

class AnnouncementListCreateView(generics.ListCreateAPIView):
    """GET /api/admin/announcements/ | POST"""

    queryset           = Announcement.objects.order_by("display_order", "-created_at")
    serializer_class   = AnnouncementSerializer
    permission_classes = [IsAdminOrManager]


class AnnouncementDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/admin/announcements/<id>/"""

    queryset           = Announcement.objects.all()
    serializer_class   = AnnouncementSerializer
    permission_classes = [IsAdminOrManager]

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class AnnouncementToggleView(APIView):
    """POST /api/admin/announcements/<id>/toggle/"""

    permission_classes = [IsAdminOrManager]

    def post(self, request, pk):
        try:
            ann = Announcement.objects.get(pk=pk)
        except Announcement.DoesNotExist:
            return Response(
                {"detail": _("الإعلان غير موجود.")},
                status=status.HTTP_404_NOT_FOUND,
            )
        ann.is_active = not ann.is_active
        ann.save(update_fields=["is_active"])
        label = _("مفعَّل") if ann.is_active else _("موقوف")
        return Response({"detail": f"الإعلان الآن {label}.", "is_active": ann.is_active})


# ─────────────────────────────────────────────────────────────────────────────
# 4. Admin — أدوات التواصل
# ─────────────────────────────────────────────────────────────────────────────

class ContactToolListCreateView(generics.ListCreateAPIView):
    """GET /api/admin/contact-tools/ | POST"""

    queryset           = ContactTool.objects.order_by("display_order")
    serializer_class   = ContactToolSerializer
    permission_classes = [IsAdminOrManager]


class ContactToolDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/admin/contact-tools/<id>/"""

    queryset           = ContactTool.objects.all()
    serializer_class   = ContactToolSerializer
    permission_classes = [IsAdminOrManager]

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# 5. Admin — صندوق الوارد (Inbox)
# ─────────────────────────────────────────────────────────────────────────────

class InboxListView(generics.ListAPIView):
    """GET /api/admin/inbox/?status=unread|seen|contacted|pending"""

    serializer_class   = ContactMessageAdminSerializer
    permission_classes = [IsAdminOrManager]

    def get_queryset(self):
        qs          = ContactMessage.objects.order_by("-received_at")
        msg_status  = self.request.query_params.get("status")
        if msg_status:
            qs = qs.filter(status=msg_status)
        return qs


class InboxDetailView(generics.RetrieveAPIView):
    """GET /api/admin/inbox/<id>/ — يُغيّر الحالة لـ seen تلقائياً"""

    queryset           = ContactMessage.objects.all()
    serializer_class   = ContactMessageAdminSerializer
    permission_classes = [IsAdminOrManager]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status == ContactMessage.Status.UNREAD:
            instance.status     = ContactMessage.Status.SEEN
            instance.handled_by = request.user
            instance.save(update_fields=["status", "handled_by", "updated_at"])
        return Response(self.get_serializer(instance).data)


class InboxUpdateStatusView(APIView):
    """PATCH /api/admin/inbox/<id>/status/"""

    permission_classes = [IsAdminOrManager]
    ALLOWED = [
        ContactMessage.Status.SEEN,
        ContactMessage.Status.CONTACTED,
        ContactMessage.Status.PENDING,
    ]

    def patch(self, request, pk):
        try:
            msg = ContactMessage.objects.get(pk=pk)
        except ContactMessage.DoesNotExist:
            return Response(
                {"detail": _("الرسالة غير موجودة.")},
                status=status.HTTP_404_NOT_FOUND,
            )
        new_status = request.data.get("status")
        if new_status not in self.ALLOWED:
            return Response(
                {"detail": _("الحالة غير صالحة."), "allowed": self.ALLOWED},
                status=status.HTTP_400_BAD_REQUEST,
            )
        msg.status     = new_status
        msg.handled_by = request.user
        msg.save(update_fields=["status", "handled_by", "updated_at"])
        return Response(ContactMessageAdminSerializer(msg).data)


# ─────────────────────────────────────────────────────────────────────────────
# 6. Admin — الكادر
# ─────────────────────────────────────────────────────────────────────────────

class StaffCardListCreateView(generics.ListCreateAPIView):
    """GET /api/admin/staff/ | POST"""

    queryset           = StaffCard.objects.order_by("card_type", "display_order")
    serializer_class   = StaffCardSerializer
    permission_classes = [IsAdminOrManager]


class StaffCardDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/admin/staff/<id>/"""

    queryset           = StaffCard.objects.all()
    serializer_class   = StaffCardSerializer
    permission_classes = [IsAdminOrManager]

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)
