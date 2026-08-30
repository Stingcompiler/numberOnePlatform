from django.db.models.signals import post_save
from django.dispatch import receiver
from academic.models import Lesson
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

@receiver(post_save, sender=Exam)
def notify_new_exam(sender, instance, created, **kwargs):
    # كان الشرط ‎instance.is_published‎ وهو حقل لا وجود له في Exam إطلاقاً،
    # فكان كل حفظ لاختبار يرفع AttributeError: إنشاء الاختبارات وتعديلها كانا
    # معطّلين تماماً في الإنتاج.
    #
    # ‎created‎ مقصود: بدونه، أول تعديل على أي اختبار قديم بعد هذا الإصلاح كان
    # سيرسل إشعار "امتحان جديد" لكل طلاب الكورس عن اختبار قديم. وهو نفس نمط
    # ‎notify_new_announcement‎ أدناه.
    if created and instance.is_active:
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
