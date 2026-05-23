"""
================================================================================
finance/views.py
================================================================================
Views المالية الكاملة:
  - ExchangeRate CRUD
  - FinancialFile (عرض وتعديل المطلوب)
  - Payment CRUD (إضافة دفعة على ملف طالب محدد)
  - التقارير المالية: يومي / شهري / سنوي (Aggregation عبر Django ORM)
================================================================================
"""

from decimal import Decimal
from django.db.models import Sum, Count, F
from django.db.models.functions import TruncMonth, TruncYear
from django.utils.translation import gettext_lazy as _
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin, IsAdminOrManager
from .models import ExchangeRate, FinancialFile, Payment
from .serializers import (
    ExchangeRateSerializer,
    FinancialFileSerializer,
    FinancialFileUpdateSerializer,
    PaymentSerializer,
    PaymentCreateSerializer,
)


# ─────────────────────────────────────────────────────────────────────────────
# 1. ExchangeRate — سعر الصرف
# ─────────────────────────────────────────────────────────────────────────────

class ExchangeRateListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/finance/exchange-rates/
    POST /api/finance/exchange-rates/  — إضافة سعر جديد (يُلغي السابق تلقائياً)
    """

    queryset           = ExchangeRate.objects.order_by("-created_at")
    serializer_class   = ExchangeRateSerializer
    permission_classes = [IsAdminOrManager]


class ExchangeRateDetailView(generics.RetrieveUpdateAPIView):
    """GET / PATCH /api/finance/exchange-rates/<id>/"""

    queryset           = ExchangeRate.objects.all()
    serializer_class   = ExchangeRateSerializer
    permission_classes = [IsAdminOrManager]

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class CurrentExchangeRateView(APIView):
    """GET /api/finance/exchange-rates/current/"""

    permission_classes = [IsAdminOrManager]

    def get(self, request):
        # أولاً: السعر المُفعَّل صراحةً
        rate = ExchangeRate.objects.filter(is_active=True).first()
        if not rate:
            # ثانياً: إن لم يُوجَد سعر نشط، نعيد آخر سعر أُضيف
            rate = ExchangeRate.objects.order_by("-created_at").first()
        if not rate:
            return Response(
                {"detail": _("لا يوجد سعر صرف مُسجَّل بعد.")},
                status=status.HTTP_404_NOT_FOUND,
            )
        data = ExchangeRateSerializer(rate).data
        return Response(data)


# ─────────────────────────────────────────────────────────────────────────────
# 2. FinancialFile — الملف المالي
# ─────────────────────────────────────────────────────────────────────────────

class FinancialFileListView(generics.ListAPIView):
    """GET /api/finance/files/"""

    serializer_class   = FinancialFileSerializer
    permission_classes = [IsAdminOrManager]

    def get_queryset(self):
        qs = FinancialFile.objects.select_related(
            "student__user"
        ).prefetch_related("payments")
        student_id = self.request.query_params.get("student")
        if student_id:
            qs = qs.filter(student_id=student_id)
            
        search_query = self.request.query_params.get("search")
        if search_query:
            from django.db.models import Q
            qs = qs.filter(
                Q(student__user__full_name__icontains=search_query) |
                Q(payments__transaction_id__icontains=search_query) |
                Q(payments__receipt_number__icontains=search_query)
            ).distinct()
            
        return qs.order_by("-updated_at")


class FinancialFileDetailView(generics.RetrieveUpdateAPIView):
    """GET / PATCH /api/finance/files/<id>/"""

    queryset = FinancialFile.objects.select_related(
        "student__user"
    ).prefetch_related("payments")
    permission_classes = [IsAdminOrManager]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return FinancialFileUpdateSerializer
        return FinancialFileSerializer

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class StudentFinancialFileView(APIView):
    """GET / PATCH /api/finance/student/<student_id>/file/"""

    permission_classes = [IsAdminOrManager]

    def get(self, request, student_id):
        file, created = FinancialFile.objects.get_or_create(student_id=student_id)
        # إعادة الجلب مع العلاقات إذا أردنا
        file = FinancialFile.objects.select_related(
            "student__user"
        ).prefetch_related("payments").get(id=file.id)
        return Response(FinancialFileSerializer(file).data)

    def patch(self, request, student_id):
        file, created = FinancialFile.objects.get_or_create(student_id=student_id)
        serializer = FinancialFileUpdateSerializer(file, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        # إعادة الجلب مع العلاقات
        file = FinancialFile.objects.select_related(
            "student__user"
        ).prefetch_related("payments").get(id=file.id)
        return Response(FinancialFileSerializer(file).data)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Payment — الدفعات
# ─────────────────────────────────────────────────────────────────────────────

class PaymentListView(generics.ListAPIView):
    """GET /api/finance/payments/ — مع فلترة متقدمة"""

    serializer_class   = PaymentSerializer
    permission_classes = [IsAdminOrManager]

    def get_queryset(self):
        qs = Payment.objects.select_related(
            "financial_file__student__user", "recorded_by"
        )
        params = self.request.query_params
        if params.get("student"):
            qs = qs.filter(financial_file__student_id=params["student"])
        if params.get("from"):
            qs = qs.filter(payment_date__gte=params["from"])
        if params.get("to"):
            qs = qs.filter(payment_date__lte=params["to"])
        if params.get("method"):
            qs = qs.filter(payment_method=params["method"])
        if params.get("search"):
            from django.db.models import Q
            s = params["search"]
            qs = qs.filter(
                Q(financial_file__student__user__full_name__icontains=s) |
                Q(transaction_id__icontains=s) |
                Q(sender_account_number__icontains=s) |
                Q(receipt_number__icontains=s)
            )
        return qs.order_by("-payment_date", "-created_at")


class PaymentCreateView(APIView):
    """
    POST /api/finance/student/<student_id>/payments/
    إضافة دفعة جديدة — الـ Signal يُحدِّث total_paid تلقائياً
    ويفتح كورسات الطالب الأونلاين عند أول دفع.
    """

    permission_classes = [IsAdminOrManager]

    def post(self, request, student_id):
        financial_file, created = FinancialFile.objects.get_or_create(student_id=student_id)

        serializer = PaymentCreateSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        # ── التحقق من عدم تجاوز المبلغ المتبقي ──────────────────────────────
        remaining_balance = financial_file.get_balance()
        amount_sdg = serializer.validated_data["amount_sdg"]
        if amount_sdg > remaining_balance:
            return Response(
                {
                    "amount_sdg": _(
                        f"المبلغ المدخَل ({amount_sdg} ج.س) يتجاوز المتبقي على الطالب "
                        f"({remaining_balance} ج.س). لا يمكن الدفع أكثر من المطلوب."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment = serializer.save(financial_file=financial_file)

        return Response(
            PaymentSerializer(payment).data,
            status=status.HTTP_201_CREATED,
        )


class PaymentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/finance/payments/<id>/
    PUT/PATCH /api/finance/payments/<id>/ — للمدير فقط
    DELETE /api/finance/payments/<id>/  — للمدير فقط
    """

    queryset           = Payment.objects.select_related("financial_file__student__user")
    serializer_class   = PaymentSerializer
    permission_classes = [IsAdmin]

    def perform_update(self, serializer):
        # We need to recalculate total_paid when a payment amount changes
        serializer.save()
        instance = serializer.instance
        instance.financial_file.recalculate_total_paid()

    def perform_destroy(self, instance):
        financial_file = instance.financial_file
        instance.delete()
        financial_file.recalculate_total_paid()


# ─────────────────────────────────────────────────────────────────────────────
# 4. التقارير المالية
# ─────────────────────────────────────────────────────────────────────────────

def _enrich_with_sar(qs_rows, date_filter_field, date_val_key):
    """
    دالة داخلية: تحسب إجمالي المدفوع بالريال السعودي لكل صف من صفوف التقرير
    باستخدام exchange_rate_at_payment المحفوظة لحظة كل دفع.
    """
    result = []
    for row in qs_rows:
        filter_kwargs = {date_filter_field: row[date_val_key]}
        day_payments = Payment.objects.filter(**filter_kwargs).values(
            "amount_sdg", "exchange_rate_at_payment"
        )
        total_sar = sum(
            float(p["amount_sdg"]) / float(p["exchange_rate_at_payment"])
            for p in day_payments
            if p["exchange_rate_at_payment"]
        )
        result.append({**row, "total_sar": round(total_sar, 2)})
    return result


class DailyReportView(APIView):
    """GET /api/finance/reports/daily/?from=YYYY-MM-DD&to=YYYY-MM-DD"""

    permission_classes = [IsAdminOrManager]

    def get(self, request):
        qs = Payment.objects.all()
        if request.query_params.get("from"):
            qs = qs.filter(payment_date__gte=request.query_params["from"])
        if request.query_params.get("to"):
            qs = qs.filter(payment_date__lte=request.query_params["to"])

        rows = (
            qs.values("payment_date")
            .annotate(total_sdg=Sum("amount_sdg"), count=Count("id"))
            .order_by("payment_date")
        )

        result = []
        for row in rows:
            day_payments = qs.filter(
                payment_date=row["payment_date"]
            ).values("amount_sdg", "exchange_rate_at_payment")
            total_sar = sum(
                float(p["amount_sdg"]) / float(p["exchange_rate_at_payment"])
                for p in day_payments if p["exchange_rate_at_payment"]
            )
            result.append({
                "date":      row["payment_date"].strftime("%Y-%m-%d"),
                "total_sdg": str(row["total_sdg"]),
                "total_sar": round(total_sar, 2),
                "count":     row["count"],
            })

        return Response({"report": "daily", "data": result})


class MonthlyReportView(APIView):
    """GET /api/finance/reports/monthly/?year=YYYY"""

    permission_classes = [IsAdminOrManager]

    def get(self, request):
        qs = Payment.objects.all()
        if request.query_params.get("year"):
            qs = qs.filter(payment_date__year=request.query_params["year"])

        rows = (
            qs.annotate(month=TruncMonth("payment_date"))
            .values("month")
            .annotate(total_sdg=Sum("amount_sdg"), count=Count("id"))
            .order_by("month")
        )

        result = []
        for row in rows:
            month_payments = Payment.objects.filter(
                payment_date__year=row["month"].year,
                payment_date__month=row["month"].month,
            ).values("amount_sdg", "exchange_rate_at_payment")
            total_sar = sum(
                float(p["amount_sdg"]) / float(p["exchange_rate_at_payment"])
                for p in month_payments if p["exchange_rate_at_payment"]
            )
            result.append({
                "month":     row["month"].strftime("%Y-%m"),
                "total_sdg": str(row["total_sdg"]),
                "total_sar": round(total_sar, 2),
                "count":     row["count"],
            })

        return Response({"report": "monthly", "data": result})


class AnnualReportView(APIView):
    """GET /api/finance/reports/annual/"""

    permission_classes = [IsAdminOrManager]

    def get(self, request):
        rows = (
            Payment.objects
            .annotate(year=TruncYear("payment_date"))
            .values("year")
            .annotate(total_sdg=Sum("amount_sdg"), count=Count("id"))
            .order_by("year")
        )

        result = []
        for row in rows:
            year_payments = Payment.objects.filter(
                payment_date__year=row["year"].year
            ).values("amount_sdg", "exchange_rate_at_payment")
            total_sar = sum(
                float(p["amount_sdg"]) / float(p["exchange_rate_at_payment"])
                for p in year_payments if p["exchange_rate_at_payment"]
            )
            result.append({
                "year":      row["year"].strftime("%Y"),
                "total_sdg": str(row["total_sdg"]),
                "total_sar": round(total_sar, 2),
                "count":     row["count"],
            })

        return Response({"report": "annual", "data": result})


class OverallSummaryReportView(APIView):
    """GET /api/finance/reports/summary/ — ملخص شامل للنظام كاملاً"""

    permission_classes = [IsAdminOrManager]

    def get(self, request):
        files = FinancialFile.objects.all()
        total_required = files.aggregate(t=Sum("total_required"))["t"] or Decimal("0")
        total_paid     = files.aggregate(t=Sum("total_paid"))["t"]     or Decimal("0")
        total_balance  = total_required - total_paid

        payments = Payment.objects.values("amount_sdg", "exchange_rate_at_payment")
        total_sar = sum(
            float(p["amount_sdg"]) / float(p["exchange_rate_at_payment"])
            for p in payments if p["exchange_rate_at_payment"]
        )

        return Response({
            "total_required_sdg": str(total_required),
            "total_paid_sdg":     str(total_paid),
            "total_balance_sdg":  str(total_balance),
            "total_paid_sar":     round(total_sar, 2),
            "students_count":     files.count(),
            "settled_count":      files.filter(
                total_paid__gte=F("total_required")
            ).count(),
        })
