"""
================================================================================
academic/views.py
================================================================================
Views الكاملة للهيكل الأكاديمي

مسارات الإدارة (Admin):  Level, Grade, Course, Unit, Lesson, Exercise CRUD
مسارات الطالب (Student): الكورسات المتاحة، محتوى الوحدة، تسليم التمارين
================================================================================
"""

from django.utils.translation import gettext_lazy as _
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminOrManager, IsAdminOrReadOnly, IsStudent, LectureWritePermission, IsLectureSupervisor
from .models import (
    Level, Grade, Course, Unit, Lesson,
    Exercise, Question, Choice,
    Submission, StudentCourseAccess, LessonProgress,
)
from .serializers import (
    LevelSerializer,
    GradeSerializer, GradeListSerializer,
    CourseSerializer, CourseListSerializer,
    UnitSerializer,
    LessonSerializer, LessonListSerializer,
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

class LessonListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/academic/lessons/?unit=<id> — قائمة المحاضرات
      • الإدارة + الأساتذة + مشرفو المحاضرات: يرون نتائج (مفلترة)
    POST /api/academic/lessons/            — إنشاء محاضرة
      • الإدارة + مشرفو المحاضرات (للكورسات المخصصة فقط)
    """

    permission_classes = [LectureWritePermission]

    def get_queryset(self):
        from accounts.models import CustomUser
        qs = Lesson.objects.select_related("unit__course").prefetch_related(
            "exercise__questions__choices"
        )
        unit_id = self.request.query_params.get("unit")
        if unit_id:
            qs = qs.filter(unit_id=unit_id)

        # مشرف الكورسات: يرى جميع المحاضرات (بدون فلتر)
        return qs.order_by("display_order")

    def create(self, request, *args, **kwargs):
        """\u0645شرف الكورسات يستطيع إضافة محاضرات لأي كورس في النظام."""
        return super().create(request, *args, **kwargs)

    def get_serializer_class(self):
        if self.request.method == "GET":
            return LessonListSerializer
        return LessonSerializer


class LessonDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET   /api/academic/lessons/<id>/  — عرض محاضرة
    PATCH /api/academic/lessons/<id>/  — تعديل محاضرة
    DELETE /api/academic/lessons/<id>/ — حذف (الإدارة فقط)
    """

    queryset = Lesson.objects.select_related("unit__course").prefetch_related(
        "exercise__questions__choices"
    )
    serializer_class   = LessonSerializer
    permission_classes = [LectureWritePermission]

    def get_object(self):
        """مشرف الكورسات يستطيع الوصول لأي محاضرة في النظام."""
        return super().get_object()

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# 6. Exercise — التمارين
# ─────────────────────────────────────────────────────────────────────────────

class ExerciseCreateView(generics.CreateAPIView):
    """POST /api/academic/exercises/ — إنشاء تمرين لمحاضرة"""

    serializer_class   = ExerciseSerializer
    permission_classes = [IsAdminOrManager]


class ExerciseDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET / PATCH / DELETE /api/academic/exercises/<id>/"""

    queryset = Exercise.objects.prefetch_related("questions__choices")
    serializer_class   = ExerciseSerializer
    permission_classes = [IsAdminOrManager]

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class QuestionListCreateView(generics.ListCreateAPIView):
    """GET /api/academic/exercises/<exercise_id>/questions/ | POST"""

    serializer_class   = QuestionSerializer
    permission_classes = [IsAdminOrManager]

    def get_queryset(self):
        return Question.objects.filter(
            exercise_id=self.kwargs["exercise_id"]
        ).prefetch_related("choices").order_by("display_order")

    def perform_create(self, serializer):
        serializer.save(exercise_id=self.kwargs["exercise_id"])


class ChoiceListCreateView(generics.ListCreateAPIView):
    """GET /api/academic/questions/<question_id>/choices/ | POST"""

    serializer_class   = ChoiceSerializer
    permission_classes = [IsAdminOrManager]

    def get_queryset(self):
        return Choice.objects.filter(
            question_id=self.kwargs["question_id"]
        ).order_by("display_order")

    def perform_create(self, serializer):
        serializer.save(question_id=self.kwargs["question_id"])


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


class StudentCourseAccessDetailView(generics.RetrieveUpdateDestroyAPIView):
    """PATCH /api/academic/access/<id>/ — تفعيل/تعطيل الوصول"""

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
        access_qs = StudentCourseAccess.objects.filter(
            student=student, is_active=True
        ).select_related("course__grade__level", "course__teacher").prefetch_related(
            "course__units__lessons"
        )
        courses = [acc.course for acc in access_qs]
        serializer = CourseSerializer(courses, many=True)
        return Response(serializer.data)


class MyCourseDetailView(APIView):
    """
    GET /api/academic/my-courses/<course_id>/
    يُعيد محتوى كورس محدد إذا كان الطالب يملك وصولاً إليه.
    """

    permission_classes = [IsStudent]

    def get(self, request, course_id):
        student = request.user.student_profile
        try:
            StudentCourseAccess.objects.get(
                student=student, course_id=course_id, is_active=True
            )
        except StudentCourseAccess.DoesNotExist:
            return Response(
                {"detail": _("ليس لديك صلاحية الوصول لهذا الكورس.")},
                status=status.HTTP_403_FORBIDDEN,
            )
        course = Course.objects.prefetch_related(
            "units__lessons__exercise__questions__choices"
        ).get(pk=course_id)
        return Response(CourseSerializer(course).data)


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
        try:
            StudentCourseAccess.objects.get(
                student=student,
                course=lesson.unit.course,
                is_active=True,
            )
        except StudentCourseAccess.DoesNotExist:
            return Response(
                {"detail": _("ليس لديك صلاحية الوصول لهذه المحاضرة.")},
                status=status.HTTP_403_FORBIDDEN,
            )

        # تسجيل/تحديث LessonProgress
        LessonProgress.objects.get_or_create(student=student, lesson=lesson)

        # إعادة بيانات المحاضرة مع التمرين بدون is_correct
        data = LessonSerializer(lesson).data
        # استبدال التمرين بالنسخة الآمنة للطالب
        if lesson.exercise:
            data["exercise"] = ExerciseStudentSerializer(lesson.exercise).data

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


# ──────────────────────────────────────────────────────────────────────────────
# 9. My Live Podcasts — محاضرات البودكاست المباشر للطالب
# ──────────────────────────────────────────────────────────────────────────────

class MyLivePodcastsView(APIView):
    """
    GET /api/academic/my-live-podcasts/
    يُعيد جميع المحاضرات التي تحتوي على رابط بودكاست مباشر صالح
    والطالب لديه صلاحية الوصول إلى الكورس المرتبطة بها.

    الأمان: يحترم قواعد وصول الكورس الحالية (online و flash).
    """

    permission_classes = [IsStudent]

    def get(self, request):
        from accounts.models import StudentProfile
        student = request.user.student_profile

        # حدد الكورسات المتاحة للطالب
        if student.system_type == "online":
            # طالب أونلاين: جميع كورسات فصله
            accessible_course_ids = list(
                Course.objects.filter(
                    grade_id=student.enrolled_grade_id,
                    system_type="online",
                    is_active=True,
                ).values_list("id", flat=True)
            )
        else:
            # طالب فلاش: كورسات محددة عبر StudentCourseAccess
            accessible_course_ids = list(
                StudentCourseAccess.objects.filter(
                    student=student, is_active=True
                ).values_list("course_id", flat=True)
            )

        # جلب المحاضرات ذات رابط بودكاست صالح
        lessons = (
            Lesson.objects.filter(
                unit__course_id__in=accessible_course_ids,
                is_active=True,
            )
            .exclude(live_podcast_url__isnull=True)
            .exclude(live_podcast_url="")
            .select_related("unit__course__grade__level")
            .order_by("-created_at")
        )

        # بناء الاستجابة مع معلومات الكورس والوحدة
        data = [
            {
                "id":                 lesson.id,
                "title":              lesson.title,
                "live_podcast_title": lesson.live_podcast_title or lesson.title,
                "live_podcast_url":   lesson.live_podcast_url,
                "course_id":          lesson.unit.course_id,
                "course_name":        lesson.unit.course.name,
                "unit_name":          lesson.unit.name,
                "created_at":         lesson.created_at.isoformat(),
                "has_live_podcast":   True,
            }
            for lesson in lessons
        ]
        return Response(data)
