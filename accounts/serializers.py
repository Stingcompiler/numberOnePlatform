"""
================================================================================
accounts/serializers.py
================================================================================
"""

from django.contrib.auth import authenticate
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import CustomUser, StudentProfile, TeacherProfile, Supervisor, StudentRequest, NewStudentRegistration, RegistrationCondition, LectureSupervisorProfile


# ─────────────────────────────────────────────────────────────────────────────
# 1. CustomUser — القراءة (عام)
# ─────────────────────────────────────────────────────────────────────────────

class UserMiniSerializer(serializers.ModelSerializer):
    """ملخص مختصر للمستخدم يُستخدم في علاقات nested."""

    class Meta:
        model  = CustomUser
        fields = ["id", "username", "full_name", "phone", "role", "avatar"]
        read_only_fields = fields


class UserDetailSerializer(serializers.ModelSerializer):
    """تفاصيل المستخدم الكاملة — للقراءة والتعديل من لوحة التحكم."""

    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model  = CustomUser
        fields = [
            "id", "username", "phone", "full_name", "email", "avatar",
            "role", "role_display", "is_active", "date_joined",
        ]
        read_only_fields = ["id", "date_joined", "role_display"]
        extra_kwargs = {"avatar": {"required": False}}


# ─────────────────────────────────────────────────────────────────────────────
# 2. Auth — تسجيل الدخول والخروج وتجديد التوكن
# ─────────────────────────────────────────────────────────────────────────────

class LoginSerializer(serializers.Serializer):
    """
    بيانات تسجيل الدخول.
    يُمرَّر الـ device_id اختيارياً للموبايل لتفعيل Device Binding.
    """

    username  = serializers.CharField(max_length=150)
    password  = serializers.CharField(write_only=True)
    device_id = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate(self, attrs):
        username  = attrs.get("username")
        password  = attrs.get("password")
        device_id = attrs.get("device_id", "")

        user = authenticate(
            request=self.context.get("request"),
            username=username,
            password=password,
        )
        if not user:
            raise serializers.ValidationError(
                _("اسم المستخدم أو كلمة المرور غير صحيحة."),
                code="authentication",
            )
        if not user.is_active:
            raise serializers.ValidationError(
                _("الحساب موقوف. يرجى التواصل مع الإدارة."),
                code="inactive",
            )

        # ── Device Binding (للطالب من الموبايل) ─────────────────────────────
        if device_id and user.is_student:
            try:
                user.student_profile.bind_device(device_id)
            except PermissionError as exc:
                raise serializers.ValidationError(str(exc), code="device_mismatch")

        attrs["user"] = user
        return attrs


# ─────────────────────────────────────────────────────────────────────────────
# 3. Supervisor
# ─────────────────────────────────────────────────────────────────────────────

class SupervisorSerializer(serializers.ModelSerializer):
    student_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model  = Supervisor
        fields = [
            "id", "name", "phone", "address", "notes",
            "is_active", "created_at", "student_count",
        ]
        read_only_fields = ["id", "created_at", "student_count"]

    def get_student_count(self, obj):
        return obj.students.count()


# ─────────────────────────────────────────────────────────────────────────────
# 4. StudentProfile
# ─────────────────────────────────────────────────────────────────────────────

class StudentProfileSerializer(serializers.ModelSerializer):
    """
    الملف الكامل للطالب.
    يتضمن بيانات المستخدم المرتبط به nested.
    """

    user            = UserDetailSerializer()
    supervisor_name = serializers.CharField(
        source="supervisor.name", read_only=True, default=None
    )
    system_type_display = serializers.CharField(
        source="get_system_type_display", read_only=True
    )
    balance         = serializers.SerializerMethodField(read_only=True)
    enrolled_grade_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model  = StudentProfile
        fields = [
            "id", "user", "guardian_name", "guardian_phone", "address",
            "system_type", "system_type_display",
            "enrolled_grade", "enrolled_grade_name",
            "supervisor", "supervisor_name",
            "device_id", "device_bound_at", "device_type",
            "registered_at", "notes",
            "balance",
        ]
        read_only_fields = [
            "id", "device_id", "device_bound_at", "device_type", "registered_at",
            "supervisor_name", "system_type_display", "balance",
            "enrolled_grade_name",
        ]

    def get_balance(self, obj):
        """يعيد المبلغ المتبقي من الملف المالي."""
        try:
            return str(obj.financial_file.get_balance())
        except Exception:
            return "0.00"

    def get_enrolled_grade_name(self, obj):
        return obj.enrolled_grade.name if obj.enrolled_grade else None


class StudentCreateSerializer(serializers.Serializer):
    """
    إنشاء طالب جديد (حساب + ملف شخصي في خطوة واحدة).
    """

    # ── حقول CustomUser ───────────────────────────────────────────────────────
    username      = serializers.CharField(max_length=150)
    phone         = serializers.CharField(max_length=20, required=False, allow_blank=True)
    full_name     = serializers.CharField(max_length=150)
    password      = serializers.CharField(min_length=6, write_only=True)
    email         = serializers.EmailField(required=False, allow_blank=True)

    # ── حقول StudentProfile ───────────────────────────────────────────────────
    guardian_name  = serializers.CharField(max_length=150)
    guardian_phone = serializers.CharField(max_length=20)
    address        = serializers.CharField(max_length=255, required=False, allow_blank=True)
    system_type    = serializers.ChoiceField(
        choices=StudentProfile.SystemType.choices,
        default=StudentProfile.SystemType.ONLINE,
    )
    enrolled_grade = serializers.PrimaryKeyRelatedField(
        queryset=__import__("academic.models", fromlist=["Grade"]).Grade.objects.all(),
        required=False,
        allow_null=True,
    )
    supervisor     = serializers.PrimaryKeyRelatedField(
        queryset=Supervisor.objects.all(),
        required=False,
        allow_null=True,
    )
    notes          = serializers.CharField(required=False, allow_blank=True)

    def validate_username(self, value):
        if CustomUser.objects.filter(username=value).exists():
            raise serializers.ValidationError(_("اسم المستخدم مسجّل مسبقاً."))
        return value

    def create(self, validated_data):
        from academic.models import Grade

        user_data = {
            "username":  validated_data.pop("username"),
            "phone":     validated_data.pop("phone", ""),
            "full_name": validated_data.pop("full_name"),
            "email":     validated_data.pop("email", ""),
            "role":      CustomUser.Roles.STUDENT,
        }
        password = validated_data.pop("password")

        user = CustomUser.objects.create_user(password=password, **user_data)
        StudentProfile.objects.create(user=user, **validated_data)
        return user


class StudentUnbindDeviceSerializer(serializers.Serializer):
    """يُستخدم للتحقق من الطلب قبل فك ربط جهاز الطالب."""
    confirm = serializers.BooleanField()

    def validate_confirm(self, value):
        if not value:
            raise serializers.ValidationError(_("يجب تأكيد العملية."))
        return value


# ─────────────────────────────────────────────────────────────────────────────
# 5. TeacherProfile
# ─────────────────────────────────────────────────────────────────────────────

class TeacherProfileSerializer(serializers.ModelSerializer):
    user            = UserDetailSerializer(read_only=True)
    staff_type_display = serializers.CharField(
        source="get_staff_type_display", read_only=True
    )

    class Meta:
        model  = TeacherProfile
        fields = [
            "id", "user", "specialization", "bio",
            "staff_type", "staff_type_display",
            "is_public", "display_order",
        ]
        read_only_fields = ["id", "user", "staff_type_display"]


class TeacherCreateSerializer(serializers.Serializer):
    """إنشاء حساب أستاذ مع ملفه الشخصي."""

    username       = serializers.CharField(max_length=150)
    phone          = serializers.CharField(max_length=20, required=False, allow_blank=True)
    full_name      = serializers.CharField(max_length=150)
    password       = serializers.CharField(min_length=6, write_only=True)
    email          = serializers.EmailField(required=False, allow_blank=True)
    specialization = serializers.CharField(max_length=200, required=False, allow_blank=True)
    bio            = serializers.CharField(required=False, allow_blank=True)
    staff_type     = serializers.ChoiceField(
        choices=TeacherProfile.StaffType.choices,
        default=TeacherProfile.StaffType.ACADEMIC,
    )
    is_public      = serializers.BooleanField(default=False)
    display_order  = serializers.IntegerField(default=0)

    def validate_username(self, value):
        if CustomUser.objects.filter(username=value).exists():
            raise serializers.ValidationError(_("اسم المستخدم مسجّل مسبقاً."))
        return value

    def create(self, validated_data):
        user_data = {
            "username":  validated_data.pop("username"),
            "phone":     validated_data.pop("phone", ""),
            "full_name": validated_data.pop("full_name"),
            "email":     validated_data.pop("email", ""),
            "role":      CustomUser.Roles.TEACHER,
        }
        password = validated_data.pop("password")
        user = CustomUser.objects.create_user(password=password, **user_data)
        TeacherProfile.objects.create(user=user, **validated_data)
        return user


# ─────────────────────────────────────────────────────────────────────────────
# 6. تغيير كلمة المرور
# ─────────────────────────────────────────────────────────────────────────────

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(min_length=6, write_only=True)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError(_("كلمة المرور القديمة غير صحيحة."))
        return value

    def save(self):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class AdminResetPasswordSerializer(serializers.Serializer):
    """
    إعادة تعيين كلمة المرور من قبل مدير النظام — لا يتطلب كلمة المرور القديمة.
    مسموح فقط للأدوار: student, lecture_supervisor.
    """

    ALLOWED_ROLES = (CustomUser.Roles.STUDENT, CustomUser.Roles.LECTURE_SUPERVISOR)

    user_id          = serializers.UUIDField()
    new_password     = serializers.CharField(min_length=6, write_only=True)
    confirm_password = serializers.CharField(min_length=6, write_only=True)

    def validate_user_id(self, value):
        try:
            user = CustomUser.objects.get(pk=value)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError(_("المستخدم غير موجود."))
        if user.role not in self.ALLOWED_ROLES:
            raise serializers.ValidationError(
                _("لا يمكن إعادة تعيين كلمة المرور لهذا الدور.")
            )
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": _("كلمتا المرور غير متطابقتين.")}
            )
        return attrs

    def save(self):
        user = CustomUser.objects.get(pk=self.validated_data["user_id"])
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


# ─────────────────────────────────────────────────────────────────────────────
# 7. StudentRequest – طلبات تسجيل الطلاب
# ─────────────────────────────────────────────────────────────────────────────

class StudentRequestSerializer(serializers.ModelSerializer):
    """
    سيريالايزر لطلبات تسجيل الطلاب القادمة من النافذة العامة
    """
    status_display      = serializers.CharField(source="get_status_display",      read_only=True)
    system_type_display = serializers.CharField(source="get_system_type_display", read_only=True)
    level_display       = serializers.CharField(source="get_level_display",       read_only=True)

    class Meta:
        model = StudentRequest
        fields = [
            "id", "student_name", "guardian_name", "guardian_phone",
            "address", "system_type", "system_type_display",
            "year_of_study", "level", "level_display",
            "notes", "status", "status_display", "submitted_at"
        ]
        read_only_fields = [
            "id", "submitted_at", "status_display",
            "system_type_display", "level_display",
        ]


# ─────────────────────────────────────────────────────────────────────────────
# 8. NewStudentRegistration
# ─────────────────────────────────────────────────────────────────────────────

class NewStudentRegistrationSerializer(serializers.ModelSerializer):
    """سيريالايزر طلبات التسجيل الجديدة — للإرسال العام وللقراءة الإدارية."""

    status_display         = serializers.CharField(source="get_status_display", read_only=True)
    level_display          = serializers.CharField(source="level.name", read_only=True)
    grade_display          = serializers.CharField(source="grade.name", read_only=True)
    gender_display         = serializers.CharField(source="get_gender_display", read_only=True)
    student_status_display = serializers.CharField(source="get_student_status_display", read_only=True)
    supervisor_name        = serializers.CharField(source="supervisor.name", read_only=True, default=None)

    class Meta:
        model = NewStudentRegistration
        fields = [
            "id",
            # Student info
            "student_full_name", "national_id",
            "level", "level_display",
            "grade", "grade_display",
            "gender", "gender_display",
            "student_status", "student_status_display",
            # Siblings
            "has_siblings", "siblings_info",
            # Additional
            "residence", "date_of_birth", "student_phone",
            # Files
            "academic_result_image", "birth_certificate_image",
            "personal_photo", "father_id_image",
            "mother_id_image", "payment_receipt_image",
            # Guardian
            "guardian_name", "guardian_phone",
            "guardian_residence", "mother_full_name",
            # Supervisor
            "supervisor", "supervisor_name",
            # Status
            "status", "status_display", "admin_notes", "submitted_at",
        ]
        read_only_fields = [
            "id", "submitted_at", "status_display",
            "level_display", "grade_display", "gender_display",
            "student_status_display", "supervisor_name",
        ]


# ─────────────────────────────────────────────────────────────────────────────
# 9. RegistrationCondition
# ─────────────────────────────────────────────────────────────────────────────

class RegistrationConditionSerializer(serializers.ModelSerializer):
    """سيريالايزر شروط التسجيل الإلكتروني."""

    class Meta:
        model = RegistrationCondition
        fields = [
            "id", "title", "content",
            "display_order", "is_active",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# ─────────────────────────────────────────────────────────────────────────────
# 10. LectureSupervisorProfile
# ─────────────────────────────────────────────────────────────────────────────

class LectureSupervisorProfileSerializer(serializers.ModelSerializer):
    """
    سيريالايزر مشرف المحاضرات — للقراءة والتعديل من لوحة التحكم.
    يتضمن بيانات المستخدم المرتبط به nested وقائمة الكورسات المخصصة.
    """

    user = UserDetailSerializer(read_only=True)
    assigned_courses_detail = serializers.SerializerMethodField(read_only=True)
    assigned_courses = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=__import__("academic.models", fromlist=["Course"]).Course.objects.all(),
        required=False,
    )

    class Meta:
        model = LectureSupervisorProfile
        fields = [
            "id", "user",
            "assigned_courses", "assigned_courses_detail",
            "notes", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "user", "created_at", "updated_at", "assigned_courses_detail"]

    def get_assigned_courses_detail(self, obj):
        """\u064a\u064f\u0639\u064a\u062f \u0642\u0627\u0626\u0645\u0629 \u0645\u0628\u0633\u0637\u0629 \u0628\u0627\u0644\u0643\u0648\u0631\u0633\u0627\u062a \u0627\u0644\u0645\u062e\u0635\u0635\u0629 \u0645\u0639 \u0627\u0633\u0645 \u0627\u0644\u0643\u0648\u0631\u0633 \u0648\u0645\u0639\u0631\u0641\u0647."""
        return [
            {
                "id": c.id,
                "name": c.name,
                "grade": str(c.grade),
            }
            for c in obj.assigned_courses.select_related("grade", "grade__level")
        ]


class LectureSupervisorCreateSerializer(serializers.Serializer):
    """إنشاء حساب مشرف محاضرات مع ملفه الشخصي دفعة واحدة."""

    # حقول CustomUser
    username      = serializers.CharField(max_length=150)
    full_name     = serializers.CharField(max_length=150)
    password      = serializers.CharField(min_length=6, write_only=True)
    email         = serializers.EmailField(required=False, allow_blank=True)
    phone         = serializers.CharField(max_length=20, required=False, allow_blank=True)

    # حقول LectureSupervisorProfile
    assigned_courses = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=__import__("academic.models", fromlist=["Course"]).Course.objects.all(),
        required=False,
    )
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_username(self, value):
        if CustomUser.objects.filter(username=value).exists():
            raise serializers.ValidationError(_("اسم المستخدم مسجّل مسبقاً."))
        return value

    def create(self, validated_data):
        courses = validated_data.pop("assigned_courses", [])
        user_data = {
            "username":  validated_data.pop("username"),
            "full_name": validated_data.pop("full_name"),
            "email":     validated_data.pop("email", ""),
            "phone":     validated_data.pop("phone", ""),
            "role":      CustomUser.Roles.LECTURE_SUPERVISOR,
            "is_staff":  False,
        }
        password = validated_data.pop("password")
        user = CustomUser.objects.create_user(password=password, **user_data)
        profile = LectureSupervisorProfile.objects.create(user=user, **validated_data)
        if courses:
            profile.assigned_courses.set(courses)
        return user
