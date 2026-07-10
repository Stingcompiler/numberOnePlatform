from django.db import models
from accounts.models import StudentProfile

class ExpoPushToken(models.Model):
    student = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name="expo_push_tokens"
    )
    token = models.CharField(max_length=255, unique=True)
    device_id = models.CharField(max_length=255, blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Expo Push Token"
        verbose_name_plural = "Expo Push Tokens"
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.student.user.full_name} - {self.token[:20]}..."


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        LECTURE      = 'lecture',      'محاضرة جديدة'
        EXAM         = 'exam',         'امتحان جديد'
        RESULT       = 'result',       'نتيجة امتحان'
        LIVE_SESSION = 'live_session', 'جلسة بث مباشر'
        LIVE_PODCAST = 'live_podcast', 'بث مباشر'          # للتوافق مع السجلات القديمة
        ANNOUNCEMENT = 'announcement', 'إعلان هام'


    student = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name="notifications"
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=50,
        choices=NotificationType.choices,
        default=NotificationType.ANNOUNCEMENT
    )
    related_object_id = models.CharField(max_length=255, blank=True, null=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.student.user.full_name}"
