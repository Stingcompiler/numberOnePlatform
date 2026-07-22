"""
================================================================================
academic/urls.py
================================================================================
"""

from django.urls import path
from .views import (
    LevelListCreateView, LevelDetailView,
    GradeListCreateView, GradeDetailView,
    CourseListCreateView, CourseDetailView,
    UnitListCreateView, UnitDetailView,
    LessonListCreateView, LessonDetailView,
    ExerciseCreateView, ExerciseDetailView,
    QuestionListCreateView, ChoiceListCreateView,
    StudentCourseAccessListCreateView, StudentCourseAccessDetailView,
    MyCoursesView, MyCourseDetailView, MyLessonDetailView,
    MarkLessonCompleteView, SubmitExerciseView,
    MySubmissionsView, AllSubmissionsView, MyProgressView,
    PublicLevelListView, PublicGradeListView,
)

urlpatterns = [
    # ── الهيكل الأكاديمي (Admin) ──────────────────────────────────────────────
    path("levels/",                             LevelListCreateView.as_view(),      name="level-list"),
    path("levels/<int:pk>/",                    LevelDetailView.as_view(),          name="level-detail"),
    path("levels/public/",                      PublicLevelListView.as_view(),       name="level-public-list"),

    path("grades/",                             GradeListCreateView.as_view(),      name="grade-list"),
    path("grades/<int:pk>/",                    GradeDetailView.as_view(),          name="grade-detail"),
    path("grades/public/",                      PublicGradeListView.as_view(),       name="grade-public-list"),

    path("courses/",                            CourseListCreateView.as_view(),     name="course-list"),
    path("courses/<int:pk>/",                   CourseDetailView.as_view(),         name="course-detail"),

    path("units/",                              UnitListCreateView.as_view(),       name="unit-list"),
    path("units/<int:pk>/",                     UnitDetailView.as_view(),           name="unit-detail"),

    path("lessons/",                            LessonListCreateView.as_view(),     name="lesson-list"),
    path("lessons/<int:pk>/",                   LessonDetailView.as_view(),         name="lesson-detail"),

    # ── التمارين والأسئلة ─────────────────────────────────────────────────────
    path("exercises/",                          ExerciseCreateView.as_view(),       name="exercise-create"),
    path("exercises/<int:pk>/",                 ExerciseDetailView.as_view(),       name="exercise-detail"),
    path("exercises/<int:exercise_id>/questions/", QuestionListCreateView.as_view(), name="question-list"),
    path("questions/<int:question_id>/choices/",   ChoiceListCreateView.as_view(),  name="choice-list"),

    # ── وصول الكورسات ─────────────────────────────────────────────────────────
    path("access/",                             StudentCourseAccessListCreateView.as_view(), name="access-list"),
    path("access/<int:pk>/",                    StudentCourseAccessDetailView.as_view(),     name="access-detail"),

    # ── واجهات الطالب ──────────────────────────────────────────────────────────
    path("my-courses/",                            MyCoursesView.as_view(),          name="my-courses"),
    path("my-courses/<int:course_id>/",            MyCourseDetailView.as_view(),     name="my-course-detail"),
    path("my-lessons/<int:lesson_id>/",            MyLessonDetailView.as_view(),     name="my-lesson-detail"),
    path("my-lessons/<int:lesson_id>/complete/",   MarkLessonCompleteView.as_view(), name="lesson-complete"),
    path("my-submissions/",                        MySubmissionsView.as_view(),      name="my-submissions"),
    path("my-progress/",                           MyProgressView.as_view(),         name="my-progress"),

    # ── التسليم والنتائج ──────────────────────────────────────────────────────
    path("submit/",                             SubmitExerciseView.as_view(),       name="exercise-submit"),
    path("submissions/",                        AllSubmissionsView.as_view(),       name="all-submissions"),
]
