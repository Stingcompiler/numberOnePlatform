"""
================================================================================
finance/serializers.py
================================================================================
"""

from decimal import Decimal
from rest_framework import serializers
from django.utils.translation import gettext_lazy as _

from .models import ExchangeRate, FinancialFile, Payment


# ─────────────────────────────────────────────────────────────────────────────
# 1. ExchangeRate
# ─────────────────────────────────────────────────────────────────────────────

class ExchangeRateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source="created_by.full_name", read_only=True, default=None
    )

    class Meta:
        model  = ExchangeRate
        fields = [
            "id", "rate", "is_active", "note",
            "created_at", "created_by", "created_by_name",
        ]
        read_only_fields = ["id", "created_at", "created_by_name"]

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Payment
# ─────────────────────────────────────────────────────────────────────────────

class PaymentSerializer(serializers.ModelSerializer):
    amount_sar         = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    payment_method_display = serializers.CharField(
        source="get_payment_method_display", read_only=True
    )
    recorded_by_name   = serializers.CharField(
        source="recorded_by.full_name", read_only=True, default=None
    )
    student_total_required = serializers.DecimalField(
        source="financial_file.total_required", max_digits=12, decimal_places=2, read_only=True
    )
    student_balance = serializers.SerializerMethodField(read_only=True)
    student_name = serializers.CharField(
        source="financial_file.student.user.full_name", read_only=True, default=None
    )

    def get_student_balance(self, obj):
        return str(obj.financial_file.get_balance())

    class Meta:
        model  = Payment
        fields = [
            "id", "financial_file", "amount_sdg", "amount_sar",
            "exchange_rate_at_payment",
            "payment_method", "payment_method_display",
            "bank_name", "sender_account_number", "transaction_id",
            "receipt_number", "payment_date", "notes",
            "recorded_by", "recorded_by_name", "created_at",
            "student_total_required", "student_balance", "student_name",
        ]
        read_only_fields = [
            "id", "amount_sar", "receipt_number",
            "exchange_rate_at_payment",   # يُعبَأ تلقائياً عند الحفظ
            "created_at", "recorded_by_name",
        ]

    def create(self, validated_data):
        # يسجّل مَن أضاف الدفعة تلقائياً
        validated_data["recorded_by"] = self.context["request"].user
        return super().create(validated_data)


class PaymentCreateSerializer(serializers.ModelSerializer):
    """
    نسخة مخففة لإنشاء دفعة — لا تتطلب financial_file إذا تم تمريره من الـ View.
    """

    class Meta:
        model  = Payment
        fields = [
            "amount_sdg", "payment_method", "payment_date",
            "bank_name", "sender_account_number", "transaction_id", "notes",
        ]
        extra_kwargs = {
            "bank_name": {"required": False, "allow_blank": True},
            "transaction_id": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        method = attrs.get('payment_method')
        if method == Payment.PaymentMethod.BANK_TRANSFER:
            if not attrs.get('bank_name'):
                raise serializers.ValidationError({"bank_name": _("اسم البنك مطلوب عند التحويل البنكي.")})
            if not attrs.get('sender_account_number'):
                raise serializers.ValidationError({"sender_account_number": _("رقم حساب المُرسل مطلوب عند التحويل البنكي.")})
            if not attrs.get('transaction_id'):
                raise serializers.ValidationError({"transaction_id": _("رقم المعاملة مطلوب عند التحويل البنكي.")})
        return attrs

    def create(self, validated_data):
        validated_data["recorded_by"] = self.context["request"].user
        return super().create(validated_data)


# ─────────────────────────────────────────────────────────────────────────────
# 3. FinancialFile
# ─────────────────────────────────────────────────────────────────────────────

class FinancialFileSerializer(serializers.ModelSerializer):
    payments    = PaymentSerializer(many=True, read_only=True)
    balance     = serializers.SerializerMethodField()
    summary     = serializers.SerializerMethodField()
    student_name = serializers.CharField(
        source="student.user.full_name", read_only=True
    )

    class Meta:
        model  = FinancialFile
        fields = [
            "id", "student", "student_name",
            "total_required", "total_paid",
            "balance", "summary", "notes",
            "created_at", "updated_at", "payments",
        ]
        read_only_fields = [
            "id", "total_paid", "balance", "summary",
            "student_name", "created_at", "updated_at",
        ]

    def get_balance(self, obj):
        return str(obj.get_balance())

    def get_summary(self, obj):
        s = obj.get_summary()
        return {
            "total_required_sdg": str(s["total_required_sdg"]),
            "total_paid_sdg":     str(s["total_paid_sdg"]),
            "balance_sdg":        str(s["balance_sdg"]),
            "total_paid_sar":     str(s["total_paid_sar"]),
            "is_settled":         s["is_settled"],
        }


class FinancialFileUpdateSerializer(serializers.ModelSerializer):
    """لتعديل الإجمالي المطلوب والملاحظات فقط."""

    class Meta:
        model  = FinancialFile
        fields = ["total_required", "notes"]
