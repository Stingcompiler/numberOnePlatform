"""
================================================================================
finance/urls.py
================================================================================
"""

from django.urls import path
from .views import (
    ExchangeRateListCreateView, ExchangeRateDetailView, CurrentExchangeRateView,
    FinancialFileListView, FinancialFileDetailView, StudentFinancialFileView,
    PaymentListView, PaymentCreateView, PaymentDetailView,
    DailyReportView, MonthlyReportView, AnnualReportView, OverallSummaryReportView,
)

urlpatterns = [
    # ── سعر الصرف ─────────────────────────────────────────────────────────────
    path("exchange-rates/",                ExchangeRateListCreateView.as_view(), name="exchange-rate-list"),
    path("exchange-rates/current/",        CurrentExchangeRateView.as_view(),    name="exchange-rate-current"),
    path("exchange-rates/<int:pk>/",       ExchangeRateDetailView.as_view(),     name="exchange-rate-detail"),

    # ── الملفات المالية ───────────────────────────────────────────────────────
    path("files/",                         FinancialFileListView.as_view(),      name="financial-file-list"),
    path("files/<int:pk>/",                FinancialFileDetailView.as_view(),    name="financial-file-detail"),
    path("student/<int:student_id>/file/", StudentFinancialFileView.as_view(),   name="student-financial-file"),

    # ── الدفعات ───────────────────────────────────────────────────────────────
    path("payments/",                               PaymentListView.as_view(),   name="payment-list"),
    path("payments/<int:pk>/",                      PaymentDetailView.as_view(), name="payment-detail"),
    path("student/<int:student_id>/payments/",      PaymentCreateView.as_view(), name="payment-create"),

    # ── التقارير المالية ──────────────────────────────────────────────────────
    path("reports/daily/",                 DailyReportView.as_view(),            name="report-daily"),
    path("reports/monthly/",               MonthlyReportView.as_view(),          name="report-monthly"),
    path("reports/annual/",                AnnualReportView.as_view(),           name="report-annual"),
    path("reports/summary/",               OverallSummaryReportView.as_view(),   name="report-summary"),
]
