"""
================================================================================
finance/models.py
================================================================================
النظام المالي الكامل لـ "مدارس ومعاهد نمبر ون"

يشمل:
  - FinancialFile  : الملف المالي لكل طالب (إجمالي المطلوب، المدفوع، المتبقي).
  - Payment        : كل عملية دفع مفردة (بالجنيه السوداني مع حفظ سعر الصرف اللحظي).
  - ExchangeRate   : جدول سعر الصرف الريال السعودي / الجنيه السوداني.

Signals المدمجة:
  - post_save على Payment → يُحدِّث FinancialFile.total_paid تلقائياً.
  - post_save على Payment → إذا كان الطالب "أونلاين" وهذا أول دفع،
    يُنشئ StudentCourseAccess لكل كورسات مرحلته.

Methods للتقارير:
  - FinancialFile.get_balance()   : المتبقي على الطالب.
  - FinancialFile.get_summary()   : ملخص مالي كامل.
  - الـ Aggregation يتم في الـ Views باستخدام Django ORM.
================================================================================
"""

from decimal import Decimal

from django.db import models
from django.db.models import Sum
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


# ─────────────────────────────────────────────────────────────────────────────
# 1. ExchangeRate – جدول أسعار صرف الريال السعودي / الجنيه السوداني
# ─────────────────────────────────────────────────────────────────────────────

class ExchangeRate(models.Model):
    """
    يحتفظ بسجل تاريخي لأسعار الصرف.

    السعر المُحدَّد هنا = كم جنيهاً سودانياً يساوي ريالاً سعودياً واحداً.
    يُستخدم السعر النشط (is_active=True) كقيمة افتراضية عند إضافة دفعة جديدة.
    """

    rate       = models.DecimalField(
        _("سعر الصرف (جنيه/ريال)"),
        max_digits=10,
        decimal_places=2,
        help_text=_("كم جنيهاً سودانياً يساوي الريال السعودي الواحد."),
    )
    is_active  = models.BooleanField(
        _("السعر الحالي"),
        default=False,
        help_text=_("يجب أن يكون سعر واحد فقط نشطاً في أي وقت."),
    )
    note       = models.CharField(_("ملاحظة"), max_length=255, blank=True)
    created_at = models.DateTimeField(_("تاريخ الإضافة"), auto_now_add=True)
    created_by = models.ForeignKey(
        "accounts.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("أضافه"),
    )

    class Meta:
        verbose_name        = _("سعر الصرف")
        verbose_name_plural = _("أسعار الصرف")
        ordering            = ["-created_at"]

    def __str__(self):
        active_label = " [نشط]" if self.is_active else ""
        return f"1 ريال = {self.rate} ج.س {active_label} ({self.created_at.date()})"

    def save(self, *args, **kwargs):
        """
        عند تفعيل سعر جديد، يُلغي تفعيل جميع الأسعار الأخرى تلقائياً
        لضمان وجود سعر نشط واحد فقط في جميع الأوقات.
        """
        if self.is_active:
            ExchangeRate.objects.exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)

    @classmethod
    def get_current_rate(cls):
        """
        يُعيد السعر النشط الحالي. يُستخدم كقيمة افتراضية عند إنشاء دفعة.
        """
        rate_obj = cls.objects.filter(is_active=True).first()
        if not rate_obj:
            rate_obj = cls.objects.order_by("-created_at").first()
            
        return rate_obj.rate if rate_obj else Decimal("0.00")


# ─────────────────────────────────────────────────────────────────────────────
# 2. FinancialFile – الملف المالي الكامل للطالب
# ─────────────────────────────────────────────────────────────────────────────

class FinancialFile(models.Model):
    """
    الملف المالي لكل طالب: يُتابع الإجمالي المطلوب والمدفوع والمتبقي.
    يُنشأ تلقائياً عبر Signal عند إنشاء StudentProfile.

    الحقول المالية:
      - total_required : إجمالي المبلغ المطلوب (بالجنيه السوداني).
      - total_paid     : إجمالي المدفوع (يُحدَّث تلقائياً عبر Signal).
    """

    student = models.OneToOneField(
        "accounts.StudentProfile",
        on_delete=models.CASCADE,
        related_name="financial_file",
        verbose_name=_("الطالب"),
    )
    total_required = models.DecimalField(
        _("إجمالي المطلوب (ج.س)"),
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    total_paid = models.DecimalField(
        _("إجمالي المدفوع (ج.س)"),
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text=_("يُحدَّث تلقائياً بواسطة Signal عند كل دفعة."),
    )
    notes    = models.TextField(_("ملاحظات مالية"), blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _("ملف مالي")
        verbose_name_plural = _("الملفات المالية")

    def __str__(self):
        return f"ملف {self.student.user.full_name} المالي"

    # ── Methods المالية ───────────────────────────────────────────────────────

    def get_balance(self) -> Decimal:
        """المبلغ المتبقي على الطالب."""
        return max(self.total_required - self.total_paid, Decimal("0.00"))

    def recalculate_total_paid(self):
        """
        يُعيد حساب total_paid من مجموع جميع الدفعات المسجّلة.
        يُستدعى من Signal post_save/post_delete على Payment.
        """
        result = self.payments.aggregate(total=Sum("amount_sdg"))
        self.total_paid = result["total"] or Decimal("0.00")
        self.save(update_fields=["total_paid", "updated_at"])

    def get_summary(self) -> dict:
        """
        ملخص مالي شامل بالجنيه السوداني وبالريال السعودي.
        يُستخدم في التقارير وطباعة إيصالات الحالة.
        """
        balance = self.get_balance()
        # نحسب مجموع المدفوع بالريال السعودي بناءً على سعر الصرف المحفوظ لحظة كل دفع
        paid_sar = sum(
            p.amount_sdg / p.exchange_rate_at_payment
            for p in self.payments.all()
            if p.exchange_rate_at_payment > 0
        )
        return {
            "total_required_sdg": self.total_required,
            "total_paid_sdg":     self.total_paid,
            "balance_sdg":        balance,
            "total_paid_sar":     round(paid_sar, 2),
            "is_settled":         balance == Decimal("0.00"),
        }


# ─────────────────────────────────────────────────────────────────────────────
# 3. Payment – سجل الدفعة المفردة
# ─────────────────────────────────────────────────────────────────────────────

class Payment(models.Model):
    """
    كل عملية دفع مفردة مسجّلة في النظام.

    *** الشرط الحاسم ***
    يُحفَظ حقل `exchange_rate_at_payment` (سعر الصرف لحظة الدفع) كقيمة
    ثابتة لا تتغير حتى لو تغيّر السعر لاحقاً. هذا يضمن صحة التقارير
    التاريخية عند احتساب القيمة بالريال السعودي.
    """

    class PaymentMethod(models.TextChoices):
        CASH          = "cash",          _("نقداً")
        BANK_TRANSFER = "bank_transfer", _("تحويل بنكي")

    # ── الربط بالملف المالي ───────────────────────────────────────────────────
    financial_file  = models.ForeignKey(
        FinancialFile,
        on_delete=models.CASCADE,
        related_name="payments",
        verbose_name=_("الملف المالي"),
    )

    # ── بيانات الدفعة ────────────────────────────────────────────────────────
    amount_sdg = models.DecimalField(
        _("المبلغ (جنيه سوداني)"),
        max_digits=12,
        decimal_places=2,
    )

    # *** الحقل الحاسم: سعر الصرف لحظة الدفع ***
    exchange_rate_at_payment = models.DecimalField(
        _("سعر الصرف لحظة الدفع (ج.س/ريال)"),
        max_digits=10,
        decimal_places=2,
        help_text=_(
            "يُحفَظ تلقائياً من السعر النشط وقت الدفع. "
            "لا يجوز تعديله لضمان سلامة التقارير التاريخية."
        ),
    )

    payment_method  = models.CharField(
        _("طريقة الدفع"),
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CASH,
    )
    bank_name       = models.CharField(_("اسم البنك"), max_length=100, blank=True)
    sender_account_number = models.CharField(_("رقم حساب المُرسل"), max_length=100, blank=True)
    transaction_id  = models.CharField(_("رقم المعاملة/التحويل"), max_length=150, blank=True)
    receipt_number  = models.CharField(
        _("رقم الإيصال"),
        max_length=50,
        blank=True,
        help_text=_("رقم تسلسلي للإيصال يُولَّد تلقائياً إن تُرِك فارغاً."),
    )
    payment_date    = models.DateField(
        _("تاريخ الدفع"),
        default=timezone.now,
    )
    notes           = models.TextField(_("ملاحظات"), blank=True)
    recorded_by     = models.ForeignKey(
        "accounts.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recorded_payments",
        verbose_name=_("سجّله"),
    )
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name        = _("دفعة")
        verbose_name_plural = _("الدفعات")
        ordering            = ["-payment_date", "-created_at"]

    def __str__(self):
        return (
            f"دفعة {self.amount_sdg} ج.س "
            f"— {self.financial_file.student.user.full_name} "
            f"({self.payment_date})"
        )

    @property
    def amount_sar(self) -> Decimal:
        """
        قيمة الدفعة بالريال السعودي محسوبةً بسعر الصرف المحفوظ لحظة الدفع.
        تظل ثابتة للأبد حتى لو تغيّر السعر لاحقاً.
        """
        if not self.exchange_rate_at_payment:
            return Decimal("0.00")
        return round(self.amount_sdg / self.exchange_rate_at_payment, 2)

    def save(self, *args, **kwargs):
        """
        عند الإنشاء:
        1. يملأ exchange_rate_at_payment بالسعر الحالي إن كان فارغاً.
        2. يولّد receipt_number تلقائياً إن كان فارغاً.
        """
        if not self.exchange_rate_at_payment:
            self.exchange_rate_at_payment = ExchangeRate.get_current_rate()
        if not self.receipt_number:
            # رقم إيصال: RCPT-<timestamp-milliseconds>
            ts = int(timezone.now().timestamp() * 1000)
            self.receipt_number = f"RCPT-{ts}"
        super().save(*args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Signals – تحديث الملف المالي وفتح الكورسات تلقائياً
# ─────────────────────────────────────────────────────────────────────────────

@receiver(post_save, sender="accounts.StudentProfile")
def create_financial_file_for_student(sender, instance, created, **kwargs):
    """
    Signal: عند إنشاء StudentProfile جديد،
    يُنشئ تلقائياً FinancialFile مرتبطاً به.
    """
    if created:
        FinancialFile.objects.get_or_create(student=instance)


@receiver(post_save, sender=Payment)
def update_financial_file_on_payment(sender, instance, created, **kwargs):
    """
    Signal: عند حفظ أي دفعة،
    يُحدِّث total_paid في FinancialFile المرتبط.

    إذا كان هذا أول دفع وكان الطالب نوعه "أونلاين"،
    يفتح جميع كورسات مرحلته تلقائياً (منطق الأعمال الرئيسي).
    """
    financial_file = instance.financial_file
    student_profile = financial_file.student

    # ── 1. تحديث المجموع ─────────────────────────────────────────────────────
    financial_file.recalculate_total_paid()

    # ── 2. فتح الكورسات للطالب الأونلاين عند أول دفع ──────────────────────
    if (
        created
        and student_profile.system_type == "online"
        and financial_file.payments.count() == 1  # هذه أول دفعة
    ):
        _grant_all_level_courses(student_profile)


def _grant_all_level_courses(student_profile):
    """
    دالة مساعدة: تفتح لطالب الأونلاين جميع كورسات مرحلته.
    تُستدعى من الـ Signal أعلاه.

    الافتراض: الطالب مسجّل في Grade معينة يمكن الوصول إليها
    عبر ملفه الأكاديمي أو الـ Grade المرتبطة بمرحلته.
    """
    # نستورد هنا داخل الدالة لتجنب الـ Circular Imports
    from academic.models import Course, StudentCourseAccess

    # نجد الـ Grade المرتبطة بالطالب (إن وُجدت)
    grade = getattr(student_profile, "enrolled_grade", None)
    if grade is None:
        return

    courses = Course.objects.filter(grade=grade, is_active=True, system_type="online")
    for course in courses:
        StudentCourseAccess.objects.get_or_create(
            student=student_profile,
            course=course,
            defaults={"granted_by": None},  # تلقائي عبر الدفع
        )
