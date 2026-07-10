"""
================================================================================
academic/serializers.py
================================================================================
"""

from rest_framework import serializers
from .models import (
    Level, Grade, Course, Unit, Lesson,
    Exercise, Question, Choice,
    Submission, SubmissionAnswer, LessonProgress,
    StudentCourseAccess,
)


# ─────────────────────────────────────────────────────────────────────────────
# الهيكل الهرمي — قراءة
# ─────────────────────────────────────────────────────────────────────────────

class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Choice
        fields = ["id", "text", "display_order", "is_correct"]
        # is_correct مخفية عن الطلاب — تُكشف بعد التسليم فقط
        # الفرز يتم في View


class ChoiceStudentSerializer(serializers.ModelSerializer):
    """للطالب عند حل التمرين: تخفي is_correct."""

    class Meta:
        model  = Choice
        fields = ["id", "text", "display_order"]


class QuestionSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, read_only=True)

    class Meta:
        model  = Question
        fields = ["id", "text", "marks", "display_order", "image", "choices"]


class QuestionStudentSerializer(serializers.ModelSerializer):
    """للطلاب: بدون is_correct في الخيارات."""
    choices = ChoiceStudentSerializer(many=True, read_only=True)

    class Meta:
        model  = Question
        fields = ["id", "text", "marks", "display_order", "image", "choices"]


class ExerciseSerializer(serializers.ModelSerializer):
    questions   = QuestionSerializer(many=True, read_only=True)
    total_marks = serializers.FloatField(read_only=True)

    class Meta:
        model  = Exercise
        fields = [
            "id", "lesson", "title", "instructions", "max_attempts",
            "pass_percentage", "is_active", "total_marks", "questions",
        ]


class ExerciseStudentSerializer(serializers.ModelSerializer):
    """للطلاب: بدون is_correct."""
    questions   = QuestionStudentSerializer(many=True, read_only=True)
    total_marks = serializers.FloatField(read_only=True)

    class Meta:
        model  = Exercise
        fields = [
            "id", "title", "instructions", "max_attempts",
            "pass_percentage", "total_marks", "questions",
        ]


class LessonSerializer(serializers.ModelSerializer):
    youtube_embed_url  = serializers.CharField(read_only=True)
    exercise           = ExerciseSerializer(read_only=True)

    class Meta:
        model  = Lesson
        fields = [
            "id", "unit", "title", "description", "youtube_url", "youtube_embed_url",
            "pdf_file", "display_order", "duration_minutes",
            "is_active", "exercise",
        ]


class LessonListSerializer(serializers.ModelSerializer):
    """ملخص مختصر للمحاضرة في القوائم (بدون exercise)."""
    youtube_embed_url = serializers.CharField(read_only=True)

    class Meta:
        model  = Lesson
        fields = [
            "id", "title", "youtube_url", "youtube_embed_url",
            "pdf_file", "display_order", "duration_minutes", "is_active",
        ]


class UnitSerializer(serializers.ModelSerializer):
    lessons = LessonListSerializer(many=True, read_only=True)

    class Meta:
        model  = Unit
        fields = ["id", "course", "name", "display_order", "is_active", "lessons"]


class CourseSerializer(serializers.ModelSerializer):
    units        = UnitSerializer(many=True, read_only=True)
    teacher_name = serializers.CharField(
        source="teacher.full_name", read_only=True, default=None
    )
    grade_name   = serializers.CharField(source="grade.__str__", read_only=True)

    class Meta:
        model  = Course
        fields = [
            "id", "name", "description", "grade", "grade_name",
            "teacher", "teacher_name", "thumbnail",
            "display_order", "is_active", "units", "system_type",
        ]


class CourseListSerializer(serializers.ModelSerializer):
    """ملخص مختصر للكورس في القوائم."""
    teacher_name = serializers.CharField(
        source="teacher.full_name", read_only=True, default=None
    )
    grade_name   = serializers.CharField(source="grade.__str__", read_only=True)
    lesson_count = serializers.SerializerMethodField()

    class Meta:
        model  = Course
        fields = [
            "id", "name", "grade", "grade_name",
            "teacher_name", "thumbnail", "is_active", "system_type",
            "lesson_count",
        ]

    def get_lesson_count(self, obj):
        """إجمالي عدد المحاضرات في جميع وحدات الكورس."""
        return Lesson.objects.filter(unit__course=obj, is_active=True).count()


class GradeSerializer(serializers.ModelSerializer):
    courses    = CourseListSerializer(many=True, read_only=True)
    level_name = serializers.CharField(source="level.name", read_only=True)

    class Meta:
        model  = Grade
        fields = ["id", "name", "level", "level_name", "display_order", "is_active", "courses", "system_type"]


class GradeListSerializer(serializers.ModelSerializer):
    level_name = serializers.CharField(source="level.name", read_only=True)

    class Meta:
        model  = Grade
        fields = ["id", "name", "level", "level_name", "display_order", "is_active", "system_type"]


class LevelSerializer(serializers.ModelSerializer):
    grades = GradeListSerializer(many=True, read_only=True)

    class Meta:
        model  = Level
        fields = ["id", "name", "description", "display_order", "is_active", "grades", "system_type"]


# ─────────────────────────────────────────────────────────────────────────────
# StudentCourseAccess
# ─────────────────────────────────────────────────────────────────────────────

class StudentCourseAccessSerializer(serializers.ModelSerializer):
    course_name  = serializers.CharField(source="course.name", read_only=True)
    student_name = serializers.CharField(
        source="student.user.full_name", read_only=True
    )

    class Meta:
        model  = StudentCourseAccess
        fields = [
            "id", "student", "student_name", "course", "course_name",
            "granted_at", "granted_by", "is_active",
        ]
        read_only_fields = ["id", "granted_at", "student_name", "course_name"]


# ─────────────────────────────────────────────────────────────────────────────
# التسليمات
# ─────────────────────────────────────────────────────────────────────────────

class SubmissionAnswerCreateSerializer(serializers.Serializer):
    """إجابة مفردة عند التسليم."""
    question_id = serializers.IntegerField()
    choice_id   = serializers.IntegerField(allow_null=True)


class SubmissionCreateSerializer(serializers.Serializer):
    """
    تسليم التمرين من قِبَل الطالب.
    يتحقق من صحة الأسئلة والخيارات قبل الحفظ.
    """

    exercise_id = serializers.IntegerField()
    answers     = SubmissionAnswerCreateSerializer(many=True)

    def validate(self, attrs):
        exercise_id = attrs["exercise_id"]
        try:
            exercise = Exercise.objects.prefetch_related("questions__choices").get(
                pk=exercise_id, is_active=True
            )
        except Exercise.DoesNotExist:
            raise serializers.ValidationError(
                {"exercise_id": "التمرين غير موجود أو غير نشط."}
            )

        attrs["exercise"] = exercise

        # التحقق من أن كل سؤال ينتمي للتمرين
        question_ids = {q.id for q in exercise.questions.all()}
        for ans in attrs["answers"]:
            if ans["question_id"] not in question_ids:
                raise serializers.ValidationError(
                    {"answers": f"السؤال {ans['question_id']} لا ينتمي لهذا التمرين."}
                )
        return attrs

    def create(self, validated_data):
        from accounts.models import StudentProfile

        student   = self.context["request"].user.student_profile
        exercise  = validated_data["exercise"]
        answers   = validated_data["answers"]

        # رقم المحاولة
        attempt_number = (
            Submission.objects.filter(student=student, exercise=exercise).count() + 1
        )

        submission = Submission.objects.create(
            student=student,
            exercise=exercise,
            attempt_number=attempt_number,
        )

        for ans in answers:
            choice = None
            if ans["choice_id"]:
                try:
                    choice = Choice.objects.get(
                        pk=ans["choice_id"],
                        question_id=ans["question_id"],
                    )
                except Choice.DoesNotExist:
                    pass

            SubmissionAnswer.objects.create(
                submission=submission,
                question_id=ans["question_id"],
                selected_choice=choice,
            )

        # احتساب الدرجة
        submission.calculate_score()
        return submission


class SubmissionAnswerResultSerializer(serializers.ModelSerializer):
    """نتيجة إجابة مفردة — تظهر بعد التسليم."""
    question_text  = serializers.CharField(source="question.text", read_only=True)
    selected_text  = serializers.CharField(
        source="selected_choice.text", read_only=True, default=None
    )
    correct_choice = serializers.SerializerMethodField()
    is_correct     = serializers.BooleanField(read_only=True)

    class Meta:
        model  = SubmissionAnswer
        fields = [
            "question_text", "selected_text",
            "is_correct", "correct_choice",
        ]

    def get_correct_choice(self, obj):
        correct = obj.question.choices.filter(is_correct=True).first()
        return correct.text if correct else None


class SubmissionSerializer(serializers.ModelSerializer):
    answers      = SubmissionAnswerResultSerializer(many=True, read_only=True)
    student_name = serializers.CharField(
        source="student.user.full_name", read_only=True
    )
    exercise_title = serializers.CharField(
        source="exercise.title", read_only=True
    )

    class Meta:
        model  = Submission
        fields = [
            "id", "student", "student_name", "exercise", "exercise_title",
            "score", "percentage", "is_passed",
            "attempt_number", "submitted_at", "answers",
        ]
        read_only_fields = fields


# ─────────────────────────────────────────────────────────────────────────────
# LessonProgress
# ─────────────────────────────────────────────────────────────────────────────

class LessonProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model  = LessonProgress
        fields = ["id", "lesson", "is_completed", "completed_at", "last_viewed"]
        read_only_fields = ["id", "completed_at", "last_viewed"]
