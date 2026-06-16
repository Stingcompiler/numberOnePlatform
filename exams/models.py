"""
================================================================================
exams/models.py
================================================================================
نموذج بيانات الاختبارات لنظام "مدارس ومعاهد نمبر ون"

الهيكل:
  Exam (اختبار) → ExamQuestion (سؤال) → ExamQuestionOption (خيار)
  Exam → ExamAttempt (محاولة طالب) → ExamAttemptAnswer (إجابة)

أنواع الأسئلة المدعومة:
  - true_false      : صح / خطأ
  - multiple_choice  : اختيار من متعدد
  - fill_blank       : أكمل الفراغ
  - matching         : مطابقة بين قائمتين (A ↔ B)
================================================================================
"""

import uuid

from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


# ─────────────────────────────────────────────────────────────────────────────
# 1. Exam – الاختبار
# ─────────────────────────────────────────────────────────────────────────────

class Exam(models.Model):
    """
    اختبار مرتبط بكورس محدد.
    يُنشئه الأستاذ أو المدير ويتضمن بنك أسئلة متنوع.
    """

    course = models.ForeignKey(
        "academic.Course",
        on_delete=models.CASCADE,
        related_name="exams",
        verbose_name=_("الكورس"),
    )
    title = models.CharField(_("عنوان الاختبار"), max_length=255)
    duration_minutes = models.PositiveIntegerField(
        _("مدة الاختبار (بالدقائق)"),
        default=60,
    )
    passing_score = models.FloatField(
        _("درجة النجاح"),
        default=50.0,
        help_text=_("الدرجة المطلوبة للنجاح من إجمالي درجات الاختبار."),
    )
    is_active = models.BooleanField(_("نشط"), default=True)
    created_by = models.ForeignKey(
        "accounts.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_exams",
        verbose_name=_("أُنشئ بواسطة"),
    )
    created_at = models.DateTimeField(_("تاريخ الإنشاء"), auto_now_add=True)
    updated_at = models.DateTimeField(_("آخر تحديث"), auto_now=True)

    class Meta:
        verbose_name = _("اختبار")
        verbose_name_plural = _("الاختبارات")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.course.name} — {self.title}"

    @property
    def total_marks(self):
        """مجموع درجات جميع أسئلة الاختبار."""
        return self.questions.aggregate(
            total=models.Sum("marks")
        )["total"] or 0

    @property
    def question_count(self):
        """عدد أسئلة الاختبار."""
        return self.questions.count()


# ─────────────────────────────────────────────────────────────────────────────
# 2. ExamQuestion – سؤال في الاختبار
# ─────────────────────────────────────────────────────────────────────────────

class ExamQuestion(models.Model):
    """
    سؤال داخل الاختبار. يدعم أربعة أنواع مختلفة.

    correct_answer (JSONField) — تخزين الإجابة الصحيحة حسب النوع:
      - true_false:       {"value": true}
      - multiple_choice:  {"option_id": 5}  ← يُحدَّث بعد حفظ الخيارات
      - fill_blank:       {"text": "الإجابة"}
      - matching:         {"pairs": [{"a": "...", "b": "..."}, ...]}
    """

    class QuestionType(models.TextChoices):
        TRUE_FALSE      = "true_false",      _("صح / خطأ")
        MULTIPLE_CHOICE = "multiple_choice",  _("اختيار من متعدد")
        FILL_BLANK      = "fill_blank",       _("أكمل الفراغ")
        MATCHING        = "matching",         _("مطابقة")

    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name="questions",
        verbose_name=_("الاختبار"),
    )
    question_type = models.CharField(
        _("نوع السؤال"),
        max_length=20,
        choices=QuestionType.choices,
        default=QuestionType.MULTIPLE_CHOICE,
    )
    title = models.CharField(
        _("عنوان السؤال"),
        max_length=255,
        blank=True,
        default="",
        help_text=_("عنوان وصفي مختصر لتمييز السؤال بسرعة (اختياري)."),
    )
    text = models.TextField(_("نص السؤال"))
    image = models.ImageField(
        _("صورة السؤال"),
        upload_to="exams/questions/",
        blank=True,
        null=True,
        help_text=_("صورة اختيارية مرفقة بالسؤال (للمطابقة وأكمل الفراغ)."),
    )
    marks = models.FloatField(_("الدرجة"), default=1.0)
    display_order = models.PositiveSmallIntegerField(_("ترتيب العرض"), default=0)
    correct_answer = models.JSONField(
        _("الإجابة الصحيحة"),
        default=dict,
        help_text=_("تُخزَّن بصيغة JSON حسب نوع السؤال."),
    )

    class Meta:
        verbose_name = _("سؤال اختبار")
        verbose_name_plural = _("أسئلة الاختبارات")
        ordering = ["exam", "display_order"]

    def __str__(self):
        return f"[{self.get_question_type_display()}] {self.text[:60]}"


# ─────────────────────────────────────────────────────────────────────────────
# 3. ExamQuestionOption – خيار لسؤال اختيار من متعدد
# ─────────────────────────────────────────────────────────────────────────────

class ExamQuestionOption(models.Model):
    """
    خيار مرتبط بسؤال من نوع multiple_choice.
    يُستخدم أيضاً لعناصر المطابقة (list_a / list_b) حسب الحاجة.
    """

    question = models.ForeignKey(
        ExamQuestion,
        on_delete=models.CASCADE,
        related_name="options",
        verbose_name=_("السؤال"),
    )
    text = models.CharField(_("نص الخيار"), max_length=500)
    display_order = models.PositiveSmallIntegerField(_("ترتيب العرض"), default=0)

    class Meta:
        verbose_name = _("خيار سؤال")
        verbose_name_plural = _("خيارات الأسئلة")
        ordering = ["question", "display_order"]

    def __str__(self):
        return f"{self.text[:80]}"


# ─────────────────────────────────────────────────────────────────────────────
# 4. ExamAttempt – محاولة طالب للاختبار
# ─────────────────────────────────────────────────────────────────────────────

class ExamAttempt(models.Model):
    """
    سجل محاولة طالب لاختبار محدد.
    يحفظ الدرجة النهائية والنسبة المئوية وحالة النجاح.
    """

    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name="attempts",
        verbose_name=_("الاختبار"),
    )
    student = models.ForeignKey(
        "accounts.StudentProfile",
        on_delete=models.CASCADE,
        related_name="exam_attempts",
        verbose_name=_("الطالب"),
    )
    score = models.FloatField(_("الدرجة المحققة"), default=0)
    percentage = models.FloatField(_("النسبة المئوية"), default=0)
    is_passed = models.BooleanField(_("ناجح"), default=False)
    started_at = models.DateTimeField(_("وقت البدء"), null=True, blank=True)
    submitted_at = models.DateTimeField(_("وقت التسليم"), default=timezone.now)

    class Meta:
        verbose_name = _("محاولة اختبار")
        verbose_name_plural = _("محاولات الاختبارات")
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"{self.student} — {self.exam.title} ({self.percentage:.1f}%)"


# ─────────────────────────────────────────────────────────────────────────────
# 5. ExamAttemptAnswer – إجابة الطالب على سؤال
# ─────────────────────────────────────────────────────────────────────────────

class ExamAttemptAnswer(models.Model):
    """
    إجابة مفردة: تربط المحاولة بسؤال معين وإجابة الطالب.

    student_answer (JSONField) — بنفس صيغة correct_answer:
      - true_false:       {"value": false}
      - multiple_choice:  {"option_id": 3}
      - fill_blank:       {"text": "إجابة الطالب"}
      - matching:         {"pairs": [{"a": "...", "b": "..."}, ...]}
    """

    attempt = models.ForeignKey(
        ExamAttempt,
        on_delete=models.CASCADE,
        related_name="answers",
        verbose_name=_("المحاولة"),
    )
    question = models.ForeignKey(
        ExamQuestion,
        on_delete=models.CASCADE,
        related_name="attempt_answers",
        verbose_name=_("السؤال"),
    )
    student_answer = models.JSONField(
        _("إجابة الطالب"),
        default=dict,
    )
    is_correct = models.BooleanField(_("صحيحة"), default=False)
    earned_marks = models.FloatField(_("الدرجة المكتسبة"), default=0)

    class Meta:
        verbose_name = _("إجابة محاولة")
        verbose_name_plural = _("إجابات المحاولات")
        unique_together = [["attempt", "question"]]

    def __str__(self):
        mark = "✓" if self.is_correct else "✗"
        return f"{mark} {self.question.text[:40]}"
