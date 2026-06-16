"""
================================================================================
academic/models.py
================================================================================
الهيكل الأكاديمي الكامل لنظام "مدارس ومعاهد نمبر ون"

التسلسل الهرمي:
  Level (مرحلة) → Grade (فصل/صف) → Course (كورس) → Unit (وحدة) → Lesson (محاضرة)

الاختبارات والتقييم:
  Exercise (تمرين) → Question (سؤال) → Choice (خيار)
  Submission (تسليم) → SubmissionAnswer (إجابة في التسليم)

وصول الطالب:
  StudentCourseAccess: يُحدّد الكورسات المتاحة لكل طالب.
================================================================================
"""

import uuid

from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


# ─────────────────────────────────────────────────────────────────────────────
# دوال مساعدة
# ─────────────────────────────────────────────────────────────────────────────

def lesson_pdf_upload_path(instance, filename):
    return f"lessons/pdfs/{instance.unit.course.id}/{uuid.uuid4().hex}.pdf"


# ─────────────────────────────────────────────────────────────────────────────
# 1. Level – المرحلة الدراسية
# ─────────────────────────────────────────────────────────────────────────────

class SystemType(models.TextChoices):
    ONLINE = "online", _("أونلاين")
    FLASH  = "flash",  _("فلاش")

class Level(models.Model):
    """
    المرحلة الدراسية (مثال: المرحلة الثانوية، المرحلة الجامعية).
    هي الحاوية الكبرى للهيكل الأكاديمي.
    """

    name         = models.CharField(_("اسم المرحلة"), max_length=100, unique=True)
    description  = models.TextField(_("الوصف"), blank=True)
    system_type  = models.CharField(
        _("نوع النظام"),
        max_length=10,
        choices=SystemType.choices,
        default=SystemType.ONLINE,
    )
    display_order = models.PositiveSmallIntegerField(_("ترتيب العرض"), default=0)
    is_active    = models.BooleanField(_("نشطة"), default=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name        = _("مرحلة")
        verbose_name_plural = _("المراحل")
        ordering            = ["display_order", "name"]

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────────────────────────────────────
# 2. Grade – الفصل / الصف
# ─────────────────────────────────────────────────────────────────────────────

class Grade(models.Model):
    """
    الفصل أو الصف داخل المرحلة (مثال: الصف الأول، الفصل الدراسي الأول).
    """

    level        = models.ForeignKey(
        Level,
        on_delete=models.CASCADE,
        related_name="grades",
        verbose_name=_("المرحلة"),
    )
    name         = models.CharField(_("اسم الفصل"), max_length=100)
    system_type  = models.CharField(
        _("نوع النظام"),
        max_length=10,
        choices=SystemType.choices,
        default=SystemType.ONLINE,
    )
    display_order = models.PositiveSmallIntegerField(_("ترتيب العرض"), default=0)
    is_active    = models.BooleanField(_("نشط"), default=True)

    class Meta:
        verbose_name        = _("فصل")
        verbose_name_plural = _("الفصول")
        ordering            = ["level", "display_order", "name"]
        unique_together     = [["level", "name"]]

    def __str__(self):
        return f"{self.level.name} — {self.name}"


# ─────────────────────────────────────────────────────────────────────────────
# 3. Course – الكورس / المادة الدراسية
# ─────────────────────────────────────────────────────────────────────────────

class Course(models.Model):
    """
    الكورس أو المادة الدراسية داخل الفصل.

    منطق الوصول:
    - طالب "أونلاين": تُفتح كل كورسات فصله تلقائياً عند أول دفع (عبر Signal).
    - طالب "فلاش": يُربط يدوياً بكورسات محددة عبر StudentCourseAccess.
    """

    grade        = models.ForeignKey(
        Grade,
        on_delete=models.CASCADE,
        related_name="courses",
        verbose_name=_("الفصل"),
    )
    name         = models.CharField(_("اسم الكورس"), max_length=150)
    description  = models.TextField(_("الوصف"), blank=True)
    teacher      = models.ForeignKey(
        "accounts.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="courses",
        verbose_name=_("الأستاذ المسؤول"),
        limit_choices_to={"role": "teacher"},
    )
    thumbnail    = models.ImageField(
        _("صورة مصغّرة"),
        upload_to="courses/thumbnails/",
        blank=True,
        null=True,
    )
    system_type  = models.CharField(
        _("نوع النظام"),
        max_length=10,
        choices=SystemType.choices,
        default=SystemType.ONLINE,
    )
    display_order = models.PositiveSmallIntegerField(_("ترتيب العرض"), default=0)
    is_active    = models.BooleanField(_("نشط"), default=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name        = _("كورس")
        verbose_name_plural = _("الكورسات")
        ordering            = ["grade", "display_order", "name"]

    def __str__(self):
        return f"{self.grade} — {self.name}"


# ─────────────────────────────────────────────────────────────────────────────
# 4. Unit – الوحدة داخل الكورس
# ─────────────────────────────────────────────────────────────────────────────

class Unit(models.Model):
    """
    الوحدة الدراسية: تجمع مجموعة من المحاضرات المترابطة.
    """

    course       = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="units",
        verbose_name=_("الكورس"),
    )
    name         = models.CharField(_("اسم الوحدة"), max_length=150)
    display_order = models.PositiveSmallIntegerField(_("ترتيب العرض"), default=0)
    is_active    = models.BooleanField(_("نشطة"), default=True)

    class Meta:
        verbose_name        = _("وحدة")
        verbose_name_plural = _("الوحدات")
        ordering            = ["course", "display_order"]

    def __str__(self):
        return f"{self.course.name} — {self.name}"


# ─────────────────────────────────────────────────────────────────────────────
# 5. Lesson – المحاضرة
# ─────────────────────────────────────────────────────────────────────────────

class Lesson(models.Model):
    """
    المحاضرة: النواة الأساسية للمحتوى التعليمي.

    تحتوي على:
    - رابط يوتيوب (يُعرَض عبر iframe بـ ?modestbranding=1&rel=0)
    - ملف PDF اختياري
    - تمرين (Exercise) مرتبط بها

    ملاحظة: عرض iframe يُعالَج في الـ Frontend، لكن URL يُحفَظ هنا نظيفاً.
    """

    unit          = models.ForeignKey(
        Unit,
        on_delete=models.CASCADE,
        related_name="lessons",
        verbose_name=_("الوحدة"),
    )
    title         = models.CharField(_("عنوان المحاضرة"), max_length=200)
    description   = models.TextField(_("الوصف"), blank=True)

    # ── رابط اليوتيوب ──────────────────────────────────────────────────────
    youtube_url   = models.URLField(
        _("رابط يوتيوب"),
        blank=True,
        help_text=_("يُمرَّر عبر iframe مع ?modestbranding=1&rel=0 في الواجهة."),
    )

    # ── ملف PDF ────────────────────────────────────────────────────────────
    pdf_file      = models.FileField(
        _("ملف PDF"),
        upload_to=lesson_pdf_upload_path,
        blank=True,
        null=True,
    )

    display_order = models.PositiveSmallIntegerField(_("ترتيب العرض"), default=0)
    is_active     = models.BooleanField(_("نشطة"), default=True)
    duration_minutes = models.PositiveSmallIntegerField(
        _("المدة (دقيقة)"),
        default=0,
        help_text=_("المدة التقريبية للمحاضرة بالدقائق."),
    )
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = _("محاضرة")
        verbose_name_plural = _("المحاضرات")
        ordering            = ["unit", "display_order"]

    def __str__(self):
        return f"{self.unit.name} — {self.title}"

    @property
    def youtube_embed_url(self):
        """
        يُحوِّل رابط اليوتيوب العادي إلى رابط iframe آمن
        مع المعاملات المطلوبة لتقليل التشتت.
        """
        if not self.youtube_url:
            return ""
        # دعم الروابط القصيرة youtu.be والروابط الكاملة
        video_id = ""
        if "youtu.be/" in self.youtube_url:
            video_id = self.youtube_url.split("youtu.be/")[-1].split("?")[0]
        elif "v=" in self.youtube_url:
            video_id = self.youtube_url.split("v=")[-1].split("&")[0]
        if video_id:
            return f"https://www.youtube.com/embed/{video_id}?modestbranding=1&rel=0"
        return self.youtube_url


# ─────────────────────────────────────────────────────────────────────────────
# 6. StudentCourseAccess – وصول الطالب للكورس
# ─────────────────────────────────────────────────────────────────────────────

class StudentCourseAccess(models.Model):
    """
    جدول وسيط يتحكم في وصول الطالب للكورسات.

    - طالب "أونلاين": يُنشأ هذا السجل تلقائياً لكل كورسات مرحلته
      عبر Signal عند أول دفع (راجع finance/models.py → Signal).
    - طالب "فلاش": يُنشأ يدوياً من لوحة التحكم.
    """

    student  = models.ForeignKey(
        "accounts.StudentProfile",
        on_delete=models.CASCADE,
        related_name="course_accesses",
        verbose_name=_("الطالب"),
    )
    course   = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="student_accesses",
        verbose_name=_("الكورس"),
    )
    granted_at = models.DateTimeField(_("تاريخ منح الوصول"), default=timezone.now)
    granted_by = models.ForeignKey(
        "accounts.CustomUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="granted_accesses",
        verbose_name=_("مُنِح بواسطة"),
        help_text=_("فارغ إذا كان تلقائياً عبر الدفع."),
    )
    is_active  = models.BooleanField(_("نشط"), default=True)

    class Meta:
        verbose_name        = _("وصول كورس")
        verbose_name_plural = _("وصول الكورسات")
        unique_together     = [["student", "course"]]
        ordering            = ["-granted_at"]

    def __str__(self):
        return f"{self.student} ← {self.course.name}"


# ─────────────────────────────────────────────────────────────────────────────
# 7. Exercise – التمرين الخاص بكل محاضرة
# ─────────────────────────────────────────────────────────────────────────────

class Exercise(models.Model):
    """
    التمرين المرتبط بمحاضرة محددة.
    يتكون من أسئلة متعددة الاختيارات مع تصحيح تلقائي.
    """

    lesson       = models.OneToOneField(
        Lesson,
        on_delete=models.CASCADE,
        related_name="exercise",
        verbose_name=_("المحاضرة"),
    )
    title        = models.CharField(_("عنوان التمرين"), max_length=200, blank=True)
    instructions = models.TextField(_("تعليمات التمرين"), blank=True)
    max_attempts = models.PositiveSmallIntegerField(
        _("الحد الأقصى للمحاولات"),
        default=0,
        help_text=_("0 = بلا حدود"),
    )
    pass_percentage = models.PositiveSmallIntegerField(
        _("نسبة النجاح (%)"),
        default=60,
    )
    is_active    = models.BooleanField(_("نشط"), default=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name        = _("تمرين")
        verbose_name_plural = _("التمارين")

    def __str__(self):
        return f"تمرين: {self.lesson.title}"

    @property
    def total_marks(self):
        """مجموع درجات جميع الأسئلة."""
        return self.questions.aggregate(
            total=models.Sum("marks")
        )["total"] or 0


# ─────────────────────────────────────────────────────────────────────────────
# 8. Question – سؤال داخل التمرين
# ─────────────────────────────────────────────────────────────────────────────

class Question(models.Model):
    """
    سؤال داخل التمرين. يدعم متعدد الاختيارات مع تصحيح تلقائي.
    """

    exercise     = models.ForeignKey(
        Exercise,
        on_delete=models.CASCADE,
        related_name="questions",
        verbose_name=_("التمرين"),
    )
    text         = models.TextField(_("نص السؤال"))
    marks        = models.FloatField(_("الدرجة"), default=1.0)
    display_order = models.PositiveSmallIntegerField(_("ترتيب العرض"), default=0)
    # صورة اختيارية للسؤال
    image        = models.ImageField(
        _("صورة السؤال"),
        upload_to="exercises/questions/",
        blank=True,
        null=True,
    )

    class Meta:
        verbose_name        = _("سؤال")
        verbose_name_plural = _("الأسئلة")
        ordering            = ["exercise", "display_order"]

    def __str__(self):
        return f"[{self.exercise}] {self.text[:60]}"


# ─────────────────────────────────────────────────────────────────────────────
# 9. Choice – الخيار الخاص بكل سؤال
# ─────────────────────────────────────────────────────────────────────────────

class Choice(models.Model):
    """
    خيار متعدد الاختيارات.
    حقل `is_correct` يُستخدم للتصحيح التلقائي عند تسليم التمرين.
    """

    question     = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="choices",
        verbose_name=_("السؤال"),
    )
    text         = models.CharField(_("نص الخيار"), max_length=500)
    is_correct   = models.BooleanField(_("هو الإجابة الصحيحة"), default=False)
    display_order = models.PositiveSmallIntegerField(_("ترتيب العرض"), default=0)

    class Meta:
        verbose_name        = _("خيار")
        verbose_name_plural = _("الخيارات")
        ordering            = ["question", "display_order"]

    def __str__(self):
        correct_mark = "✓" if self.is_correct else "✗"
        return f"{correct_mark} {self.text[:80]}"


# ─────────────────────────────────────────────────────────────────────────────
# 10. Submission – تسليم الطالب للتمرين
# ─────────────────────────────────────────────────────────────────────────────

class Submission(models.Model):
    """
    سجل كامل لتسليم الطالب للتمرين، يحفظ:
    - إجمالي الدرجات والنسبة المئوية.
    - حالة النجاح/الرسوب.
    - تاريخ التسليم.
    """

    student   = models.ForeignKey(
        "accounts.StudentProfile",
        on_delete=models.CASCADE,
        related_name="submissions",
        verbose_name=_("الطالب"),
    )
    exercise  = models.ForeignKey(
        Exercise,
        on_delete=models.CASCADE,
        related_name="submissions",
        verbose_name=_("التمرين"),
    )
    score     = models.FloatField(_("الدرجة المحققة"), default=0)
    percentage = models.FloatField(_("النسبة المئوية"), default=0)
    is_passed = models.BooleanField(_("ناجح"), default=False)
    attempt_number = models.PositiveSmallIntegerField(_("رقم المحاولة"), default=1)
    submitted_at   = models.DateTimeField(_("تاريخ التسليم"), default=timezone.now)

    class Meta:
        verbose_name        = _("تسليم")
        verbose_name_plural = _("التسليمات")
        ordering            = ["-submitted_at"]

    def __str__(self):
        return f"{self.student} — {self.exercise} ({self.percentage:.1f}%)"

    def calculate_score(self):
        """
        يُحسَب الدرجة النهائية بناءً على الإجابات المسجّلة.
        يُستدعى آخر خطوة في عملية التسليم.
        """
        total_marks = self.exercise.total_marks
        if total_marks == 0:
            self.score = 0
            self.percentage = 0
            self.is_passed = False
            return

        earned = 0.0
        for answer in self.answers.select_related("selected_choice__question"):
            if answer.selected_choice and answer.selected_choice.is_correct:
                earned += answer.selected_choice.question.marks

        self.score = earned
        self.percentage = (earned / total_marks) * 100
        self.is_passed = self.percentage >= self.exercise.pass_percentage
        self.save(update_fields=["score", "percentage", "is_passed"])


# ─────────────────────────────────────────────────────────────────────────────
# 11. SubmissionAnswer – إجابة الطالب لكل سؤال في التسليم
# ─────────────────────────────────────────────────────────────────────────────

class SubmissionAnswer(models.Model):
    """
    إجابة مفردة: تربط التسليم بسؤال معين والخيار الذي اختاره الطالب.
    """

    submission      = models.ForeignKey(
        Submission,
        on_delete=models.CASCADE,
        related_name="answers",
        verbose_name=_("التسليم"),
    )
    question        = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="submission_answers",
        verbose_name=_("السؤال"),
    )
    selected_choice = models.ForeignKey(
        Choice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submission_answers",
        verbose_name=_("الخيار المختار"),
    )

    class Meta:
        verbose_name        = _("إجابة تسليم")
        verbose_name_plural = _("إجابات التسليمات")
        unique_together     = [["submission", "question"]]

    def __str__(self):
        return f"{self.submission} — س: {self.question.text[:40]}"

    @property
    def is_correct(self):
        """هل الإجابة صحيحة؟"""
        return bool(self.selected_choice and self.selected_choice.is_correct)


# ─────────────────────────────────────────────────────────────────────────────
# 12. LessonProgress – تتبع تقدم الطالب في المحاضرات
# ─────────────────────────────────────────────────────────────────────────────

class LessonProgress(models.Model):
    """
    يتتبع ما إذا كان الطالب قد أتم مشاهدة المحاضرة.
    """

    student      = models.ForeignKey(
        "accounts.StudentProfile",
        on_delete=models.CASCADE,
        related_name="lesson_progresses",
        verbose_name=_("الطالب"),
    )
    lesson       = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        related_name="progresses",
        verbose_name=_("المحاضرة"),
    )
    is_completed = models.BooleanField(_("مكتملة"), default=False)
    completed_at = models.DateTimeField(_("تاريخ الإتمام"), null=True, blank=True)
    last_viewed  = models.DateTimeField(_("آخر مشاهدة"), auto_now=True)

    class Meta:
        verbose_name        = _("تقدم المحاضرة")
        verbose_name_plural = _("تقدم المحاضرات")
        unique_together     = [["student", "lesson"]]

    def __str__(self):
        status = "✓" if self.is_completed else "○"
        return f"{status} {self.student} — {self.lesson.title}"

    def mark_complete(self):
        if not self.is_completed:
            self.is_completed = True
            self.completed_at = timezone.now()
            self.save(update_fields=["is_completed", "completed_at"])
