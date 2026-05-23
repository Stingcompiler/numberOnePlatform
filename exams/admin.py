from django.contrib import admin
from .models import Exam, ExamQuestion, ExamQuestionOption, ExamAttempt, ExamAttemptAnswer


class ExamQuestionInline(admin.TabularInline):
    model = ExamQuestion
    extra = 0


class ExamQuestionOptionInline(admin.TabularInline):
    model = ExamQuestionOption
    extra = 0


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ["title", "course", "duration_minutes", "passing_score", "is_active", "created_at"]
    list_filter = ["is_active", "course"]
    search_fields = ["title"]
    inlines = [ExamQuestionInline]


@admin.register(ExamQuestion)
class ExamQuestionAdmin(admin.ModelAdmin):
    list_display = ["text", "exam", "question_type", "marks", "display_order"]
    list_filter = ["question_type", "exam"]
    inlines = [ExamQuestionOptionInline]


@admin.register(ExamAttempt)
class ExamAttemptAdmin(admin.ModelAdmin):
    list_display = ["student", "exam", "score", "percentage", "is_passed", "submitted_at"]
    list_filter = ["is_passed", "exam"]
