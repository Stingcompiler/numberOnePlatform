from django.contrib import admin
from .models import ExpoPushToken, Notification

@admin.register(ExpoPushToken)
class ExpoPushTokenAdmin(admin.ModelAdmin):
    list_display = ('student', 'token', 'device_id', 'updated_at')
    search_fields = ('student__user__full_name', 'student__user__phone_number', 'token')

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('student', 'title', 'notification_type', 'is_read', 'created_at')
    list_filter = ('notification_type', 'is_read', 'created_at')
    search_fields = ('student__user__full_name', 'title', 'message')
