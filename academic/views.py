"""
================================================================================
academic/views.py
================================================================================
Views الكاملة للهيكل الأكاديمي

مسارات الإدارة (Admin):  Level, Grade, Course, Unit, Lesson, Exercise CRUD
مسارات الطالب (Student): الكورسات المتاحة، محتوى الوحدة، تسليم التمارين
================================================================================
"""

import re

from django.http import HttpResponse, HttpResponseBadRequest
from django.utils.translation import gettext_lazy as _
from django.views import View
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import CustomUser
from accounts.permissions import (
    IsAdminOrManager, IsAdminOrReadOnly, IsStudent, IsLectureSupervisor,
    LectureWritePermission, LectureSubContentPermission,
)
from .models import (
    Level, Grade, Course, Unit, Lesson,
    Exercise, Question, Choice,
    Submission, StudentCourseAccess, LessonProgress,
)
from .access import accessible_course_ids, can_access_course
from .serializers import (
    LevelSerializer,
    GradeSerializer, GradeListSerializer,
    CourseSerializer, CourseListSerializer,
    UnitSerializer,
    LessonSerializer, LessonListSerializer,
    StudentCourseSerializer, StudentLessonSerializer,
    ExerciseSerializer, ExerciseStudentSerializer,
    StudentCourseAccessSerializer,
    SubmissionCreateSerializer, SubmissionSerializer,
    LessonProgressSerializer,
    QuestionSerializer, ChoiceSerializer,
)

# ── Live Podcast serializer (inline — reuses LessonListSerializer with course context) ──
from rest_framework import serializers as drf_serializers


# ─────────────────────────────────────────────────────────────────────────────
# 1. Level — المراحل
# ─────────────────────────────────────────────────────────────────────────────

class LevelListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/academic/levels/      — قائمة المراحل (متاح لجميع المُصادَق عليهم)
    POST /api/academic/levels/      — إنشاء مرحلة (الإدارة فقط)
    """

    serializer_class   = LevelSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Level.objects.prefetch_related("grades").order_by("display_order")
        st = self.request.query_params.get("system_type")
        if st:
            qs = qs.filter(system_type=st)
        return qs


class LevelDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/academic/levels/<id>/"""

    queryset           = Level.objects.prefetch_related("grades")
    serializer_class   = LevelSerializer
    permission_classes = [IsAdminOrReadOnly]

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Grade — الفصول
# ─────────────────────────────────────────────────────────────────────────────

class GradeListCreateView(generics.ListCreateAPIView):
    """GET /api/academic/grades/ | POST"""

    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Grade.objects.select_related("level").prefetch_related("courses")
        level_id = self.request.query_params.get("level")
        st = self.request.query_params.get("system_type")
        if level_id:
            qs = qs.filter(level_id=level_id)
        if st:
            qs = qs.filter(system_type=st)
        return qs.order_by("level__display_order", "display_order")

    def get_serializer_class(self):
        return GradeSerializer if self.request.method == "GET" else GradeListSerializer


class GradeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/academic/grades/<id>/"""

    queryset           = Grade.objects.select_related("level").prefetch_related("courses")
    serializer_class   = GradeSerializer
    permission_classes = [IsAdminOrReadOnly]

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Course — الكورسات
# ─────────────────────────────────────────────────────────────────────────────

class CourseListCreateView(generics.ListCreateAPIView):
    """GET /api/academic/courses/ | POST"""

    def get_permissions(self):
        """
        GET: مدير + أستاذ + مشرف الكورسات (read-only)
        POST/PATCH/DELETE: مدير فقط
        """
        from rest_framework.permissions import IsAuthenticated
        from accounts.models import CustomUser
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            # All authenticated staff (including lecture_supervisor) can read
            return [IsAuthenticated()]
        return [IsAdminOrReadOnly()]

    def get_queryset(self):
        qs = Course.objects.select_related("grade__level", "teacher").prefetch_related("units")
        # فلترة حسب الفصل أو المرحلة
        grade_id = self.request.query_params.get("grade")
        level_id = self.request.query_params.get("level")
        st = self.request.query_params.get("system_type")
        if grade_id:
            qs = qs.filter(grade_id=grade_id)
        if level_id:
            qs = qs.filter(grade__level_id=level_id)
        if st:
            qs = qs.filter(system_type=st)
        return qs.order_by("grade__display_order", "display_order")

    def get_serializer_class(self):
        if self.request.method == "GET":
            return CourseListSerializer
        return CourseSerializer


class CourseDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/academic/courses/<id>/"""

    queryset = Course.objects.select_related("grade__level", "teacher").prefetch_related(
        "units__lessons"
    )
    serializer_class   = CourseSerializer

    def get_permissions(self):
        """
        GET: جميع المصادق عليهم (شامل مشرف الكورسات)
        POST/PATCH/DELETE: مدير فقط
        """
        from rest_framework.permissions import IsAuthenticated
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [IsAuthenticated()]
        return [IsAdminOrReadOnly()]

    def get_serializer_class(self):
        """
        الطالب يقرأ بنسخة الطالب: CourseSerializer يُضمّن youtube_url الخام في
        كل محاضرة، وهذه الواجهة مفتوحة لكل مصادَق عليه — فكان طلب واحد يعيد
        روابط كل محاضرات الكورس لأي طالب يصل إليها، وهو ما تمنعه واجهات
        my-courses أصلاً.

        الوصول لا يتغيّر: من كان يقرأ يبقى يقرأ. يسقط youtube_url وحده، وتطبيق
        الموبايل يقرأ ‎youtube_url || youtube_embed_url‎ فيسقط تلقائياً على
        embed_url دون تعديل.
        """
        user = getattr(self.request, "user", None)

        if (
            self.request.method in ("GET", "HEAD", "OPTIONS")
            and getattr(user, "role", None) == CustomUser.Roles.STUDENT
        ):
            return StudentCourseSerializer

        return CourseSerializer

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Unit — الوحدات
# ─────────────────────────────────────────────────────────────────────────────

class UnitListCreateView(generics.ListCreateAPIView):
    """GET /api/academic/units/?course=<id> | POST"""

    serializer_class   = UnitSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Unit.objects.select_related("course").prefetch_related("lessons")
        course_id = self.request.query_params.get("course")
        if course_id:
            qs = qs.filter(course_id=course_id)
        return qs.order_by("course__display_order", "display_order")


class UnitDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/academic/units/<id>/"""

    queryset           = Unit.objects.select_related("course").prefetch_related("lessons")
    serializer_class   = UnitSerializer
    permission_classes = [IsAdminOrReadOnly]

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# 5. Lesson — المحاضرات
# ─────────────────────────────────────────────────────────────────────────────

class LectureScopeMixin:
    """
    يحصر مشرف الكورسات في الكورسات المخصصة له.

    assigned_courses تصف "الكورسات التي يملك هذا المشرف صلاحية إدارة
    محاضراتها"، والواجهة تخبره بذلك، لكن الحصر لم يكن مطبَّقاً: كان أي
    مشرف يقرأ ويعدّل محاضرات أي كورس في النظام.

    كل view يعلن course_lookup: مسار العلاقة من موديله إلى الكورس. يشمل
    الحصر التمارين والأسئلة والخيارات أيضاً، وإلا صار تعديل تمرين محاضرةٍ
    التفافاً على حصر المحاضرة نفسها.

    بقية الأدوار (مدير / مانجر / أستاذ) غير محصورة هنا.
    """

    #: مسار الفلترة من موديل الـ view إلى معرّف الكورس
    course_lookup = "unit__course_id__in"

    @staticmethod
    def assigned_course_ids(user):
        """
        معرّفات الكورسات المخصصة للمشرف، أو None إذا كان الدور غير محصور.
        قائمة فارغة تعني مشرفاً بلا تخصيص: لا يرى شيئاً ولا يكتب شيئاً.
        """
        if not (user and user.is_authenticated):
            return []
        if user.role != CustomUser.Roles.LECTURE_SUPERVISOR:
            return None
        profile = getattr(user, "lecture_supervisor_profile", None)
        if profile is None:
            return []
        return profile.get_assigned_course_ids()

    def scope_to_assigned(self, qs):
        ids = self.assigned_course_ids(self.request.user)
        if ids is None:
            return qs
        return qs.filter(**{self.course_lookup: ids})

    def require_in_scope(self, model, course_lookup, message, **lookup):
        """
        يرفض الكتابة على كائن خارج نطاق المشرف.

        course_lookup هو مسار العلاقة من `model` إلى الكورس — يختلف عن
        course_lookup الخاص بالـ view لأن الكائن المفحوص هو الأب لا الابن.
        لا أثر لهذه الدالة على الأدوار غير المحصورة.
        """
        ids = self.assigned_course_ids(self.request.user)
        if ids is None:
            return
        if not model.objects.filter(**lookup, **{course_lookup: ids}).exists():
            raise PermissionDenied(message)


class LessonListCreateView(LectureScopeMixin, generics.ListCreateAPIView):
    """
    GET  /api/academic/lessons/?unit=<id> — قائمة المحاضرات
      • الإدارة + الأساتذة: كل المحاضرات
      • مشرف الكورسات: محاضرات كورساته المخصصة فقط
    POST /api/academic/lessons/            — إنشاء محاضرة
      • الإدارة + الأساتذة + مشرفو الكورسات (كل ضمن نطاقه)
    """

    permission_classes = [LectureWritePermission]

    def get_queryset(self):
        qs = Lesson.objects.select_related("unit__course").prefetch_related(
            "exercise__questions__choices"
        )
        unit_id = self.request.query_params.get("unit")
        if unit_id:
            qs = qs.filter(unit_id=unit_id)

        return self.scope_to_assigned(qs).order_by("display_order")

    def create(self, request, *args, **kwargs):
        """يرفض إضافة محاضرة لكورس خارج نطاق المشرف."""
        self.require_in_scope(
            Unit, "course_id__in",
            _("لا تملك صلاحية إضافة محاضرات لهذا الكورس."),
            pk=request.data.get("unit"),
        )
        return super().create(request, *args, **kwargs)

    def get_serializer_class(self):
        if self.request.method == "GET":
            return LessonListSerializer
        return LessonSerializer


class LessonDetailView(LectureScopeMixin, generics.RetrieveUpdateDestroyAPIView):
    """
    GET   /api/academic/lessons/<id>/  — عرض محاضرة
    PATCH /api/academic/lessons/<id>/  — تعديل محاضرة
    DELETE /api/academic/lessons/<id>/ — حذف (الإدارة فقط)

    مشرف الكورسات محصور في كورساته المخصصة؛ ما خرج عنها يرجع 404 لا 403
    حتى لا يكشف وجود محاضرات خارج نطاقه.
    """

    serializer_class   = LessonSerializer
    permission_classes = [LectureWritePermission]

    def get_queryset(self):
        qs = Lesson.objects.select_related("unit__course").prefetch_related(
            "exercise__questions__choices"
        )
        return self.scope_to_assigned(qs)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# 6. Exercise — التمارين
# ─────────────────────────────────────────────────────────────────────────────

class ExerciseCreateView(LectureScopeMixin, generics.CreateAPIView):
    """
    POST /api/academic/exercises/ — إنشاء تمرين لمحاضرة

    التمرين جزء من المحاضرة، فيتبع صلاحياتها: الإدارة والأستاذ ومشرف
    الكورسات ينشئون، والمشرف محصور في كورساته المخصصة.
    """

    serializer_class   = ExerciseSerializer
    permission_classes = [LectureWritePermission]

    def create(self, request, *args, **kwargs):
        self.require_in_scope(
            Lesson, "unit__course_id__in",
            _("لا تملك صلاحية إضافة تمارين لهذه المحاضرة."),
            pk=request.data.get("lesson"),
        )
        return super().create(request, *args, **kwargs)


class ExerciseDetailView(LectureScopeMixin, generics.RetrieveUpdateDestroyAPIView):
    """
    GET / PATCH / DELETE /api/academic/exercises/<id>/

    الحذف للإدارة وحدها (LectureWritePermission.DELETE_ROLES).
    """

    serializer_class   = ExerciseSerializer
    permission_classes = [LectureWritePermission]
    course_lookup      = "lesson__unit__course_id__in"

    def get_queryset(self):
        return self.scope_to_assigned(
            Exercise.objects.prefetch_related("questions__choices")
        )

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class QuestionListCreateView(LectureScopeMixin, generics.ListCreateAPIView):
    """GET /api/academic/exercises/<exercise_id>/questions/ | POST"""

    serializer_class   = QuestionSerializer
    permission_classes = [LectureWritePermission]
    course_lookup      = "exercise__lesson__unit__course_id__in"

    def get_queryset(self):
        qs = Question.objects.filter(
            exercise_id=self.kwargs["exercise_id"]
        ).prefetch_related("choices")
        return self.scope_to_assigned(qs).order_by("display_order")

    def create(self, request, *args, **kwargs):
        self.require_in_scope(
            Exercise, "lesson__unit__course_id__in",
            _("لا تملك صلاحية إضافة أسئلة لهذا التمرين."),
            pk=self.kwargs["exercise_id"],
        )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(exercise_id=self.kwargs["exercise_id"])


class ChoiceListCreateView(LectureScopeMixin, generics.ListCreateAPIView):
    """GET /api/academic/questions/<question_id>/choices/ | POST"""

    serializer_class   = ChoiceSerializer
    permission_classes = [LectureWritePermission]
    course_lookup      = "question__exercise__lesson__unit__course_id__in"

    def get_queryset(self):
        qs = Choice.objects.filter(question_id=self.kwargs["question_id"])
        return self.scope_to_assigned(qs).order_by("display_order")

    def create(self, request, *args, **kwargs):
        self.require_in_scope(
            Question, "exercise__lesson__unit__course_id__in",
            _("لا تملك صلاحية إضافة خيارات لهذا السؤال."),
            pk=self.kwargs["question_id"],
        )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(question_id=self.kwargs["question_id"])


class QuestionDetailView(LectureScopeMixin, generics.RetrieveUpdateDestroyAPIView):
    """
    GET / PATCH / DELETE /api/academic/questions/<id>/

    لم يكن هذا المسار موجوداً: كانت الأسئلة تُنشأ ولا تُعدَّل ولا تُحذف،
    بينما لوحة التحكم تنادي DELETE عليه فتحصل على 404.
    """

    serializer_class   = QuestionSerializer
    permission_classes = [LectureSubContentPermission]
    course_lookup      = "exercise__lesson__unit__course_id__in"

    def get_queryset(self):
        return self.scope_to_assigned(
            Question.objects.prefetch_related("choices")
        )

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class ChoiceDetailView(LectureScopeMixin, generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/academic/choices/<id>/"""

    serializer_class   = ChoiceSerializer
    permission_classes = [LectureSubContentPermission]
    course_lookup      = "question__exercise__lesson__unit__course_id__in"

    def get_queryset(self):
        return self.scope_to_assigned(Choice.objects.all())

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# 7. StudentCourseAccess — منح وصول الكورسات يدوياً (للإدارة)
# ─────────────────────────────────────────────────────────────────────────────

class StudentCourseAccessListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/academic/access/         — قائمة الوصول الممنوحة
    POST /api/academic/access/         — منح وصول يدوياً (لطالب FLASH)
    """

    serializer_class   = StudentCourseAccessSerializer
    permission_classes = [IsAdminOrManager]

    def get_queryset(self):
        qs = StudentCourseAccess.objects.select_related(
            "student__user", "course", "granted_by"
        ).filter(student__system_type="flash")
        student_id = self.request.query_params.get("student")
        course_id  = self.request.query_params.get("course")
        if student_id:
            qs = qs.filter(student_id=student_id)
        if course_id:
            qs = qs.filter(course_id=course_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(granted_by=self.request.user)

    def create(self, request, *args, **kwargs):
        """
        منح الوصول يُعيد تفعيل صفٍّ معطّل بدل أن يفشل.

        القيد ‎unique_together(student, course)‎ يعني أن تعطيل وصول ثم محاولة
        منحه مجدداً كانت تُرفض بخطأ "موجود مسبقاً": فالمدير يعطّل الكورس، ثم
        لا يستطيع إعادته، ولا يرى سبباً مفهوماً. الصفّ المعطّل يُعاد تفعيله
        ويُسجَّل مانحه الجديد.
        """
        student_id = request.data.get("student")
        course_id  = request.data.get("course")

        existing = StudentCourseAccess.objects.filter(
            student_id=student_id, course_id=course_id,
        ).first() if student_id and course_id else None

        if existing is None:
            return super().create(request, *args, **kwargs)

        existing.is_active  = True
        existing.granted_by = request.user
        existing.save(update_fields=["is_active", "granted_by"])

        return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)


class StudentCourseAccessDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET / PATCH / DELETE /api/academic/access/<id>/

    PATCH يعطّل الوصول ويُبقي السجل، وDELETE يمحوه من سجل الطالب نهائياً.
    الاثنان متاحان للإدارة عمداً: التعطيل يُوقف الوصول مع بقاء الأثر، والحذف
    لمن سُجّل خطأً أصلاً.
    """

    queryset           = StudentCourseAccess.objects.all()
    serializer_class   = StudentCourseAccessSerializer
    permission_classes = [IsAdminOrManager]

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# 8. Student Endpoints — واجهات الطالب
# ─────────────────────────────────────────────────────────────────────────────

class MyCoursesView(APIView):
    """
    GET /api/academic/my-courses/
    يُعيد الكورسات المتاحة للطالب المسجّل بناءً على StudentCourseAccess.
    """

    permission_classes = [IsStudent]

    def get(self, request):
        student = request.user.student_profile

        courses = (
            Course.objects
            .filter(id__in=accessible_course_ids(student))
            .select_related("grade__level", "teacher")
            .prefetch_related("units__lessons")
            .order_by("grade__display_order", "display_order")
        )

        serializer = StudentCourseSerializer(courses, many=True)
        return Response(serializer.data)


class MyCourseDetailView(APIView):
    """
    GET /api/academic/my-courses/<course_id>/
    يُعيد محتوى كورس محدد إذا كان الطالب يملك وصولاً إليه.
    """

    permission_classes = [IsStudent]

    def get(self, request, course_id):
        student = request.user.student_profile

        if not can_access_course(student, course_id):
            return Response(
                {"detail": _("ليس لديك صلاحية الوصول لهذا الكورس.")},
                status=status.HTTP_403_FORBIDDEN,
            )
        course = Course.objects.prefetch_related(
            "units__lessons__exercise__questions__choices"
        ).get(pk=course_id)
        return Response(StudentCourseSerializer(course).data)


class MyLessonDetailView(APIView):
    """
    GET /api/academic/my-lessons/<lesson_id>/
    يُعيد محتوى المحاضرة ويُسجّل المشاهدة في LessonProgress.
    """

    permission_classes = [IsStudent]

    def get(self, request, lesson_id):
        student = request.user.student_profile

        try:
            lesson = Lesson.objects.select_related(
                "unit__course"
            ).prefetch_related(
                "exercise__questions__choices"
            ).get(pk=lesson_id, is_active=True)
        except Lesson.DoesNotExist:
            return Response(
                {"detail": _("المحاضرة غير موجودة.")},
                status=status.HTTP_404_NOT_FOUND,
            )

        # التحقق من وصول الطالب للكورس
        if not can_access_course(student, lesson.unit.course_id):
            return Response(
                {"detail": _("ليس لديك صلاحية الوصول لهذه المحاضرة.")},
                status=status.HTTP_403_FORBIDDEN,
            )

        # تسجيل/تحديث LessonProgress
        LessonProgress.objects.get_or_create(student=student, lesson=lesson)

        # إعادة بيانات المحاضرة مع التمرين بدون is_correct
        data = StudentLessonSerializer(lesson).data
        # استبدال التمرين بالنسخة الآمنة للطالب
        # المحاضرة قد لا تملك تمريناً — الوصول المباشر للعلاقة العكسية
        # OneToOne يرمي RelatedObjectDoesNotExist لا None.
        exercise = getattr(lesson, "exercise", None)
        if exercise:
            data["exercise"] = ExerciseStudentSerializer(exercise).data

        return Response(data)


class MarkLessonCompleteView(APIView):
    """
    POST /api/academic/my-lessons/<lesson_id>/complete/
    يُعلّم المحاضرة كمكتملة.
    """

    permission_classes = [IsStudent]

    def post(self, request, lesson_id):
        student = request.user.student_profile
        try:
            progress = LessonProgress.objects.get(student=student, lesson_id=lesson_id)
        except LessonProgress.DoesNotExist:
            return Response(
                {"detail": _("لم تُشاهَد هذه المحاضرة بعد.")},
                status=status.HTTP_400_BAD_REQUEST,
            )
        progress.mark_complete()
        return Response({"detail": _("تم تسجيل اكتمال المحاضرة.")})


class SubmitExerciseView(APIView):
    """
    POST /api/academic/submit/
    يُسلّم الطالب إجاباته ويُعيد الدرجة والنتيجة التفصيلية.
    """

    permission_classes = [IsStudent]

    def post(self, request):
        serializer = SubmissionCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        submission = serializer.save()
        return Response(
            SubmissionSerializer(submission).data,
            status=status.HTTP_201_CREATED,
        )


class MySubmissionsView(APIView):
    """
    GET /api/academic/my-submissions/?exercise=<id>
    يُعيد تسليمات الطالب الحالي مع النتائج.
    """

    permission_classes = [IsStudent]

    def get(self, request):
        student = request.user.student_profile
        qs = Submission.objects.filter(student=student).select_related(
            "exercise__lesson"
        ).prefetch_related("answers__selected_choice__question")

        exercise_id = request.query_params.get("exercise")
        if exercise_id:
            qs = qs.filter(exercise_id=exercise_id)

        return Response(SubmissionSerializer(qs.order_by("-submitted_at"), many=True).data)


class AllSubmissionsView(generics.ListAPIView):
    """
    GET /api/academic/submissions/ — كل التسليمات للإدارة والأساتذة
    """

    serializer_class   = SubmissionSerializer
    permission_classes = [IsAdminOrManager]

    def get_queryset(self):
        qs = Submission.objects.select_related(
            "student__user", "exercise__lesson"
        ).prefetch_related("answers")
        student_id  = self.request.query_params.get("student")
        exercise_id = self.request.query_params.get("exercise")
        if student_id:
            qs = qs.filter(student_id=student_id)
        if exercise_id:
            qs = qs.filter(exercise_id=exercise_id)
        return qs.order_by("-submitted_at")


class MyProgressView(APIView):
    """
    GET /api/academic/my-progress/
    يُعيد تقدم الطالب في جميع محاضراته.
    """

    permission_classes = [IsStudent]

    def get(self, request):
        student = request.user.student_profile
        progresses = LessonProgress.objects.filter(student=student).select_related("lesson")
        return Response(LessonProgressSerializer(progresses, many=True).data)


class LessonPlayerView(View):
    """
    GET /api/academic/player/?v=<video_id>

    صفحة صغيرة تحتوي iframe اليوتيوب، تُخدَّم من نطاق المدرسة.

    عميل الديسكتوب كان يفتح رابط ‎/embed/‎ مباشرةً في الـ WebView، ويوتيوب يردّ
    على ذلك بـ Error 153 — فالرابط مُعدّ ليُحمَّل داخل iframe في صفحة، لا أن
    يُنتقَل إليه كمستند أعلى. التطبيقان الآخران يفعلان الصحيح أصلاً: الويب
    يستخدم iframe داخل صفحة الموقع، والموبايل يمرّر HTML مع
    ‎baseUrl: 'https://numberoneschools.com'‎.

    تُخدَّم من الخادم لا من نص HTML محلي حتى يكون الأصل (origin) والمُحيل
    (referer) نطاق المدرسة فعلاً على ويندوز وماك معاً، بدل about:blank.

    عامة بلا مصادقة: لا تكشف شيئاً — معرّف الفيديو يصل العميل أصلاً، والصفحة
    لا تقرأ قاعدة البيانات.
    """

    #: معرّفات يوتيوب: حروف وأرقام وشرطتان. أي شيء آخر يُرفَض بدل أن يُطبَع.
    VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{6,20}$")

    TEMPLATE = (
        "<!doctype html><html><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        "<style>html,body{{margin:0;height:100%;background:#0B0F16;overflow:hidden}}"
        "iframe{{border:0;width:100%;height:100%;display:block}}</style></head>"
        "<body oncontextmenu=\"return false\">"
        "<iframe src=\"https://www.youtube.com/embed/{video_id}?modestbranding=1&amp;rel=0\""
        " allow=\"accelerometer; autoplay; encrypted-media; picture-in-picture\""
        " referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>"
        "</body></html>"
    )

    def get(self, request):
        video_id = request.GET.get("v", "")

        if not self.VIDEO_ID.match(video_id):
            return HttpResponseBadRequest("invalid video id")

        response = HttpResponse(self.TEMPLATE.format(video_id=video_id))

        # الصفحة تُضمّن iframe من يوتيوب فقط؛ لا تُضمَّن هي في أي مكان آخر.
        response["X-Frame-Options"] = "SAMEORIGIN"
        return response


# ─────────────────────────────────────────────────────────────────────────────
# Public Endpoints — صفحة التسجيل العامة (بدون مصادقة)
# ─────────────────────────────────────────────────────────────────────────────

class PublicLevelListView(generics.ListAPIView):
    """
    GET /api/academic/levels/public/
    يُعيد قائمة المراحل الدراسية النشطة للزوار غير المُسجَّلين
    (يُستخدم في صفحة تسجيل الطلاب الجديدة).
    """

    serializer_class   = LevelSerializer
    permission_classes = [AllowAny]
    pagination_class   = None

    def get_queryset(self):
        qs = Level.objects.filter(is_active=True).order_by("display_order", "name")
        st = self.request.query_params.get("system_type")
        if st:
            qs = qs.filter(system_type=st)
        return qs


class PublicGradeListView(generics.ListAPIView):
    """
    GET /api/academic/grades/public/?level=<id>
    يُعيد قائمة الفصول/الصفوف النشطة للزوار غير المُسجَّلين.
    يدعم الفلترة بالمرحلة (level) ونوع النظام (system_type).
    """

    serializer_class   = GradeSerializer
    permission_classes = [AllowAny]
    pagination_class   = None

    def get_queryset(self):
        qs = Grade.objects.filter(is_active=True).select_related("level").order_by(
            "level__display_order", "display_order", "name"
        )
        level_id = self.request.query_params.get("level")
        st       = self.request.query_params.get("system_type")
        if level_id:
            qs = qs.filter(level_id=level_id)
        if st:
            qs = qs.filter(system_type=st)
        return qs
