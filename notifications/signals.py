from django.db.models.signals import post_save
from django.dispatch import receiver
from academic.models import Lesson, Course
from exams.models import Exam, ExamAttempt
from site_settings.models import Announcement
from accounts.models import StudentProfile
from .services import create_and_send_notification
from .models import Notification

@receiver(post_save, sender=Lesson)
def notify_new_lesson(sender, instance, created, **kwargs):
    if created:
        course = instance.unit.course
        students = StudentProfile.objects.filter(course_accesses__course=course).distinct()
        title = "محاضرة جديدة"
        message = f"تم إضافة محاضرة جديدة '{instance.title}' في مقرر {course.name}"
        create_and_send_notification(
            students=students,
            title=title,
            message=message,
            notification_type=Notification.NotificationType.LECTURE,
            related_object_id=str(instance.id)
        )

@receiver(post_save, sender=Course)
def notify_live_podcast(sender, instance, created, **kwargs):
    # If live_podcast_url is added/updated, notify students
    if instance.live_podcast_url and instance.live_podcast_title:
        # Check if we already sent this exact podcast notification recently
        # To avoid spamming on every course edit, check if a podcast notification exists for this course
        exists = Notification.objects.filter(
            notification_type=Notification.NotificationType.LIVE_PODCAST,
            related_object_id=str(instance.id),
            title=instance.live_podcast_title
        ).exists()

        if not exists:
            students = StudentProfile.objects.filter(course_accesses__course=instance).distinct()
            title = instance.live_podcast_title
            message = f"تم جدولة بث مباشر في مقرر {instance.name}"
            create_and_send_notification(
                students=students,
                title=title,
                message=message,
                notification_type=Notification.NotificationType.LIVE_PODCAST,
                related_object_id=str(instance.id)
            )

@receiver(post_save, sender=Exam)
def notify_new_exam(sender, instance, created, **kwargs):
    if instance.is_published:
        exists = Notification.objects.filter(
            notification_type=Notification.NotificationType.EXAM,
            related_object_id=str(instance.id)
        ).exists()
        
        if not exists:
            course = instance.course
            students = StudentProfile.objects.filter(course_accesses__course=course).distinct()
            title = "امتحان جديد"
            message = f"تم نشر امتحان جديد '{instance.title}' في مقرر {course.name}"
            create_and_send_notification(
                students=students,
                title=title,
                message=message,
                notification_type=Notification.NotificationType.EXAM,
                related_object_id=str(instance.id)
            )

@receiver(post_save, sender=ExamAttempt)
def notify_exam_result(sender, instance, created, **kwargs):
    if created:
        student = instance.student
        title = "نتيجة امتحان"
        message = f"تم إصدار نتيجتك في امتحان {instance.exam.title}. لقد حصلت على {instance.percentage:.1f}%"
        create_and_send_notification(
            students=[student],
            title=title,
            message=message,
            notification_type=Notification.NotificationType.RESULT,
            related_object_id=str(instance.exam.id)
        )

@receiver(post_save, sender=Announcement)
def notify_new_announcement(sender, instance, created, **kwargs):
    if created and instance.is_active:
        students = StudentProfile.objects.all()
        title = "إعلان هام"
        message = instance.title
        create_and_send_notification(
            students=students,
            title=title,
            message=message,
            notification_type=Notification.NotificationType.ANNOUNCEMENT,
            related_object_id=str(instance.id)
        )
