"""
================================================================================
exams/serializers.py
================================================================================
Serializers لإدارة الاختبارات — الإنشاء الدفعي والقراءة ومراجعة المحاولات
================================================================================
"""

import base64
import uuid

from rest_framework import serializers
from django.core.files.base import ContentFile
from django.db import transaction

from .models import (
    Exam, ExamQuestion, ExamQuestionOption,
    ExamAttempt, ExamAttemptAnswer,
)


# ─────────────────────────────────────────────────────────────────────────────
# مساعد: تحويل Base64 → ContentFile لحفظه في ImageField
# ─────────────────────────────────────────────────────────────────────────────

def _decode_b64_image(data_uri: str) -> ContentFile:
    """
    تحويل Base64 data URI (مثل: data:image/png;base64,AAA...)
    إلى ContentFile جاهزة للحفظ في ImageField.
    """
    # استخراج الامتداد من content-type
    try:
        header, encoded = data_uri.split(",", 1)
        # header مثل: data:image/jpeg;base64
        mime = header.split(":")[1].split(";")[0]   # image/jpeg
        ext = mime.split("/")[1]                     # jpeg
    except (IndexError, ValueError):
        ext = "jpg"
    image_data = base64.b64decode(encoded)
    filename = f"{uuid.uuid4().hex}.{ext}"
    return ContentFile(image_data, name=filename)


# ─────────────────────────────────────────────────────────────────────────────
# خيارات الأسئلة
# ─────────────────────────────────────────────────────────────────────────────

class ExamQuestionOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamQuestionOption
        fields = ["id", "text", "display_order"]
        read_only_fields = ["id"]


# ─────────────────────────────────────────────────────────────────────────────
# سؤال الاختبار — للقراءة
# ─────────────────────────────────────────────────────────────────────────────

class ExamQuestionReadSerializer(serializers.ModelSerializer):
    options = ExamQuestionOptionSerializer(many=True, read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ExamQuestion
        fields = [
            "id", "question_type", "title", "text", "marks",
            "display_order", "correct_answer", "options", "image_url",
        ]

    def get_image_url(self, obj):
        """إرجاع URL مطلق لصورة السؤال أو None إذا لم توجد صورة."""
        if not obj.image:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url


# ─────────────────────────────────────────────────────────────────────────────
# الاختبار — قراءة تفصيلية
# ─────────────────────────────────────────────────────────────────────────────

class ExamDetailSerializer(serializers.ModelSerializer):
    questions = ExamQuestionReadSerializer(many=True, read_only=True)
    total_marks = serializers.FloatField(read_only=True)
    question_count = serializers.IntegerField(read_only=True)
    course_name = serializers.CharField(source="course.name", read_only=True)
    created_by_name = serializers.CharField(
        source="created_by.full_name", read_only=True, default=None
    )

    class Meta:
        model = Exam
        fields = [
            "id", "course", "course_name", "title",
            "duration_minutes", "passing_score", "is_active",
            "created_by", "created_by_name",
            "created_at", "updated_at",
            "total_marks", "question_count", "questions",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# ─────────────────────────────────────────────────────────────────────────────
# الاختبار — قائمة مختصرة
# ─────────────────────────────────────────────────────────────────────────────

class ExamListSerializer(serializers.ModelSerializer):
    total_marks = serializers.FloatField(read_only=True)
    question_count = serializers.IntegerField(read_only=True)
    course_name = serializers.CharField(source="course.name", read_only=True)
    attempts_count = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = [
            "id", "course", "course_name", "title",
            "duration_minutes", "passing_score", "is_active",
            "total_marks", "question_count", "attempts_count",
            "created_at",
        ]

    def get_attempts_count(self, obj):
        return obj.attempts.count()


# ─────────────────────────────────────────────────────────────────────────────
# الاختبار — إنشاء / تحديث دفعي (Batch)
# ─────────────────────────────────────────────────────────────────────────────

class OptionInputSerializer(serializers.Serializer):
    """خيار مدخل ضمن سؤال."""
    text = serializers.CharField(max_length=500)
    display_order = serializers.IntegerField(default=0)


class QuestionInputSerializer(serializers.Serializer):
    """سؤال مدخل ضمن الاختبار مع خياراته وإجابته الصحيحة."""
    question_type = serializers.ChoiceField(
        choices=ExamQuestion.QuestionType.choices
    )
    title = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    text = serializers.CharField()
    marks = serializers.FloatField(default=1.0)
    display_order = serializers.IntegerField(default=0)
    correct_answer = serializers.JSONField()
    options = OptionInputSerializer(many=True, required=False, default=[])
    # صورة اختيارية مُرسَلة كـ Base64 data URI (مثل: data:image/png;base64,...)
    image = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)


class ExamBatchCreateSerializer(serializers.Serializer):
    """
    إنشاء اختبار كامل دفعة واحدة:
      - بيانات الاختبار الأساسية
      - جميع الأسئلة مع خياراتها وإجاباتها الصحيحة

    يُحفَظ كل شيء داخل Transaction واحدة لضمان سلامة البيانات.
    """

    course = serializers.IntegerField()
    title = serializers.CharField(max_length=255)
    duration_minutes = serializers.IntegerField(default=60)
    passing_score = serializers.FloatField(default=50.0)
    questions = QuestionInputSerializer(many=True)

    def validate_course(self, value):
        from academic.models import Course
        try:
            Course.objects.get(pk=value, is_active=True)
        except Course.DoesNotExist:
            raise serializers.ValidationError("الكورس غير موجود أو غير نشط.")
        return value

    def validate_questions(self, value):
        if not value:
            raise serializers.ValidationError("يجب إضافة سؤال واحد على الأقل.")
        return value

    def create(self, validated_data):
        questions_data = validated_data.pop("questions")
        user = self.context["request"].user

        with transaction.atomic():
            exam = Exam.objects.create(
                course_id=validated_data["course"],
                title=validated_data["title"],
                duration_minutes=validated_data["duration_minutes"],
                passing_score=validated_data["passing_score"],
                created_by=user,
            )

            for q_data in questions_data:
                options_data = q_data.pop("options", [])
                image_b64 = q_data.pop("image", None)

                question = ExamQuestion.objects.create(
                    exam=exam,
                    question_type=q_data["question_type"],
                    title=q_data.get("title", ""),
                    text=q_data["text"],
                    marks=q_data["marks"],
                    display_order=q_data["display_order"],
                    correct_answer=q_data["correct_answer"],
                )

                # حفظ صورة السؤال إذا أُرسلت كـ Base64
                if image_b64 and image_b64.startswith("data:"):
                    question.image = _decode_b64_image(image_b64)
                    question.save(update_fields=["image"])

                for opt_data in options_data:
                    ExamQuestionOption.objects.create(
                        question=question,
                        text=opt_data["text"],
                        display_order=opt_data.get("display_order", 0),
                    )

                # لأسئلة الاختيار من متعدد: تحديث correct_answer بـ option_id الفعلي
                if (
                    question.question_type == ExamQuestion.QuestionType.MULTIPLE_CHOICE
                    and "correct_option_index" in q_data.get("correct_answer", {})
                ):
                    idx = q_data["correct_answer"]["correct_option_index"]
                    created_options = list(
                        question.options.order_by("display_order")
                    )
                    if 0 <= idx < len(created_options):
                        question.correct_answer = {
                            "option_id": created_options[idx].id
                        }
                        question.save(update_fields=["correct_answer"])

        return exam


class ExamBatchUpdateSerializer(serializers.Serializer):
    """
    تحديث اختبار كامل: يحذف الأسئلة الحالية ويُعيد إنشاءها.
    أبسط وأكثر أماناً من محاولة diff الأسئلة القديمة والجديدة.
    """

    title = serializers.CharField(max_length=255)
    duration_minutes = serializers.IntegerField(default=60)
    passing_score = serializers.FloatField(default=50.0)
    questions = QuestionInputSerializer(many=True)

    def validate_questions(self, value):
        if not value:
            raise serializers.ValidationError("يجب إضافة سؤال واحد على الأقل.")
        return value

    def update(self, instance, validated_data):
        questions_data = validated_data.pop("questions")

        with transaction.atomic():
            # تحديث بيانات الاختبار الأساسية
            instance.title = validated_data["title"]
            instance.duration_minutes = validated_data["duration_minutes"]
            instance.passing_score = validated_data["passing_score"]
            instance.save(update_fields=[
                "title", "duration_minutes", "passing_score", "updated_at"
            ])

            # حذف الأسئلة القديمة وإعادة إنشائها
            instance.questions.all().delete()

            for q_data in questions_data:
                options_data = q_data.pop("options", [])
                image_b64 = q_data.pop("image", None)

                question = ExamQuestion.objects.create(
                    exam=instance,
                    question_type=q_data["question_type"],
                    title=q_data.get("title", ""),
                    text=q_data["text"],
                    marks=q_data["marks"],
                    display_order=q_data["display_order"],
                    correct_answer=q_data["correct_answer"],
                )

                # حفظ صورة السؤال إذا أُرسلت كـ Base64
                if image_b64 and image_b64.startswith("data:"):
                    question.image = _decode_b64_image(image_b64)
                    question.save(update_fields=["image"])

                for opt_data in options_data:
                    ExamQuestionOption.objects.create(
                        question=question,
                        text=opt_data["text"],
                        display_order=opt_data.get("display_order", 0),
                    )

                if (
                    question.question_type == ExamQuestion.QuestionType.MULTIPLE_CHOICE
                    and "correct_option_index" in q_data.get("correct_answer", {})
                ):
                    idx = q_data["correct_answer"]["correct_option_index"]
                    created_options = list(
                        question.options.order_by("display_order")
                    )
                    if 0 <= idx < len(created_options):
                        question.correct_answer = {
                            "option_id": created_options[idx].id
                        }
                        question.save(update_fields=["correct_answer"])

        return instance


# ─────────────────────────────────────────────────────────────────────────────
# محاولات الطلاب — قائمة
# ─────────────────────────────────────────────────────────────────────────────

class ExamAttemptListSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(
        source="student.user.full_name", read_only=True
    )
    student_phone = serializers.CharField(
        source="student.user.phone", read_only=True, default=""
    )

    class Meta:
        model = ExamAttempt
        fields = [
            "id", "student", "student_name", "student_phone",
            "score", "percentage", "is_passed",
            "started_at", "submitted_at",
        ]
        read_only_fields = fields


# ─────────────────────────────────────────────────────────────────────────────
# إجابة مفردة — للعرض التفصيلي
# ─────────────────────────────────────────────────────────────────────────────

class ExamAttemptAnswerDetailSerializer(serializers.ModelSerializer):
    question_title = serializers.CharField(source="question.title", read_only=True)
    question_text = serializers.CharField(source="question.text", read_only=True)
    question_type = serializers.CharField(
        source="question.question_type", read_only=True
    )
    question_marks = serializers.FloatField(
        source="question.marks", read_only=True
    )
    correct_answer = serializers.JSONField(
        source="question.correct_answer", read_only=True
    )
    options = serializers.SerializerMethodField()

    class Meta:
        model = ExamAttemptAnswer
        fields = [
            "id", "question_title", "question_text", "question_type", "question_marks",
            "correct_answer", "student_answer",
            "is_correct", "earned_marks", "options",
        ]

    def get_options(self, obj):
        """إرجاع خيارات السؤال (للاختيار من متعدد)."""
        return list(
            obj.question.options.values("id", "text", "display_order")
            .order_by("display_order")
        )


# ─────────────────────────────────────────────────────────────────────────────
# محاولة تفصيلية — ورقة الإجابة الكاملة
# ─────────────────────────────────────────────────────────────────────────────

class ExamAttemptDetailSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(
        source="student.user.full_name", read_only=True
    )
    student_phone = serializers.CharField(
        source="student.user.phone", read_only=True, default=""
    )
    exam_title = serializers.CharField(
        source="exam.title", read_only=True
    )
    exam_total_marks = serializers.FloatField(
        source="exam.total_marks", read_only=True
    )
    answers = ExamAttemptAnswerDetailSerializer(many=True, read_only=True)

    class Meta:
        model = ExamAttempt
        fields = [
            "id", "exam", "exam_title", "exam_total_marks",
            "student", "student_name", "student_phone",
            "score", "percentage", "is_passed",
            "started_at", "submitted_at", "answers",
        ]
        read_only_fields = fields


# ── Student-Facing Serializers ────────────────────────────────────────────────

class StudentExamQuestionOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamQuestionOption
        fields = ["id", "text", "display_order"]


class StudentExamQuestionReadSerializer(serializers.ModelSerializer):
    options = StudentExamQuestionOptionSerializer(many=True, read_only=True)
    image_url = serializers.SerializerMethodField()
    matching_left = serializers.SerializerMethodField()
    matching_right = serializers.SerializerMethodField()

    class Meta:
        model = ExamQuestion
        fields = [
            "id", "question_type", "title", "text", "marks",
            "display_order", "options", "image_url", "matching_left", "matching_right",
        ]  # Omit correct_answer for safety during exam taking

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url

    def get_matching_left(self, obj):
        if obj.question_type == "matching" and obj.correct_answer:
            pairs = obj.correct_answer.get("pairs", [])
            return [p.get("a") for p in pairs if p.get("a")]
        return None

    def get_matching_right(self, obj):
        if obj.question_type == "matching" and obj.correct_answer:
            pairs = obj.correct_answer.get("pairs", [])
            import random
            right_items = [p.get("b") for p in pairs if p.get("b")]
            # Shuffle items to prevent leak
            shuffled = list(right_items)
            random.shuffle(shuffled)
            return shuffled
        return None


class StudentExamDetailSerializer(serializers.ModelSerializer):
    questions = StudentExamQuestionReadSerializer(many=True, read_only=True)
    total_marks = serializers.FloatField(read_only=True)
    question_count = serializers.IntegerField(read_only=True)
    course_name = serializers.CharField(source="course.name", read_only=True)

    class Meta:
        model = Exam
        fields = [
            "id", "course", "course_name", "title",
            "duration_minutes", "passing_score",
            "total_marks", "question_count", "questions",
        ]


class StudentAttemptAnswerCreateSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    answer = serializers.JSONField(required=False, default=dict)


class StudentExamAttemptCreateSerializer(serializers.Serializer):
    answers = StudentAttemptAnswerCreateSerializer(many=True)

    def validate(self, attrs):
        exam_id = self.context.get("exam_id")
        try:
            exam = Exam.objects.prefetch_related("questions").get(pk=exam_id, is_active=True)
        except Exam.DoesNotExist:
            raise serializers.ValidationError("الاختبار غير موجود أو غير نشط.")
        
        attrs["exam"] = exam
        
        # Verify that all questions in answers belong to this exam
        exam_question_ids = {q.id for q in exam.questions.all()}
        for ans in attrs.get("answers", []):
            if ans["question_id"] not in exam_question_ids:
                raise serializers.ValidationError(
                    f"السؤال ذو المعرف {ans['question_id']} لا ينتمي لهذا الاختبار."
                )
        return attrs

    def create(self, validated_data):
        from django.utils import timezone
        exam = validated_data["exam"]
        answers_data = validated_data["answers"]
        student = self.context["request"].user.student_profile

        with transaction.atomic():
            attempt = ExamAttempt.objects.create(
                exam=exam,
                student=student,
                started_at=timezone.now(),
                submitted_at=timezone.now(),
            )

            total_score = 0.0
            answers_dict = {ans["question_id"]: ans["answer"] for ans in answers_data}

            for question in exam.questions.all():
                student_answer = answers_dict.get(question.id, {})
                correct_answer = question.correct_answer

                # Grade based on question type
                is_correct = False
                q_type = question.question_type

                if q_type == "true_false":
                    is_correct = (student_answer.get("value") == correct_answer.get("value"))
                elif q_type == "multiple_choice":
                    is_correct = (student_answer.get("option_id") == correct_answer.get("option_id"))
                elif q_type == "fill_blank":
                    is_correct = (
                        str(student_answer.get("text", "")).strip().lower()
                        == str(correct_answer.get("text", "")).strip().lower()
                    )
                elif q_type == "matching":
                    try:
                        st_pairs = student_answer.get("pairs", [])
                        cr_pairs = correct_answer.get("pairs", [])
                        st_set = {(str(p.get("a", "")).strip(), str(p.get("b", "")).strip()) for p in st_pairs}
                        cr_set = {(str(p.get("a", "")).strip(), str(p.get("b", "")).strip()) for p in cr_pairs}
                        is_correct = (st_set == cr_set)
                    except Exception:
                        is_correct = False

                earned_marks = question.marks if is_correct else 0.0
                if is_correct:
                    total_score += question.marks

                ExamAttemptAnswer.objects.create(
                    attempt=attempt,
                    question=question,
                    student_answer=student_answer,
                    is_correct=is_correct,
                    earned_marks=earned_marks,
                )

            attempt.score = total_score
            total_possible = exam.total_marks
            attempt.percentage = (total_score / total_possible * 100.0) if total_possible > 0 else 0.0
            attempt.is_passed = total_score >= exam.passing_score
            attempt.save()

        return attempt


class StudentExamAttemptAnswerDetailSerializer(serializers.ModelSerializer):
    question_title = serializers.CharField(source="question.title", read_only=True)
    question_text = serializers.CharField(source="question.text", read_only=True)
    question_type = serializers.CharField(source="question.question_type", read_only=True)
    question_marks = serializers.FloatField(source="question.marks", read_only=True)
    correct_answer = serializers.JSONField(source="question.correct_answer", read_only=True)
    options = serializers.SerializerMethodField()

    class Meta:
        model = ExamAttemptAnswer
        fields = [
            "id", "question_title", "question_text", "question_type", "question_marks",
            "correct_answer", "student_answer",
            "is_correct", "earned_marks", "options",
        ]

    def get_options(self, obj):
        return list(
            obj.question.options.values("id", "text", "display_order")
            .order_by("display_order")
        )


class StudentExamAttemptDetailSerializer(serializers.ModelSerializer):
    exam_title = serializers.CharField(source="exam.title", read_only=True)
    exam_total_marks = serializers.FloatField(source="exam.total_marks", read_only=True)
    answers = StudentExamAttemptAnswerDetailSerializer(many=True, read_only=True)

    class Meta:
        model = ExamAttempt
        fields = [
            "id", "exam", "exam_title", "exam_total_marks",
            "score", "percentage", "is_passed",
            "started_at", "submitted_at", "answers",
        ]
        read_only_fields = fields
