"""
Fixtures for the desktop client's live API tests.

Run against a SCRATCH database only:

    DB_NAME=/tmp/authtest.sqlite3 DEBUG=True python manage.py shell < seed_desktop_fixtures.py

Creates one course with a unit, two lessons, an exercise, an exam covering all
four question types, a live room with three sessions, and two notifications --
all owned by fresh.student, which the tests sign in as.
"""

from django.utils import timezone
from datetime import timedelta

from accounts.models import CustomUser, StudentProfile
from academic.models import (
    Level, Grade, Course, Unit, Lesson, Exercise, Question, Choice,
    StudentCourseAccess,
)
from exams.models import Exam, ExamQuestion, ExamQuestionOption
from live.models import LiveRoom, LiveSession
from notifications.models import Notification

# notifications/signals.py notify_new_exam reads Exam.is_published, a field that
# does not exist -- so every Exam.save() raises AttributeError. Disconnected here
# so the fixtures can be created; the underlying fault is a backend bug, reported
# separately and deliberately NOT patched from this seed script.
from django.db.models.signals import post_save
from notifications.signals import notify_new_exam
post_save.disconnect(notify_new_exam, sender=Exam)

student = StudentProfile.objects.get(user__username="fresh.student")

level, _ = Level.objects.get_or_create(name="المرحلة الثانوية", defaults={"display_order": 1})
grade, _ = Grade.objects.get_or_create(name="الصف الثالث", level=level, defaults={"display_order": 1})

student.enrolled_grade = grade
student.save(update_fields=["enrolled_grade"])

course, _ = Course.objects.get_or_create(
    name="الرياضيات",
    grade=grade,
    defaults={"description": "منهج الرياضيات الكامل", "system_type": "online"},
)
StudentCourseAccess.objects.get_or_create(student=student, course=course, defaults={"is_active": True})

unit, _ = Unit.objects.get_or_create(course=course, name="الوحدة الأولى — الجبر", defaults={"display_order": 1})

lesson1, _ = Lesson.objects.get_or_create(
    unit=unit, title="المعادلات التربيعية",
    defaults={
        "description": "شرح المعادلات التربيعية",
        # Stored raw; the student serializers expose only youtube_embed_url.
        "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "duration_minutes": 24,
        "display_order": 1,
    },
)
lesson2, _ = Lesson.objects.get_or_create(
    unit=unit, title="المتباينات",
    defaults={"youtube_url": "https://youtu.be/abcdefghijk", "duration_minutes": 18, "display_order": 2},
)

exercise, created = Exercise.objects.get_or_create(
    lesson=lesson1, defaults={"title": "تمرين المعادلات", "instructions": "اختر الإجابة الصحيحة", "max_attempts": 3}
)
if created:
    q = Question.objects.create(exercise=exercise, text="ما هو حل المعادلة x² = 9؟", marks=1.0, display_order=1)
    Choice.objects.create(question=q, text="٣ و -٣", is_correct=True, display_order=1)
    Choice.objects.create(question=q, text="٩ فقط", is_correct=False, display_order=2)
    Choice.objects.create(question=q, text="لا يوجد حل", is_correct=False, display_order=3)

exam, created = Exam.objects.get_or_create(
    course=course, title="اختبار الجبر",
    # passing_score is an ABSOLUTE mark, not a percentage -- the help text says
    # "من إجمالي درجات الاختبار" and mobile renders it as "score / total_marks".
    # The model default of 50.0 is therefore unpassable on any exam worth less
    # than 50 marks. This exam is worth 6, so 3 is "half marks".
    defaults={"duration_minutes": 30, "passing_score": 3.0, "is_active": True},
)
if created:
    tf = ExamQuestion.objects.create(
        exam=exam, question_type="true_false", title="صواب أم خطأ",
        text="المعادلة التربيعية لها حلان دائماً.", marks=1.0, display_order=1,
        correct_answer={"value": False},
    )
    mc = ExamQuestion.objects.create(
        exam=exam, question_type="multiple_choice", title="اختيار من متعدد",
        text="ما هو ميل الخط المستقيم y = 2x + 1؟", marks=2.0, display_order=2,
        correct_answer={},
    )
    a = ExamQuestionOption.objects.create(question=mc, text="٢", display_order=1)
    ExamQuestionOption.objects.create(question=mc, text="١", display_order=2)
    ExamQuestionOption.objects.create(question=mc, text="٣", display_order=3)
    mc.correct_answer = {"option_id": a.id}
    mc.save(update_fields=["correct_answer"])

    ExamQuestion.objects.create(
        exam=exam, question_type="fill_blank", title="أكمل الفراغ",
        text="مجموع زوايا المثلث يساوي ____ درجة.", marks=1.0, display_order=3,
        correct_answer={"text": "180"},
    )
    ExamQuestion.objects.create(
        exam=exam, question_type="matching", title="طابق بين العمودين",
        text="طابق كل شكل بعدد أضلاعه.", marks=2.0, display_order=4,
        correct_answer={"pairs": [{"a": "مثلث", "b": "٣"}, {"a": "مربع", "b": "٤"}]},
    )

room, _ = LiveRoom.objects.get_or_create(
    room_name="غرفة الرياضيات", defaults={"room_type": "online", "is_active": True},
)
now = timezone.now()
LiveSession.objects.get_or_create(
    room=room, session_name="مراجعة الجبر",
    defaults={
        "provider": "zoom", "stream_url": "https://zoom.us/j/1234567890",
        "scheduled_start": now + timedelta(days=1), "scheduled_end": now + timedelta(days=1, hours=1),
        "status": "upcoming",
    },
)
LiveSession.objects.get_or_create(
    room=room, session_name="حصة مباشرة الآن",
    defaults={
        "provider": "google_meet", "stream_url": "https://meet.google.com/abc-defg-hij",
        "scheduled_start": now - timedelta(minutes=10), "scheduled_end": now + timedelta(minutes=50),
        "status": "live",
    },
)
LiveSession.objects.get_or_create(
    room=room, session_name="حصة منتهية",
    defaults={
        "provider": "youtube", "stream_url": "https://youtube.com/live/xyz",
        "scheduled_start": now - timedelta(days=2), "scheduled_end": now - timedelta(days=2, hours=-1),
        "status": "ended",
    },
)

# The Lesson post_save signal already raises "محاضرة جديدة" notifications, so
# these are added only if absent rather than get_or_create'd on a title that
# is not unique.
def ensure_notification(**kwargs):
    if not Notification.objects.filter(student=student, title=kwargs["title"]).exists():
        Notification.objects.create(student=student, **kwargs)

ensure_notification(
    title="اختبار جديد", message="اختبار الجبر متاح الآن.",
    notification_type="exam", related_object_id=str(exam.id), is_read=True,
)
ensure_notification(
    title="إعلان هام", message="ابدأ مراجعة الوحدة الأولى قبل الاختبار.",
    notification_type="announcement",
)

print("SEEDED",
      "course=", course.id, "lesson=", lesson1.id, "exercise=", exercise.id,
      "exam=", exam.id, "room=", room.id,
      "notifications=", Notification.objects.filter(student=student).count())
