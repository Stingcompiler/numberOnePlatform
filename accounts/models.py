"""
================================================================================
accounts/models.py
================================================================================
نموذج المستخدم المخصص وكافة الملفات الشخصية لنظام "مدارس ومعاهد نمبر ون"

يشمل:
  - CustomUser  : نموذج المستخدم الأساسي مع نظام الأدوار.
  - StudentProfile: الملف الشخصي الكامل للطالب شاملاً ربط الجهاز (Device Binding).
  - TeacherProfile: الملف الشخصي للأستاذ/المدرّس.
  - Supervisor   : جدول المشرفات (بدون صلاحيات دخول – مرجع إداري فقط).
  - LectureSupervisorProfile: ملف مشرف الكورسات (محدود الصلاحيات).
================================================================================"""

import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


# ─────────────────────────────────────────────────────────────────────────────
# 1. دوال مساعدة (Helpers)
# ─────────────────────────────────────────────────────────────────────────────

def user_avatar_upload_path(instance, filename):
    """مسار رفع صورة المستخدم: media/avatars/<user_id>/<filename>"""
    ext = filename.split(".")[-1]
    return f"avatars/{instance.pk}/{uuid.uuid4().hex}.{ext}"


# ─────────────────────────────────────────────────────────────────────────────
# 2. CustomUserManager – مدير المستخدم المخصص
# ─────────────────────────────────────────────────────────────────────────────

class CustomUserManager(BaseUserManager):
    """
    مدير مخصص يتيح إنشاء المستخدمين باستخدام اسم المستخدم كمعرّف أساسي.
    """

    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError(_("اسم المستخدم حقل إلزامي."))
        extra_fields.setdefault("is_active", True)
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", CustomUser.Roles.ADMIN)
        return self.create_user(username, password, **extra_fields)


# ─────────────────────────────────────────────────────────────────────────────
# 3. CustomUser – نموذج المستخدم الأساسي
# ─────────────────────────────────────────────────────────────────────────────

class CustomUser(AbstractBaseUser, PermissionsMixin):
    """
    نموذج المستخدم الموحّد لجميع أدوار النظام.
    يُستخدَم رقم الهاتف معرّفاً للدخول بدلاً من البريد الإلكتروني.
    """

    class Roles(models.TextChoices):
        STUDENT            = "student",            _("طالب")
        TEACHER            = "teacher",            _("أستاذ")
        ADMIN              = "admin",              _("مدير النظام")
        MANAGER            = "manager",            _("مدير")
        LECTURE_SUPERVISOR = "lecture_supervisor", _("مشرف الكورسات")

    # ── الحقول الأساسية ──────────────────────────────────────────────────────
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username   = models.CharField(_("اسم المستخدم"), max_length=150, unique=True)
    phone      = models.CharField(_("رقم الهاتف"), max_length=20, blank=True, null=True)
    full_name  = models.CharField(_("الاسم الكامل"), max_length=150)
    email      = models.EmailField(_("البريد الإلكتروني"), blank=True, null=True)
    avatar     = models.ImageField(
        _("الصورة الشخصية"),
        upload_to=user_avatar_upload_path,
        blank=True,
        null=True,
    )
    role       = models.CharField(
        _("الدور"),
        max_length=20,
        choices=Roles.choices,
        default=Roles.STUDENT,
    )

    # ── حقول الصلاحيات والحالة ───────────────────────────────────────────────
    is_active  = models.BooleanField(_("نشط"), default=True)
    is_staff   = models.BooleanField(_("طاقم العمل"), default=False)
    date_joined = models.DateTimeField(_("تاريخ الانضمام"), default=timezone.now)

    objects = CustomUserManager()

    USERNAME_FIELD  = "username"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        verbose_name        = _("مستخدم")
        verbose_name_plural = _("المستخدمون")
        ordering            = ["-date_joined"]

    def __str__(self):
        return f"{self.full_name} ({self.get_role_display()})"

    # ── خصائص مساعدة ─────────────────────────────────────────────────────────
    @property
    def is_student(self):
        return self.role == self.Roles.STUDENT

    @property
    def is_teacher(self):
        return self.role == self.Roles.TEACHER

    @property
    def is_admin(self):
        return self.role == self.Roles.ADMIN

    @property
    def is_manager(self):
        return self.role == self.Roles.MANAGER

    @property
    def is_lecture_supervisor(self):
        return self.role == self.Roles.LECTURE_SUPERVISOR


# ─────────────────────────────────────────────────────────────────────────────
# 4. StudentProfile – الملف الشخصي الكامل للطالب
# ─────────────────────────────────────────────────────────────────────────────

class StudentProfile(models.Model):
    """
    الملف التفصيلي للطالب.
    يُربط بـ CustomUser بعلاقة OneToOne لضمان وحدانية الملف.

    نوع النظام (system_type):
      - online : تُفتح له كل كورسات مرحلته تلقائياً عند أول دفع.
      - flash  : يُربط يدوياً بكورسات محددة.

    ربط الجهاز (Device Binding):
      - device_id يُحفَظ عند أول دخول من تطبيق الموبايل.
      - لا يتم فك الارتباط إلا بواسطة مدير النظام.
    """

    class SystemType(models.TextChoices):
        ONLINE = "online", _("أونلاين")
        FLASH  = "flash",  _("فلاش")

    # ── الربط بالمستخدم ───────────────────────────────────────────────────────
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="student_profile",
        verbose_name=_("المستخدم"),
        limit_choices_to={"role": CustomUser.Roles.STUDENT},
    )

    # ── بيانات ولي الأمر ──────────────────────────────────────────────────────
    guardian_name  = models.CharField(_("اسم ولي الأمر"), max_length=150,null=True  ,blank=True)
    guardian_phone = models.CharField(_("هاتف ولي الأمر"), max_length=20,null=True,blank=True)
    address        = models.CharField(_("السكن / العنوان"), max_length=255, blank=True,null=True)

    # ── نوع النظام ────────────────────────────────────────────────────────────
    system_type = models.CharField(
        _("نوع النظام"),
        max_length=10,
        choices=SystemType.choices,
        default=SystemType.ONLINE,
    )

    # ── ربط الجهاز (Device Binding للموبايل) ─────────────────────────────────
    device_id = models.CharField(
        _("معرّف الجهاز"),
        max_length=255,
        blank=True,
        null=True,
        unique=True,
        help_text=_("يُحفَظ تلقائياً عند أول दخول من تطبيق الموبايل. لا يُحرَّر إلا من قبل المدير."),
    )
    device_bound_at = models.DateTimeField(
        _("تاريخ ربط الجهاز"),
        null=True,
        blank=True,
    )
    device_type = models.CharField(
        _("نوع الجهاز"),
        max_length=100,
        blank=True,
        null=True,
        help_text=_("نوع جهاز الموبايل (يُحفَظ تلقائياً عند الربط)."),
    )

    # ── الربط بالمشرفة (مرجع إداري) ─────────────────────────────────────────
    supervisor = models.ForeignKey(
        "Supervisor",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
        verbose_name=_("المشرفة"),
    )

    # ── الطوابع الزمنية ───────────────────────────────────────────────────────
    registered_at = models.DateTimeField(_("تاريخ التسجيل"), default=timezone.now)
    # ── الفصل/المرحلة الدراسية (لفتح الكورسات تلقائياً للطالب الأونلاين) ─────
    enrolled_grade = models.ForeignKey(
        "academic.Grade",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="enrolled_students",
        verbose_name=_("الفصل المسجّل فيه"),
        help_text=_(
            "يُستخدم لفتح كورسات الفصل تلقائياً عند أول دفع "
            "(طلاب الأونلاين فقط)."
        ),
    )

    notes         = models.TextField(_("ملاحظات"), blank=True)

    class Meta:
        verbose_name        = _("ملف الطالب")
        verbose_name_plural = _("ملفات الطلاب")
        ordering            = ["-registered_at"]

    def __str__(self):
        return f"{self.user.full_name} — {self.get_system_type_display()}"

    # ── منطق ربط الجهاز ──────────────────────────────────────────────────────
    @staticmethod
    def detect_device_type(device_id: str) -> str:
        """
        يستنتج نوع الجهاز من سابقة المعرّف التي يرسلها العميل.
        يسمح بتعبئة device_type لعملاء الموبايل المنشورين دون تحديثهم.
        """
        prefix_map = (
            ("hw-android-",  "Android"),
            ("gen-android-", "Android"),
            ("hw-ios-",      "iOS"),
            ("gen-ios-",     "iOS"),
            ("hw-win-",      "Windows"),
            ("hw-mac-",      "macOS"),
        )
        for prefix, label in prefix_map:
            if device_id.startswith(prefix):
                return label
        return "غير معروف"

    def bind_device(self, device_id: str, device_type: str = None):
        """
        يُنفَّذ عند أول دخول من التطبيق (موبايل أو ديسكتوب).
        يرفض ربط جهاز جديد إذا كان الجهاز مقيّداً مسبقاً.

        device_type اختياري: إن لم يُرسله العميل يُستنتَج من سابقة device_id،
        فيبقى العملاء المنشورون حالياً متوافقين دون أي تعديل.
        """
        if self.device_id and self.device_id != device_id:
            raise PermissionError(
                _("هذا الحساب مرتبط بجهاز آخر. يرجى التواصل مع الإدارة لفك الارتباط.")
            )
        if not self.device_id:
            # الجهاز ذاته قد يكون مرتبطاً بحساب طالب آخر (حاسوب مشترك مثلاً).
            # نفحص مسبقاً لتفادي IntegrityError على قيد unique وإرجاع رسالة مفهومة.
            if StudentProfile.objects.filter(
                device_id=device_id
            ).exclude(pk=self.pk).exists():
                raise PermissionError(
                    _("هذا الجهاز مرتبط بحساب طالب آخر. يرجى التواصل مع الإدارة.")
                )
            self.device_id       = device_id
            self.device_bound_at = timezone.now()
            self.device_type     = device_type or self.detect_device_type(device_id)
            self.save(update_fields=["device_id", "device_bound_at", "device_type"])

    def unbind_device(self):
        """
        فك ربط الجهاز — يُستدعى فقط من قِبَل مدير النظام.
        """
        self.device_id       = None
        self.device_bound_at = None
        self.device_type     = None
        self.save(update_fields=["device_id", "device_bound_at", "device_type"])


# ─────────────────────────────────────────────────────────────────────────────
# 5. TeacherProfile – الملف الشخصي للأستاذ
# ─────────────────────────────────────────────────────────────────────────────

class TeacherProfile(models.Model):
    """
    بيانات تفصيلية للأستاذ: التخصص، السيرة الذاتية المختصرة...
    تُعرَض بطاقته في صفحة الهبوط إذا كان is_public=True.
    """

    class StaffType(models.TextChoices):
        ACADEMIC       = "academic",       _("هيئة تدريس")
        ADMINISTRATIVE = "administrative", _("هيئة إدارة")

    user        = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="teacher_profile",
        verbose_name=_("المستخدم"),
        limit_choices_to={"role": CustomUser.Roles.TEACHER},
    )
    specialization = models.CharField(_("التخصص"), max_length=200, blank=True)
    bio            = models.TextField(_("نبذة مختصرة"), blank=True)
    staff_type     = models.CharField(
        _("نوع الكادر"),
        max_length=20,
        choices=StaffType.choices,
        default=StaffType.ACADEMIC,
    )
    # للعرض في صفحة الهبوط
    is_public      = models.BooleanField(_("ظاهر في صفحة الهبوط"), default=False)
    display_order  = models.PositiveSmallIntegerField(_("ترتيب العرض"), default=0)

    class Meta:
        verbose_name        = _("ملف الأستاذ")
        verbose_name_plural = _("ملفات الأساتذة")
        ordering            = ["display_order", "user__full_name"]

    def __str__(self):
        return f"{self.user.full_name} — {self.specialization}"


# ─────────────────────────────────────────────────────────────────────────────
# 6. Supervisor – جدول المشرفات (مرجع إداري بلا صلاحيات دخول)
# ─────────────────────────────────────────────────────────────────────────────

class Supervisor(models.Model):
    """
    المشرفة: مرجع إداري يُستخدم لتصنيف الطلاب وتتبّعهم,
    دون أن تمتلك المشرفة أي صلاحيات دخول للنظام.

    تقرير المشرفة: يمكن طباعة وثيقة بالطلاب المسجلين تحتها
    عبر endpoint خاص.
    """

    name    = models.CharField(_("الاسم الكامل"), max_length=150)
    phone   = models.CharField(_("رقم الهاتف"), max_length=20, blank=True)
    address = models.CharField(_("السكن"), max_length=255, blank=True)
    notes   = models.TextField(_("ملاحظات"), blank=True)
    is_active = models.BooleanField(_("نشطة"), default=True)
    created_at = models.DateTimeField(_("تاريخ الإضافة"), auto_now_add=True)

    class Meta:
        verbose_name        = _("مشرفة")
        verbose_name_plural = _("المشرفات")
        ordering            = ["name"]

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────────────────────────────────────
# 7. StudentRequest – طلب تسجيل طالب جديد (من النافذة العامة)
# ─────────────────────────────────────────────────────────────────────────────

class StudentRequest(models.Model):
    """
    نموذج لطلبات التسجيل الواردة من الزوار عبر النافذة العامة.
    """
    class StatusChoices(models.TextChoices):
        NEW       = "new",       _("جديد")
        CONTACTED = "contacted", _("تم التواصل")
        CLOSED    = "closed",    _("مكتمل / مغلق")

    class SystemTypeChoices(models.TextChoices):
        ONLINE = "online", _("أونلاين")
        FLASH  = "flash",  _("فلاش كورس")

    class LevelChoices(models.TextChoices):
        PRIMARY      = "primary",      _("ابتدائي")
        INTERMEDIATE = "intermediate", _("متوسط")
        SECONDARY    = "secondary",    _("ثانوي")

    student_name   = models.CharField(_("اسم الطالب"), max_length=150)
    guardian_name  = models.CharField(_("اسم ولي الأمر"), max_length=150)
    guardian_phone = models.CharField(_("هاتف ولي الأمر"), max_length=20)
    address        = models.CharField(_("العنوان"), max_length=255)
    system_type    = models.CharField(
        _("نوع النظام الدراسي"),
        max_length=20,
        choices=SystemTypeChoices.choices,
        default=SystemTypeChoices.ONLINE,
    )
    year_of_study  = models.CharField(_("السنة الدراسية"), max_length=50, blank=True)
    level          = models.CharField(
        _("المرحلة الدراسية"),
        max_length=20,
        choices=LevelChoices.choices,
        blank=True,
    )
    notes          = models.TextField(_("ملاحظات"), blank=True)
    status         = models.CharField(
        _("الحالة"),
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.NEW,
    )
    submitted_at   = models.DateTimeField(_("تاريخ الإرسال"), auto_now_add=True)

    class Meta:
        verbose_name        = _("طلب تسجيل طالب")
        verbose_name_plural = _("طلبات تسجيل الطلاب")
        ordering            = ["-submitted_at"]

    def __str__(self):
        return f"{self.student_name} - {self.get_status_display()}"


# ─────────────────────────────────────────────────────────────────────────────
# 8. NewStudentRegistration – طلب تسجيل طالب جديد (النظام الجديد)
# ─────────────────────────────────────────────────────────────────────────────

def registration_upload_path(instance, filename):
    """مسار رفع ملفات التسجيل: media/registrations/<id>/<filename>"""
    ext = filename.split(".")[-1]
    return f"registrations/{uuid.uuid4().hex}.{ext}"


class NewStudentRegistration(models.Model):
    """
    نموذج طلبات التسجيل الجديدة — يحتوي على جميع بيانات الطالب
    والملفات المطلوبة للتسجيل في المدرسة.
    """

    class LevelChoices(models.TextChoices):
        PRIMARY    = "primary",    _("ابتدائي")
        MIDDLE     = "middle",     _("متوسط")
        SECONDARY  = "secondary",  _("ثانوي")

    class GradeChoices(models.TextChoices):
        FIRST   = "first",   _("الأول")
        SECOND  = "second",  _("الثاني")
        THIRD   = "third",   _("الثالث")
        FOURTH  = "fourth",  _("الرابع")
        FIFTH   = "fifth",   _("الخامس")
        SIXTH   = "sixth",   _("السادس")

    class GenderChoices(models.TextChoices):
        MALE   = "male",   _("ذكر")
        FEMALE = "female", _("أنثى")

    class StudentStatusChoices(models.TextChoices):
        RETURNING = "returning", _("عائد لنفس السنه")
        NEW_YEAR  = "new_year",  _("عام دراسي جديد")

    class RequestStatusChoices(models.TextChoices):
        NEW       = "new",       _("جديد")
        REVIEWED  = "reviewed",  _("تمت المراجعة")
        ACCEPTED  = "accepted",  _("مقبول")
        REJECTED  = "rejected",  _("مرفوض")

    # ── بيانات الطالب الأساسية ─────────────────────────────────────────────────
    student_full_name = models.CharField(_("الاسم الكامل للطالب"), max_length=200)
    national_id       = models.CharField(_("الرقم الوطني للطالب"), max_length=50)
    level             = models.ForeignKey(
        "academic.Level", on_delete=models.PROTECT, verbose_name=_("المرحلة الدراسية")
    )
    grade             = models.ForeignKey(
        "academic.Grade", on_delete=models.PROTECT, verbose_name=_("الصف الدراسي")
    )
    gender            = models.CharField(
        _("الجنس"), max_length=10, choices=GenderChoices.choices,
    )
    student_status    = models.CharField(
        _("حالة الطالب"), max_length=20, choices=StudentStatusChoices.choices,
    )

    # ── الأشقاء ───────────────────────────────────────────────────────────────
    has_siblings  = models.BooleanField(_("هل لديه أشقاء في مدرسة نمبر ون؟"), default=False)
    siblings_info = models.JSONField(
        _("بيانات الأشقاء"),
        default=list,
        blank=True,
        help_text=_("قائمة بأسماء وصفوف الأشقاء [{name, grade}, ...]"),
    )

    # ── بيانات إضافية ─────────────────────────────────────────────────────────
    residence      = models.CharField(_("مكان إقامة الطالب الحالي"), max_length=300)
    date_of_birth  = models.DateField(_("تاريخ ميلاد الطالب"))
    student_phone  = models.CharField(_("رقم هاتف الطالب"), max_length=20, blank=True)

    # ── الملفات المرفقة ───────────────────────────────────────────────────────
    academic_result_image    = models.ImageField(
        _(" تحميل اخر نتيجة دراسية للطالب "), upload_to=registration_upload_path, blank=False, null=False,
    )
    birth_certificate_image  = models.ImageField(
        _("   تحميل شهادة ميلاد الطالب"), upload_to=registration_upload_path, blank=False, null=False,
    )
    personal_photo           = models.ImageField(
        _("   صورة شخصية للطالب / باسبورت"), upload_to=registration_upload_path, blank=False, null=False,
    )
    student_id_image         = models.ImageField(
        _("  تحميل الرقم الوطني للطالب "), upload_to=registration_upload_path, blank=False, null=False,
    )
    father_id_image          = models.ImageField(
        _("  تحميل الرقم الوطني للأب "), upload_to=registration_upload_path, blank=False, null=False,
    )
    mother_id_image          = models.ImageField(
        _("  تحميل الرقم الوطني للأم"), upload_to=registration_upload_path, blank=False, null=False,
    )
    # إلزامي كبقية المستندات. كان ‎blank=True‎ وحده بين السبعة، فكان الطلب
    # يُقبَل بلا إشعار سداد ولا شيء يُبلّغ المراجع بغيابه.
    payment_receipt_image    = models.ImageField(
        _("  تحميل اشعار سداد الرسوم / اشعار بنكك "), upload_to=registration_upload_path, blank=False, null=False,
    )

    @classmethod
    def document_fields(cls):
        """
        حقول المستندات كما يعرّفها الموديل، مع كون كل منها إلزامياً أو لا.

        تُشتَقّ من الموديل ولا تُكتَب يدوياً: قائمة مكرّرة في مكان آخر هي بالضبط
        ما جعل student_id_image يصل من المتصفح ثم يُهمَل بصمت.
        """
        return [
            (f.name, str(f.verbose_name).strip(), not f.blank)
            for f in cls._meta.get_fields()
            if isinstance(f, models.ImageField)
        ]

    def missing_documents(self):
        """
        المستندات الإلزامية غير المرفوعة في هذا الطلب.

        صفحة المراجعة كانت تُخفي المستند الغائب تماماً، فيرى المراجع ستّ بطاقات
        ولا شيء يدلّه على أن سابعاً ناقص — وهو الفرق بين طلب مكتمل وطلب معلّق.
        """
        return [
            {"field": name, "label": label}
            for name, label, required in self.document_fields()
            if required and not getattr(self, name, None)
        ]

    # ── بيانات ولي الأمر ──────────────────────────────────────────────────────
    guardian_name      = models.CharField(_("اسم ولي أمر الطالب"), max_length=200)
    guardian_phone     = models.CharField(_("رقم هاتف ولي الأمر"), max_length=20)
    guardian_residence = models.CharField(_("مكان إقامة ولي الأمر"), max_length=300)
    mother_full_name   = models.CharField(_("اسم الأم الكامل"), max_length=200)

    # ── المشرفة ───────────────────────────────────────────────────────────────
    supervisor = models.ForeignKey(
        "Supervisor",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="new_registrations",
        verbose_name=_("المشرفة"),
    )

    # ── حالة الطلب ────────────────────────────────────────────────────────────
    status = models.CharField(
        _("حالة الطلب"),
        max_length=20,
        choices=RequestStatusChoices.choices,
        default=RequestStatusChoices.NEW,
    )
    admin_notes = models.TextField(_("ملاحظات الإدارة"), blank=True)
    submitted_at = models.DateTimeField(_("تاريخ الإرسال"), auto_now_add=True)

    class Meta:
        verbose_name        = _("طلب تسجيل جديد")
        verbose_name_plural = _("طلبات التسجيل الجديدة")
        ordering            = ["-submitted_at"]

    def __str__(self):
        return f"{self.student_full_name} — {self.get_status_display()}"


# ─────────────────────────────────────────────────────────────────────────────
# 9. RegistrationCondition – شروط التسجيل الإلكتروني (ديناميكية)
# ─────────────────────────────────────────────────────────────────────────────

class RegistrationCondition(models.Model):
    """
    شروط التسجيل الإلكتروني التي تظهر في أعلى صفحة التسجيل.
    تُدار من لوحة التحكم ويمكن تعديلها بدون تغيير الكود.
    """

    title        = models.CharField(_("العنوان"), max_length=300)
    content      = models.TextField(
        _("المحتوى"),
        help_text=_("نص الشرط أو التعليمات. يمكن استخدام عدة أسطر."),
    )
    display_order = models.PositiveSmallIntegerField(_("ترتيب العرض"), default=0)
    is_active     = models.BooleanField(_("نشط"), default=True)
    created_at    = models.DateTimeField(_("تاريخ الإضافة"), auto_now_add=True)
    updated_at    = models.DateTimeField(_("آخر تحديث"), auto_now=True)

    class Meta:
        verbose_name        = _("شرط تسجيل")
        verbose_name_plural = _("شروط التسجيل")
        ordering            = ["display_order", "created_at"]

    def __str__(self):
        return self.title


# ─────────────────────────────────────────────────────────────────────────────
# 10. LectureSupervisorProfile – ملف مشرف الكورسات
# ─────────────────────────────────────────────────────────────────────────────

class LectureSupervisorProfile(models.Model):
    """
    الملف الشخصي لمشرف الكورسات.

    مشرف الكورسات هو عضو كادر محدود الصلاحيات يساعد المدير
    في إدارة محتوى المحاضرات (إضافة وتعديل وعرض) لجميع الكورسات في النظام.

    الصلاحيات:
      - يستطيع: تصفح جميع الكورسات، وإضافة وتعديل وعرض المحاضرات
                 داخل الكورسات المخصصة له في assigned_courses فقط.
      - لا يستطيع: إنشاء/تعديل/حذف الكورسات، حذف محاضرات، إدارة مستخدمين،
                   الوصول للإعدادات أو المالية، تعديل بياناته الشخصية.
    """

    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="lecture_supervisor_profile",
        verbose_name=_("المستخدم"),
        limit_choices_to={"role": CustomUser.Roles.LECTURE_SUPERVISOR},
    )
    assigned_courses = models.ManyToManyField(
        "academic.Course",
        blank=True,
        related_name="lecture_supervisors",
        verbose_name=_("الكورسات المخصصة"),
        help_text=_("الكورسات التي يملك هذا المشرف صلاحية إدارة محاضراتها."),
    )
    notes = models.TextField(_("ملاحظات"), blank=True)
    created_at = models.DateTimeField(_("تاريخ الإنشاء"), auto_now_add=True)
    updated_at = models.DateTimeField(_("آخر تحديث"), auto_now=True)

    class Meta:
        verbose_name        = _("مشرف الكورسات")
        verbose_name_plural = _("مشرفو الكورسات")
        ordering            = ["-created_at"]

    def __str__(self):
        return f"{self.user.full_name} — مشرف الكورسات"

    def get_assigned_course_ids(self):
        """يُعيد قائمة بمعرّفات الكورسات المخصصة لهذا المشرف."""
        return list(self.assigned_courses.values_list("id", flat=True))
